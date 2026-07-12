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

class SkyMultiplayer {
  constructor() {
    this.scene = null;
    this.getState = null;   // () => {p,r,c,w,f} | null (null while not flying)
    this.socket = null;
    this.selfId = null;
    this.peers = new Map(); // id → { name, color, group, lantern, light, target, yaw }
    this.sendAccum = 0;
    this.retryMs = 2000;
    this.enabled = false;
    this.connected = false;
    this.inSiege = false;          // are we participating in the shared siege?
    this.siegeSnapshot = null;     // latest server siege state, or null
  }

  init({ scene, getState }) {
    this.scene = scene;
    this.getState = getState;
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
      color: /^#[0-9a-fA-F]{6}$/.test(saved.cloakColor || '') ? saved.cloakColor : '#e8b06a'
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
      socket.send(JSON.stringify({ t: 'hello', name: id.name, color: id.color }));
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
        this.addPeer(peer.id, peer.name, peer.color);
        if (peer.state) this.applyState(peer.id, peer.state);
      }
      if (this.inSiege) this.send({ t: 'siege-join' }); // rejoin after a reconnect
      this.announce();
    } else if (message.t === 'join') {
      this.addPeer(message.id, message.name, message.color);
      this.announce();
    } else if (message.t === 'leave') {
      this.removePeer(message.id);
      this.announce();
    } else if (message.t === 'state') {
      this.applyState(message.id, message);
    } else if (message.t === 'siege') {
      this.siegeSnapshot = message;
      window.dispatchEvent(new CustomEvent('sky-siege-snapshot', { detail: message }));
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

  addPeer(id, name, color) {
    if (this.peers.has(id) || !this.scene) return;
    const cloak = new THREE.Color(color || '#e8b06a');

    const group = new THREE.Group();
    group.visible = false; // hidden until the first state arrives

    // cloaked body — matches the residents' low-poly language, but brighter
    const bodyMat = new THREE.MeshStandardMaterial({
      color: cloak, roughness: 0.82, metalness: 0.05,
      emissive: cloak, emissiveIntensity: 0.16
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 7), bodyMat);
    body.position.y = 0.75;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.52, 7), bodyMat);
    hood.position.y = 1.62;
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x100f16, roughness: 0.4 })
    );
    face.position.set(0, 1.42, 0.16);

    // the lantern that marks a fellow bearer
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffc678, emissive: 0xffb464, emissiveIntensity: 2.4,
        roughness: 0.3, metalness: 0
      })
    );
    lantern.position.set(0.5, 1.0, 0.22);
    const light = new THREE.PointLight(0xffb268, 6, 10, 2);
    light.position.copy(lantern.position);

    const tag = makeNameTag(name || 'Lantern');
    tag.position.y = 2.35;

    group.add(body, hood, face, lantern, light, tag);
    this.scene.add(group);

    this.peers.set(id, {
      name, color, group, lantern, light,
      target: new THREE.Vector3(), yaw: 0, targetYaw: 0,
      casting: 0, bobSeed: Math.random() * 10
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
    if (!peer.group.visible) {
      peer.group.position.copy(peer.target);
      peer.yaw = peer.targetYaw;
      peer.group.visible = true;
    }
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
      peer.light.intensity = 5.4 + Math.sin(t * 2.1 + peer.bobSeed) * 1.2 + peer.casting * 5;
      peer.lantern.material.emissiveIntensity = 2.1 + peer.casting * 2.4;
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
