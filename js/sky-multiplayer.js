// Sky Room multiplayer presence client.
//
// Connects to the Living World server's /ws channel and mirrors other
// players as lantern-bearer figures. Fully optional: when the socket is
// unavailable the game plays exactly as before, and the client retries
// quietly in the background.

import * as THREE from 'three';
import {
  ACTIVE_PLAYABLE_IDS, CHARACTER_CATALOG
} from './sky-room/characters/catalog.js';

const SETTINGS_KEY = 'sky-room-settings-v1';
const SEND_HZ = 10;
const LERP_POS = 8;     // per-second convergence toward the last received state
const LERP_YAW = 10;
const MAX_REMOTE_PROJECTILES = 64;
const REMOTE_SHOT_CONFIG = {
  1: { color: 0xffc777, speed: 42, ttl: 1.6, scale: 1, stretch: 1 },
  2: { color: 0xc49aff, speed: 34, ttl: 0.8, scale: 0.6, stretch: 1 },
  3: { color: 0xcfe6ff, speed: power => 55 + 75 * power, ttl: 2.4,
    scale: power => 0.55 + 0.5 * power, stretch: 5 },
  4: { color: 0xb04cff, speed: 18, ttl: 0.65, scale: power => 0.78 + power * 0.25, stretch: 2.2, rays: 8 }
};
const CHARACTER_IDS = Object.freeze([...ACTIVE_PLAYABLE_IDS, 'mercury-xbot']);
const CHARACTER_PRESETS = Object.freeze({
  ...Object.fromEntries(CHARACTER_CATALOG.networkCharacterSummary.map(character => [
    character.id, character.presence
  ])),
  'mercury-xbot': { height: 1.1, width: 0.95, hood: 'round', gear: 'xbot', material: 'mercury' }
});

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
    this.peerPresentationEnabled = false;
    this.inSiege = false;          // are we participating in the shared siege?
    this.siegeSnapshot = null;     // latest server siege state, or null
    this.inStory = false;          // Story disables friendly fire and joins shared objectives
    this.storySnapshot = null;
    this.storyFragment = null;
    this.storyActionSequence = 0;
    this.onLocalHit = null;
    this.onLocalDown = null;
    this.onLocalRespawn = null;
    this.castingUntil = 0;
    this.remoteProjectileRoot = null;
    this.remoteProjectileGeometry = null;
    this.remoteProjectileGlowTexture = null;
    this.remoteProjectiles = [];
    this.remoteProjectileCursor = 0;
    this.remoteProjectileStats = { received: 0, spawned: 0, active: 0 };
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
      this.storySnapshot = null;   // local Story continues; reconnect receives a fresh checkpoint
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
      if (this.inStory) this.joinStory();
      this.announce();
    } else if (message.t === 'join') {
      this.addPeer(message.id, message.name, message.color, message.character);
      this.announce();
    } else if (message.t === 'leave') {
      this.removePeer(message.id);
      this.announce();
    } else if (message.t === 'state') {
      this.applyState(message.id, message);
    } else if (message.t === 'pvp-shot') {
      this.spawnRemoteShot(message);
    } else if (message.t === 'siege') {
      this.siegeSnapshot = message;
      window.dispatchEvent(new CustomEvent('sky-siege-snapshot', { detail: message }));
    } else if (message.t === 'story-state') {
      this.storySnapshot = message;
      this.applyStoryParty(message.party);
      window.dispatchEvent(new CustomEvent('sky-story-snapshot', { detail: message }));
    } else if (message.t === 'story-fragment') {
      this.storyFragment = message;
      window.dispatchEvent(new CustomEvent('sky-story-fragment', { detail: message }));
    } else if (message.t === 'story-ping') {
      window.dispatchEvent(new CustomEvent('sky-story-ping', { detail: message }));
    } else if (message.t === 'story-player') {
      this.setStoryPlayer(message.id, message.dimmed);
      window.dispatchEvent(new CustomEvent('sky-story-player', { detail: message }));
    } else if (message.t === 'story-party-rekindle') {
      this.applyStoryParty([]);
      window.dispatchEvent(new CustomEvent('sky-story-party-rekindle', { detail: message }));
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
      if (target) {
        this.setPeerHp(target, message.hp ?? 100);
        target.down = false;
        target.group.visible = this.peerShouldBeVisible(target);
      }
    }
  }

  /* ---------- shared siege ---------- */

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  joinSiege() { this.inSiege = true; this.send({ t: 'siege-join' }); }
  leaveSiege() { this.inSiege = false; this.siegeSnapshot = null; this.send({ t: 'siege-leave' }); }
  siegeAct(act, ward) { this.send({ t: 'siege-act', act, ward }); }

  /* ---------- shared story ---------- */

  joinStory() {
    this.inStory = true;
    this.send({ t: 'story-join', qa: new URLSearchParams(location.search).has('story-coop-qa') });
  }

  leaveStory() {
    this.inStory = false;
    this.storySnapshot = null;
    this.storyFragment = null;
    this.send({ t: 'story-leave' });
  }

  storyAct(action, payload = {}) {
    // A socket can reconnect after the player has already entered an offline
    // Story. Do not claim that an action was accepted until the authoritative
    // party has actually started; callers can then use their local fallback
    // instead of silently losing an E interaction on the server.
    if (!this.connected || !this.inStory || !this.storySnapshot?.started) return false;
    const actionId = `${this.selfId || 'pending'}-${Date.now().toString(36)}-${(++this.storyActionSequence).toString(36)}`;
    this.send({ t: 'story-act', actionId, action, ...payload });
    return true;
  }

  setStoryReady(ready) { this.send({ t: 'story-ready', ready: Boolean(ready) }); }
  startStorySession() { this.send({ t: 'story-start' }); }
  storyVote(choice) { this.send({ t: 'story-vote', choice }); }
  storyGardenVote(choice) { this.send({ t: 'story-garden-vote', choice }); }
  storyPing(kind) { this.send({ t: 'story-ping', kind }); }

  announce() {
    window.dispatchEvent(new CustomEvent('sky-mp-roster', {
      detail: { connected: this.connected, others: this.peers.size, inStory: this.inStory }
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
    } else if (preset.gear === 'chancellor') {
      const violetMat = new THREE.MeshStandardMaterial({
        color: 0xb05cff, emissive: 0x6920bc, emissiveIntensity: 1.8,
        roughness: 0.28, metalness: 0.18
      });
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.9, 8), accentMat);
      staff.position.set(-0.52, 0.96, 0.05); gear.add(staff);
      const orrery = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 7, 20), violetMat);
      orrery.position.set(-0.52, 1.95, 0.05); orrery.rotation.x = Math.PI / 2; gear.add(orrery);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), violetMat);
      core.position.copy(orrery.position); gear.add(core);
    } else if (preset.gear === 'breacher') {
      const gauntlet = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color: 0xc96f3b, emissive: 0x6c2616, emissiveIntensity: 0.65,
          roughness: 0.36, metalness: 0.72
        })
      );
      gauntlet.scale.set(1.2, 0.92, 1);
      gauntlet.position.set(0.44, bodyH * 0.62, 0.18);
      gear.add(gauntlet);
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
      name, color, character, group, lantern, light, bodyMat, healthFill, hp: 100, hitFlash: 0, down: false, dimmed: false,
      hasState: false,
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
    const firstState = !peer.hasState;
    peer.hasState = true;
    if (firstState) {
      peer.group.position.copy(peer.target);
      peer.yaw = peer.targetYaw;
    }
    peer.group.visible = this.peerShouldBeVisible(peer);
  }

  setPeerHp(peer, hp) {
    peer.hp = Math.max(0, Math.min(100, Number(hp) || 0));
    const width = 1.5 * peer.hp / 100;
    peer.healthFill.scale.x = Math.max(0.001, width);
    peer.healthFill.position.x = -(1.5 - width) / 2;
    peer.healthFill.material.color.set(peer.hp > 55 ? 0xe8b06a : peer.hp > 25 ? 0xe78355 : 0xff455b);
  }

  setPeerDimmed(peer, dimmed) {
    if (!peer) return;
    peer.dimmed = Boolean(dimmed);
    peer.down = peer.dimmed;
    peer.group.visible = this.peerShouldBeVisible(peer);
    peer.healthFill.material.color.set(peer.dimmed ? 0x8f7aa8 : 0xe8b06a);
  }

  setStoryPlayer(id, dimmed) {
    if (id === this.selfId) return;
    this.setPeerDimmed(this.peers.get(id), dimmed);
  }

  applyStoryParty(party) {
    if (!Array.isArray(party)) return;
    for (const member of party) this.setStoryPlayer(member.id, member.dimmed);
  }

  peerShouldBeVisible(peer) {
    return Boolean(this.peerPresentationEnabled && peer.hasState && (!peer.down || peer.dimmed));
  }

  setPeerPresentationEnabled(enabled) {
    this.peerPresentationEnabled = Boolean(enabled);
    for (const peer of this.peers.values()) {
      peer.group.visible = this.peerShouldBeVisible(peer);
    }
    if (!this.peerPresentationEnabled) {
      this.remoteProjectileRoot && (this.remoteProjectileRoot.visible = false);
    } else if (this.remoteProjectileRoot) {
      this.remoteProjectileRoot.visible = true;
    }
  }

  nearestDimmed(position, radius = 5) {
    let nearest = null, best = radius;
    for (const [id, peer] of this.peers) {
      if (!peer.dimmed || !peer.group.visible) continue;
      const distance = peer.group.position.distanceTo(position);
      if (distance < best) { best = distance; nearest = { id, name: peer.name, distance }; }
    }
    return nearest;
  }

  tryHitPeer(position, projectileRadius, weapon = 1) {
    if (!this.connected || this.inSiege || this.inStory) return false;
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

  tryHitPeerArea(position, radius, weapon = 4) {
    if (!this.connected || this.inSiege || this.inStory) return false;
    let nearest = null, nearestDistance = radius;
    for (const [id, peer] of this.peers) {
      if (!peer.group.visible || peer.down || peer.hp <= 0) continue;
      const distance = peer.group.position.distanceTo(position);
      if (distance < nearestDistance) { nearest = { id, peer }; nearestDistance = distance; }
    }
    if (!nearest) return false;
    nearest.peer.hitFlash = 1;
    this.send({ t: 'pvp-hit', target: nearest.id, weapon });
    return true;
  }

  /* ---------- visible network projectiles ---------- */

  get isCasting() { return performance.now() < this.castingUntil; }
  get projectileStats() { return { ...this.remoteProjectileStats }; }

  shoot(origin, directions, weapon = 1, power = 0) {
    if (!this.connected || this.inSiege) return false;
    const vectorArray = value => value?.isVector3
      ? [value.x, value.y, value.z]
      : Array.isArray(value) && value.length === 3 ? value.map(Number) : null;
    const o = vectorArray(origin);
    const list = Array.isArray(directions) ? directions : [directions];
    const d = list.map(vectorArray).filter(value => value?.every(Number.isFinite));
    if (!o?.every(Number.isFinite) || !d.length) return false;
    const w = REMOTE_SHOT_CONFIG[Number(weapon)] ? Number(weapon) : 1;
    this.castingUntil = performance.now() + 180;
    this.send({ t: 'pvp-shot', o, d, w, p: Math.max(0, Math.min(1, Number(power) || 0)) });
    return true;
  }

  ensureRemoteProjectilePool() {
    if (this.remoteProjectileRoot || !this.scene) return;
    this.remoteProjectileRoot = new THREE.Group();
    this.remoteProjectileRoot.name = 'network-projectiles';
    this.remoteProjectileGeometry = new THREE.SphereGeometry(0.16, 10, 8);
    this.remoteProjectileGlowTexture = makeProjectileGlowTexture();
    for (let i = 0; i < MAX_REMOTE_PROJECTILES; i++) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(this.remoteProjectileGeometry,
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.remoteProjectileGlowTexture, color: 0xffffff, transparent: true,
        opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      group.add(core, glow);
      group.visible = false;
      this.remoteProjectileRoot.add(group);
      this.remoteProjectiles.push({ group, core, glow, velocity: new THREE.Vector3(), ttl: 0 });
    }
    this.scene.add(this.remoteProjectileRoot);
  }

  spawnRemoteShot(message) {
    if (!message || message.id === this.selfId || !this.peers.has(message.id)) return;
    const weapon = REMOTE_SHOT_CONFIG[Number(message.w)] ? Number(message.w) : 1;
    const power = Math.max(0, Math.min(1, Number(message.p) || 0));
    const config = REMOTE_SHOT_CONFIG[weapon];
    const origin = message.o;
    const directions = Array.isArray(message.d) ? message.d : [];
    if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) return;
    this.ensureRemoteProjectilePool();
    this.remoteProjectileStats.received++;
    const peer = this.peers.get(message.id);
    if (peer) peer.casting = 1;
    for (const value of directions.slice(0, config.rays || (weapon === 2 ? 5 : 1))) {
      if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) continue;
      const direction = new THREE.Vector3(value[0], value[1], value[2]);
      if (direction.lengthSq() < 0.25) continue;
      direction.normalize();
      const projectile = this.remoteProjectiles.find(item => item.ttl <= 0)
        || this.remoteProjectiles[this.remoteProjectileCursor++ % this.remoteProjectiles.length];
      const speed = typeof config.speed === 'function' ? config.speed(power) : config.speed;
      const scale = typeof config.scale === 'function' ? config.scale(power) : config.scale;
      projectile.group.position.set(origin[0], origin[1], origin[2]);
      projectile.group.lookAt(projectile.group.position.clone().add(direction));
      projectile.core.material.color.setHex(config.color);
      projectile.core.scale.set(scale, scale, scale * config.stretch);
      projectile.glow.material.color.setHex(config.color);
      projectile.glow.scale.set(1.35 * scale, 1.35 * scale, 1);
      projectile.velocity.copy(direction).multiplyScalar(speed);
      projectile.ttl = config.ttl;
      projectile.group.visible = true;
      this.remoteProjectileStats.spawned++;
    }
  }

  /* ---------- per-frame ---------- */

  update(t, dt) {
    let activeProjectiles = 0;
    for (const projectile of this.remoteProjectiles) {
      if (projectile.ttl <= 0) continue;
      projectile.ttl -= dt;
      projectile.group.position.addScaledVector(projectile.velocity, dt);
      if (projectile.ttl <= 0 || projectile.group.position.y < -1
        || Math.hypot(projectile.group.position.x, projectile.group.position.z) > 240) {
        projectile.ttl = 0;
        projectile.group.visible = false;
      } else activeProjectiles++;
    }
    this.remoteProjectileStats.active = activeProjectiles;

    // interpolate peers toward their latest snapshot
    for (const peer of this.peers.values()) {
      if (!peer.group.visible) continue;
      const k = Math.min(1, dt * LERP_POS);
      peer.group.position.lerp(peer.target, k);
      const yawDelta = ((peer.targetYaw - peer.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      peer.yaw += yawDelta * Math.min(1, dt * LERP_YAW);
      peer.group.rotation.y = peer.yaw;
      peer.group.rotation.z += ((peer.dimmed ? -1.12 : 0) - peer.group.rotation.z) * Math.min(1, dt * 6);
      // idle float so distant bearers read as alive
      peer.group.position.y += Math.sin(t * 1.3 + peer.bobSeed) * 0.02;
      const signatureGlow = peer.roleState.signatureActive ? 5 : 0;
      const dimScale = peer.dimmed ? 0.16 : 1;
      peer.light.intensity = (5.4 + Math.sin(t * 2.1 + peer.bobSeed) * 1.2 + peer.casting * 5 + signatureGlow) * dimScale;
      peer.lantern.material.emissiveIntensity = (2.1 + peer.casting * 2.4 + signatureGlow * 0.35) * dimScale;
      peer.hitFlash = Math.max(0, peer.hitFlash - dt * 4.5);
      peer.bodyMat.emissiveIntensity = (0.16 + peer.hitFlash * 2.8) * (peer.dimmed ? 0.35 : 1);
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
    if (this.remoteProjectileRoot) {
      this.scene?.remove(this.remoteProjectileRoot);
      for (const projectile of this.remoteProjectiles) {
        projectile.core.material.dispose();
        projectile.glow.material.dispose();
      }
      this.remoteProjectileGeometry?.dispose();
      this.remoteProjectileGlowTexture?.dispose();
      this.remoteProjectiles.length = 0;
      this.remoteProjectileRoot = null;
    }
  }
}

function makeProjectileGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(255,255,255,0.82)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
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
