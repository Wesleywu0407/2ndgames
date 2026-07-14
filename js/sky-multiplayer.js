// Sky Room multiplayer presence client.
//
// Connects to the Living World server's /ws channel and mirrors other
// players as lantern-bearer figures. Fully optional: when the socket is
// unavailable the game plays exactly as before, and the client retries
// quietly in the background.

import * as THREE from 'three';

const SETTINGS_KEY = 'sky-room-settings-v1';
const SEND_HZ = 10;
const LERP_POS = 8;     // per-second convergence toward the last received state
const LERP_YAW = 10;
const CHARACTER_IDS = ['resident-01', 'resident-05', 'resident-10', 'resident-06', 'resident-13', 'resident-18', 'resident-03', 'mercury-xbot'];
const CHARACTER_PRESETS = {
  'resident-01': { height: 0.94, width: 0.9, hood: 'round', gear: 'book' },
  'resident-05': { height: 1.05, width: 1.18, hood: 'tall', gear: 'pauldrons' },
  'resident-10': { height: 0.96, width: 1.02, hood: 'folded', gear: 'vials' },
  'resident-06': { height: 1, width: 1.04, hood: 'round', gear: 'healer' },
  'resident-13': { height: 1.12, width: 1.04, hood: 'sharp', gear: 'moonbow' },
  'resident-18': { height: 1.12, width: 0.92, hood: 'tall', gear: 'halo' },
  'resident-03': { height: 1.02, width: 1.14, hood: 'folded', gear: 'owl' },
  'mercury-xbot': { height: 1.1, width: 0.95, hood: 'round', gear: 'xbot', material: 'mercury' }
};

class SkyMultiplayer {
  constructor() {
    this.scene = null;
    this.getState = null;   // () => {p,r,c,w,f,rs} | null
    this.socket = null;
    this.selfId = null;
    this.peers = new Map(); // id → { name, color, group, lantern, light, target, yaw }
    this.sendAccum = 0;
    this.retryMs = 2000;
    this.enabled = false;
    this.connected = false;
    this.inSiege = false;          // are we participating in the shared siege?
    this.siegeSnapshot = null;     // latest server siege state, or null
    this.onLocalHit = null;
    this.onLocalDown = null;
    this.onLocalRespawn = null;
  }

  init({ scene, getState, onLocalHit, onLocalDown, onLocalRespawn }) {
    this.scene = scene;
    this.getState = getState;
    this.onLocalHit = onLocalHit;
    this.onLocalDown = onLocalDown;
    this.onLocalRespawn = onLocalRespawn;
    this.enabled = true;
    this.connect();
  }

  identity() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) {}
    return {
      name: typeof saved.playerName === 'string' && saved.playerName.trim()
        ? saved.playerName.trim().slice(0, 24)
        : `Lantern ${Math.floor(Math.random() * 900 + 100)}`,
      color: /^#[0-9a-fA-F]{6}$/.test(saved.cloakColor || '') ? saved.cloakColor : '#e8b06a',
      character: CHARACTER_IDS.includes(saved.characterId) ? saved.characterId : CHARACTER_IDS[0]
    };
  }

  connect() {
    if (!this.enabled || this.socket) return;
    let socket;
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${proto}://${location.host}/ws`);
    } catch (_) { this.scheduleRetry(); return; }
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.retryMs = 2000;
      const id = this.identity();
      socket.send(JSON.stringify({ t: 'hello', name: id.name, color: id.color, character: id.character }));
    });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch (_) { return; }
      this.handle(message);
    });
    const drop = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.selfId = null;
      this.connected = false;
      this.siegeSnapshot = null;   // stale once the link drops; SiegeLoop falls back to local
      for (const id of [...this.peers.keys()]) this.removePeer(id);
      this.announce();
      this.scheduleRetry();
    };
    socket.addEventListener('close', drop);
    socket.addEventListener('error', drop);
  }

  scheduleRetry() {
    if (!this.enabled) return;
    setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(15000, this.retryMs * 1.6);
  }

  handle(message) {
    if (message.t === 'welcome') {
      this.selfId = message.id;
      this.connected = true;
      for (const peer of message.players || []) {
        this.addPeer(peer.id, peer.name, peer.color, peer.character);
        if (peer.state) this.applyState(peer.id, peer.state);
      }
      if (this.inSiege) this.send({ t: 'siege-join' }); // rejoin after a reconnect
      this.announce();
    } else if (message.t === 'join') {
      this.addPeer(message.id, message.name, message.color, message.character);
      this.announce();
    } else if (message.t === 'leave') {
      this.removePeer(message.id);
      this.announce();
    } else if (message.t === 'state') {
      this.applyState(message.id, message);
    } else if (message.t === 'siege') {
      this.siegeSnapshot = message;
      window.dispatchEvent(new CustomEvent('sky-siege-snapshot', { detail: message }));
    } else if (message.t === 'pvp-hit') {
      if (message.target === this.selfId) this.onLocalHit?.(message);
      const target = this.peers.get(message.target);
      if (target) { this.setPeerHp(target, message.hp); target.hitFlash = 1; }
    } else if (message.t === 'pvp-down') {
      if (message.target === this.selfId) this.onLocalDown?.(message);
      const target = this.peers.get(message.target);
      if (target) { this.setPeerHp(target, 0); target.down = true; target.group.visible = false; }
    } else if (message.t === 'pvp-respawn') {
      if (message.id === this.selfId) this.onLocalRespawn?.(message);
      const target = this.peers.get(message.id);
      if (target) { this.setPeerHp(target, message.hp ?? 100); target.down = false; target.group.visible = true; }
    }
  }

  /* ---------- shared siege ---------- */

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  joinSiege() { this.inSiege = true; this.send({ t: 'siege-join' }); }
  leaveSiege() { this.inSiege = false; this.siegeSnapshot = null; this.send({ t: 'siege-leave' }); }
  siegeAct(act, ward) { this.send({ t: 'siege-act', act, ward }); }

  announce() {
    window.dispatchEvent(new CustomEvent('sky-mp-roster', {
      detail: { connected: this.connected, others: this.peers.size }
    }));
  }

  /* ---------- avatars ---------- */

  addPeer(id, name, color, character = CHARACTER_IDS[0]) {
    if (this.peers.has(id) || !this.scene) return;
    const cloak = new THREE.Color(color || '#e8b06a');
    character = CHARACTER_IDS.includes(character) ? character : CHARACTER_IDS[0];
    const preset = CHARACTER_PRESETS[character];

    const group = new THREE.Group();
    group.visible = false; // hidden until the first state arrives

    // cloaked body — matches the residents' low-poly language, but brighter
    const bodyMat = preset.material === 'mercury'
      ? new THREE.MeshPhysicalMaterial({
        color: 0xb9c7dc, roughness: 0.12, metalness: 1, clearcoat: 1,
        iridescence: 0.72, emissive: 0x10192c, emissiveIntensity: 0.16
      })
      : new THREE.MeshStandardMaterial({
        color: cloak, roughness: 0.82, metalness: 0.05,
        emissive: cloak, emissiveIntensity: 0.16
      });
    const bodyH = 1.5 * preset.height;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42 * preset.width, bodyH, 7), bodyMat);
    body.position.y = bodyH / 2;
    const hoodH = preset.hood === 'tall' ? 0.72 : preset.hood === 'round' ? 0.38 : 0.52;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3 * preset.width, hoodH, 7), bodyMat);
    hood.position.y = bodyH + hoodH * 0.42;
    if (preset.hood === 'folded') hood.rotation.z = 0.35;
    if (preset.hood === 'sharp') hood.scale.x = 0.78;
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x100f16, roughness: 0.4 })
    );
    face.position.set(0, bodyH - 0.05, 0.16);

    const accentMat = new THREE.MeshStandardMaterial({ color: 0xd8b477, roughness: 0.55, metalness: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 0.75, metalness: 0.2 });
    const gear = new THREE.Group();
    if (preset.gear === 'book') {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.38), accentMat);
      book.position.set(-0.28, bodyH * 0.65, 0.33); book.rotation.z = -0.18; gear.add(book);
    } else if (preset.gear === 'pauldrons') {
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), accentMat);
        shoulder.scale.set(1.35, 0.55, 1); shoulder.position.set(side * 0.38, bodyH * 0.84, 0); gear.add(shoulder);
      }
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.75, 7), darkMat);
      staff.position.set(-0.54, 0.9, 0.08); staff.rotation.z = -0.06; gear.add(staff);
    } else if (preset.gear === 'vials') {
      for (let i = 0; i < 3; i++) {
        const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 6),
          new THREE.MeshStandardMaterial({ color: i === 1 ? 0xb586ff : 0x77d89c, emissive: i === 1 ? 0x542580 : 0x235b3b, emissiveIntensity: 0.7 }));
        vial.position.set(-0.18 + i * 0.18, bodyH * 0.53, 0.34); gear.add(vial);
      }
    } else if (preset.gear === 'healer') {
      const sealMat = new THREE.MeshStandardMaterial({ color: 0x8be0c1, emissive: 0x286653, emissiveIntensity: 0.8 });
      for (let i = 0; i < 3; i++) {
        const seal = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), sealMat);
        seal.position.set(-0.18 + i * 0.18, bodyH * 0.56, 0.34); gear.add(seal);
      }
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.55, 7), darkMat);
      staff.position.set(-0.5, 0.8, 0.04); gear.add(staff);
    } else if (preset.gear === 'moonbow') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 6, 24, Math.PI * 1.45), accentMat);
      bow.position.set(-0.48, bodyH * 0.65, 0.04); bow.rotation.z = Math.PI * 0.28; gear.add(bow);
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.05), bodyMat);
      cape.position.set(0.32, bodyH * 0.48, 0.1); cape.rotation.y = 0.45; gear.add(cape);
    } else if (preset.gear === 'halo') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 7, 28), accentMat);
      halo.position.set(0, bodyH + 0.38, 0); halo.rotation.x = Math.PI / 2; gear.add(halo);
    } else if (preset.gear === 'owl') {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 7), accentMat);
      mask.scale.set(1.2, 0.82, 0.35); mask.position.set(0, bodyH + 0.04, 0.18); gear.add(mask);
      const crook = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.65, 7), darkMat);
      crook.position.set(-0.5, 0.83, 0.04); gear.add(crook);
    } else if (preset.gear === 'xbot') {
      body.visible = false; hood.visible = false; face.visible = false;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.72, 10), bodyMat);
      torso.position.y = 1.16; gear.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), bodyMat);
      head.position.y = 1.72; gear.add(head);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 8), bodyMat);
        arm.position.set(side * 0.35, 1.08, 0); arm.rotation.z = side * -0.16; gear.add(arm);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.8, 8), bodyMat);
        leg.position.set(side * 0.13, 0.42, 0); gear.add(leg);
      }
    }

    // the lantern that marks a fellow bearer
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffc678, emissive: 0xffb464, emissiveIntensity: 2.4,
        roughness: 0.3, metalness: 0
      })
    );
    lantern.position.set(0.5 * preset.width, bodyH * 0.65, 0.22);
    const light = new THREE.PointLight(0xffb268, 6, 10, 2);
    light.position.copy(lantern.position);

    const tag = makeNameTag(name || 'Lantern');
    tag.position.y = bodyH + 1.0;

    const healthBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x160d12, opacity: 0.82, transparent: true, depthWrite: false }));
    healthBack.position.y = bodyH + 0.7;
    healthBack.scale.set(1.58, 0.09, 1);
    const healthFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe8b06a, opacity: 0.95, transparent: true, depthWrite: false }));
    healthFill.position.set(0, bodyH + 0.705, 0.01);
    healthFill.scale.set(1.5, 0.055, 1);

    group.add(body, hood, face, gear, lantern, light, tag, healthBack, healthFill);
    this.scene.add(group);

    this.peers.set(id, {
      name, color, character, group, lantern, light, bodyMat, healthFill, hp: 100, hitFlash: 0, down: false,
      hitY: bodyH * 0.58,
      target: new THREE.Vector3(), yaw: 0, targetYaw: 0,
      casting: 0, weapon: 1, roleState: { signatureActive: false, signatureCharge: 1 },
      bobSeed: Math.random() * 10
    });
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    this.scene?.remove(peer.group);
    peer.group.traverse(node => {
      node.geometry?.dispose?.();
      if (node.material?.map) node.material.map.dispose();
      node.material?.dispose?.();
    });
  }

  applyState(id, state) {
    const peer = this.peers.get(id);
    if (!peer || !Array.isArray(state.p)) return;
    peer.target.set(state.p[0], state.p[1], state.p[2]);
    peer.targetYaw = state.r?.[0] ?? peer.targetYaw;
    peer.casting = state.c ? 1 : 0;
    peer.weapon = [1, 2, 3].includes(state.w) ? state.w : peer.weapon;
    if (state.rs && typeof state.rs === 'object') {
      peer.roleState.signatureActive = Boolean(state.rs.a);
      peer.roleState.signatureCharge = Number.isFinite(state.rs.q)
        ? Math.max(0, Math.min(1, state.rs.q)) : peer.roleState.signatureCharge;
    }
    if (Number.isFinite(state.hp)) this.setPeerHp(peer, state.hp);
    if (!peer.group.visible && !peer.down) {
      peer.group.position.copy(peer.target);
      peer.yaw = peer.targetYaw;
      peer.group.visible = true;
    }
  }

  setPeerHp(peer, hp) {
    peer.hp = Math.max(0, Math.min(100, Number(hp) || 0));
    const width = 1.5 * peer.hp / 100;
    peer.healthFill.scale.x = Math.max(0.001, width);
    peer.healthFill.position.x = -(1.5 - width) / 2;
    peer.healthFill.material.color.set(peer.hp > 55 ? 0xe8b06a : peer.hp > 25 ? 0xe78355 : 0xff455b);
  }

  tryHitPeer(position, projectileRadius, weapon = 1) {
    if (!this.connected || this.inSiege) return false;
    for (const [id, peer] of this.peers) {
      if (!peer.group.visible || peer.down || peer.hp <= 0) continue;
      const dx = position.x - peer.group.position.x;
      const dy = position.y - (peer.group.position.y + peer.hitY);
      const dz = position.z - peer.group.position.z;
      const radius = 0.72 + projectileRadius * 0.25;
      if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
      peer.hitFlash = 1;
      this.send({ t: 'pvp-hit', target: id, weapon });
      return true;
    }
    return false;
  }

  /* ---------- per-frame ---------- */

  update(t, dt) {
    // interpolate peers toward their latest snapshot
    for (const peer of this.peers.values()) {
      if (!peer.group.visible) continue;
      const k = Math.min(1, dt * LERP_POS);
      peer.group.position.lerp(peer.target, k);
      const yawDelta = ((peer.targetYaw - peer.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      peer.yaw += yawDelta * Math.min(1, dt * LERP_YAW);
      peer.group.rotation.y = peer.yaw;
      // idle float so distant bearers read as alive
      peer.group.position.y += Math.sin(t * 1.3 + peer.bobSeed) * 0.02;
      const signatureGlow = peer.roleState.signatureActive ? 5 : 0;
      peer.light.intensity = 5.4 + Math.sin(t * 2.1 + peer.bobSeed) * 1.2 + peer.casting * 5 + signatureGlow;
      peer.lantern.material.emissiveIntensity = 2.1 + peer.casting * 2.4 + signatureGlow * 0.35;
      peer.hitFlash = Math.max(0, peer.hitFlash - dt * 4.5);
      peer.bodyMat.emissiveIntensity = 0.16 + peer.hitFlash * 2.8;
    }

    // publish our own state at a fixed cadence
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.selfId) return;
    this.sendAccum += dt;
    if (this.sendAccum < 1 / SEND_HZ) return;
    this.sendAccum = 0;
    const state = this.getState?.();
    if (!state) return;
    this.socket.send(JSON.stringify({ t: 'state', ...state }));
  }

  // Close the current socket; the auto-retry reconnects with the new
  // name/cloak colour so peers see a leave → join with fresh identity.
  refreshIdentity() {
    this.retryMs = 1500;
    this.socket?.close();
  }

  destroy() {
    this.enabled = false;
    this.socket?.close();
  }
}

function makeNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = '300 40px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(240,230,210,0.92)';
  ctx.fillText(name, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false
  }));
  sprite.scale.set(3.4, 0.64, 1);
  return sprite;
}

export const skyMultiplayer = new SkyMultiplayer();
