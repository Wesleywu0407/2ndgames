import * as THREE from 'three';
import { radialTexture } from './textures.js';
import { createCombatEffects } from './combat-effects.js?v=phase5-shared-feedback-2';

export function createDuelSystem(ctx) {
  const effectsProbe = new URLSearchParams(window.location.search).has('duel-effects-probe');
  const {
    scene, camera, renderer, GAME, tr, clamp, lerp, PLAYER_PREFS, PLAYER_R,
    HUNT_R, HUNT_Y0, HUNT_Y1, ROMAN, COLLIDERS, SkyAudio, storyCard,
    CloakedFigure, quality = 'balanced', reducedMotion = false
  } = ctx;

  // Duel input and casting scratch vectors belong to this ES module. Keeping
  // them in sky-room.js made them invisible here and crashed the first frame.
  const duelKeys = Object.create(null);
  const _cv = new THREE.Vector3();
  const _cv2 = new THREE.Vector3();
  const _cvS = new THREE.Vector3();
  window.addEventListener('keydown', (event) => { duelKeys[event.code] = true; });
  window.addEventListener('keyup', (event) => { duelKeys[event.code] = false; });
  let combatEffects = null;

  const ensureCombatEffects = () => {
    if (combatEffects) return combatEffects;
    combatEffects = createCombatEffects({
      scene, camera,
      coreTexture: radialTexture('rgba(190,120,255,1)', 'rgba(70,20,120,0)', 64),
      moteTexture: radialTexture('rgba(255,225,160,1)', 'rgba(255,170,80,0)', 64),
      quality, reducedMotion
    });
    return combatEffects;
  };

  function DuelBolts(coreColor, glowIn, glowOut) {
    const glowTex = radialTexture(glowIn, glowOut, 64);
    const pool = [];
    for (let i = 0; i < 8; i++) { // scatter fires five at once
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
        new THREE.MeshBasicMaterial({ color: coreColor }));
      g.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(1.4);
      g.add(glow);
      g.visible = false;
      scene.add(g);
      pool.push({ g, core, glow, vel: new THREE.Vector3(), ttl: 0, dmg: 14, weapon: 1, impactSize: 1 });
    }
    const _p = { x: 0, y: 0, z: 0 };
    const _aim = new THREE.Vector3();
    return {
      pool,
      fire(origin, dir, { speed = 30, ttl = 3, scale = 1, stretch = 1, dmg = 14, weapon = 1 } = {}) {
        const b = pool.find(bb => bb.ttl <= 0);
        if (!b) return false;
        b.g.position.copy(origin);
        b.vel.copy(dir).multiplyScalar(speed);
        b.ttl = ttl;
        b.dmg = dmg;
        b.weapon = weapon;
        b.impactSize = scale * (weapon === 3 ? 1.25 : 1);
        b.core.scale.set(scale, scale, scale * stretch);
        b.glow.scale.setScalar(1.4 * scale);
        b.g.lookAt(_aim.copy(origin).add(dir));
        b.g.visible = true;
        return true;
      },
      clear() { for (const b of pool) { b.ttl = 0; b.g.visible = false; } },
      update(dt, target, onHit) {
        for (const b of pool) {
          if (b.ttl <= 0) continue;
          b.ttl -= dt;
          const P = b.g.position;
          P.addScaledVector(b.vel, dt);
          let showImpact = P.y < 0.15;
          let dead = b.ttl <= 0 || showImpact;
          if (!dead && target.invulT <= 0) {
            const dx = P.x - target.pos.x, dy = P.y - (target.pos.y + 0.9), dz = P.z - target.pos.z;
            if (dx * dx + dy * dy + dz * dz < 1.2 * 1.2) {
              onHit(b.vel.clone().normalize(), b.dmg);
              dead = true;
              showImpact = true;
            }
          }
          if (!dead) { // towers and walls give cover
            _p.x = P.x; _p.y = P.y; _p.z = P.z;
            resolveCollisions(_p, 0.15);
            if (Math.abs(_p.x - P.x) + Math.abs(_p.y - P.y) + Math.abs(_p.z - P.z) > 1e-4) {
              dead = true;
              showImpact = true;
            }
          }
          if (dead) {
            if (showImpact) ensureCombatEffects().impact(P, { weapon: b.weapon, size: b.impactSize });
            b.ttl = 0;
            b.g.visible = false;
          }
        }
      }
    };
  }
  
  function DuelFighter(opts) {
    const fig = CloakedFigure({
      cloak: opts.cloak, lantern: true, plain: opts.plain,
      lanternColor: opts.lanternColor, glowIn: opts.glowIn, glowOut: opts.glowOut });
    fig.group.position.set(opts.x, 2.2, opts.z);
    // hide this body from its own first-person camera; keep its lantern light global
    const hitMeshes = [];
    fig.group.traverse(o => {
      if (!o.isLight) o.layers.set(opts.layer);
      if (o.isMesh) hitMeshes.push(o);
    });
    scene.add(fig.group);
    const self = {
      fig, hitMeshes, name: opts.name,
      pos: fig.group.position,
      vel: new THREE.Vector3(),
      yaw: opts.yaw, pitch: 0,
      hp: 100, wins: 0,
      castCd: 0, dashCd: 0, dashT: 0, invulT: 0,
      dim: false, lastCastAt: -99, shake: 0,
      shakePhase: Math.random() * Math.PI * 2,
      weapon: 1, drawT0: -1, bowHandle: null, human: !!opts.human,
      dashDir: new THREE.Vector3(),
      bolts: DuelBolts(opts.boltColor, opts.glowIn, opts.glowOut),
      spawn: { x: opts.x, z: opts.z, yaw: opts.yaw },
      viewDir(out) {
        return out.set(
          -Math.sin(self.yaw) * Math.cos(self.pitch),
          Math.sin(self.pitch),
          -Math.cos(self.yaw) * Math.cos(self.pitch));
      },
      resetRound() {
        self.pos.set(self.spawn.x, 2.2, self.spawn.z);
        self.vel.set(0, 0, 0);
        self.yaw = self.spawn.yaw;
        self.pitch = 0;
        self.hp = 100;
        self.castCd = self.dashCd = self.dashT = self.invulT = 0;
        self.cancelDraw();
        self.dim = false;
        fig.setDim(0);
        self.bolts.clear();
      },
      toggleDim() { self.dim = !self.dim; fig.setDim(self.dim ? 1 : 0); SkyAudio.hush(self.dim); },
      // aim assist: if you are pointing at the rival you SEE (small cone), the bolt
      // is released toward where they WILL be — leading the shot is done for you,
      // finding and framing them is still your job. Fills _cv, returns the muzzle.
      aim(opp, cone, speed) {
        self.viewDir(_cv);
        const ex = self.pos.x, ey = self.pos.y + 1.45, ez = self.pos.z;
        _cv2.set(opp.pos.x - ex, opp.pos.y + 0.9 - ey, opp.pos.z - ez);
        const dd = _cv2.length();
        _cv2.normalize();
        if (_cv.angleTo(_cv2) < cone) {
          const lead = Math.min(dd / speed, 1.2);
          _cv2.set(
            opp.pos.x + opp.vel.x * lead - ex,
            opp.pos.y + 0.9 + opp.vel.y * lead - ey,
            opp.pos.z + opp.vel.z * lead - ez).normalize();
          _cv.lerp(_cv2, 0.85).normalize();
        }
        return new THREE.Vector3(ex, ey, ez).addScaledVector(_cv, 0.8);
      },
      // rivals' shots fade with distance — your ears help you hunt
      earshot(opp) { return clamp(1 - self.pos.distanceTo(opp.pos) / 90, 0.3, 1); },
      cast(opp, tNow) {
        if (self.castCd > 0) return;
        if (self.weapon === 3) return; // the moonbow fires on draw + loose
        if (self.dim) { self.dim = false; } // the flame must burn to cast
        if (self.weapon === 2) { // 星屑 — close-range fan of embers
          const origin = self.aim(opp, 0.22, 26);
          let fired = false;
          for (let i = 0; i < 5; i++) {
            _cvS.copy(_cv);
            _cvS.x += (Math.random() - 0.5) * 0.22;
            _cvS.y += (Math.random() - 0.5) * 0.22;
            _cvS.z += (Math.random() - 0.5) * 0.22;
            _cvS.normalize();
            if (self.bolts.fire(origin, _cvS, { speed: 26, ttl: 0.6, scale: 0.6, dmg: 6, weapon: 2 })) fired = true;
          }
          if (fired) {
            self.castCd = 1.1; self.lastCastAt = tNow; fig.flare();
            SkyAudio.scatter(self.earshot(opp));
          }
        } else { // 晨焰 — the classic bolt
          const origin = self.aim(opp, 0.18, 30);
          if (self.bolts.fire(origin, _cv, { dmg: 14, weapon: 1 })) {
            self.castCd = 0.5; self.lastCastAt = tNow; fig.flare();
            SkyAudio.cast(self.earshot(opp));
          }
        }
      },
      // 月弓 — hold to draw, loose for a fast heavy dart; power grows over 1s
      startDraw(tNow, opp) {
        if (self.castCd > 0 || self.weapon !== 3 || self.drawT0 >= 0) return;
        self.drawT0 = tNow;
        self.bowHandle = SkyAudio.bowDraw(self.human ? 1 : 0.55 * self.earshot(opp));
      },
      drawPower(tNow) { return self.drawT0 < 0 ? 0 : Math.min(1, (tNow - self.drawT0) / 1.0); },
      looseBow(opp, tNow) {
        if (self.drawT0 < 0) return;
        const p = self.drawPower(tNow);
        const h = self.bowHandle;
        self.drawT0 = -1;
        self.bowHandle = null;
        if (p < 0.15) { SkyAudio.bowRelease(0, h); return; } // a fumbled tap, not a shot
        if (self.dim) { self.dim = false; } // loosing light betrays you, like casting
        const origin = self.aim(opp, 0.15, 55 + 55 * p);
        if (self.bolts.fire(origin, _cv,
          { speed: 55 + 55 * p, ttl: 2.6, scale: 0.6 + 0.5 * p, stretch: 5, dmg: Math.round(12 + 22 * p), weapon: 3 })) {
          self.castCd = 1.0; self.lastCastAt = tNow; fig.flare();
        }
        SkyAudio.bowRelease(p, h);
      },
      cancelDraw() {
        if (self.drawT0 < 0) return;
        self.drawT0 = -1;
        SkyAudio.bowRelease(0, self.bowHandle);
        self.bowHandle = null;
      },
      setWeapon(w) {
        if (self.weapon === w) return;
        self.weapon = w;
        self.cancelDraw();
        if (self.human) SkyAudio.weaponSelect();
      },
      dash(moveVec) {
        if (self.dashCd > 0) return;
        if (moveVec.lengthSq() > 0.01) self.dashDir.copy(moveVec).normalize();
        else self.viewDir(self.dashDir);
        self.dashT = 0.18;
        self.invulT = 0.32;
        self.dashCd = 1.2;
        SkyAudio.dash();
      },
      applyHit(dir, amt) {
        self.hp = Math.max(0, self.hp - amt);
        fig.hit();
        SkyAudio.hurt(0.8);
        self.vel.addScaledVector(dir, 7);
        self.shake = Math.min(1, self.shake + 0.8);
      },
      update(t, dt, moveVec, locked) {
        self.castCd = Math.max(0, self.castCd - dt);
        self.dashCd = Math.max(0, self.dashCd - dt);
        self.invulT = Math.max(0, self.invulT - dt);
        if (self.dashT > 0) {
          self.dashT -= dt;
          self.vel.copy(self.dashDir).multiplyScalar(22);
        } else if (!locked) {
          const k = 1 - Math.exp(-dt * 5);
          self.vel.x = lerp(self.vel.x, moveVec.x * 12, k);
          self.vel.y = lerp(self.vel.y, moveVec.y * 12, k);
          self.vel.z = lerp(self.vel.z, moveVec.z * 12, k);
        } else {
          self.vel.multiplyScalar(Math.exp(-dt * 5));
        }
        self.pos.addScaledVector(self.vel, dt);
        resolveCollisions(self.pos, 0.65);
        const rr = Math.hypot(self.pos.x, self.pos.z);
        if (rr > HUNT_R) { self.pos.x *= HUNT_R / rr; self.pos.z *= HUNT_R / rr; }
        self.pos.y = clamp(self.pos.y, HUNT_Y0, HUNT_Y1);
        const spd = self.vel.length();
        fig.group.rotation.set(0, self.yaw, 0);
        fig.group.rotateX(Math.min(0.35, spd * 0.02));
        fig.setDim(self.dim ? 1 : 0);
        fig.update(t, dt, Math.min(1, spd / 14));
      }
    };
    return self;
  }
  
  // P1: mouse look (pointer lock), WASD flies along the view, SPACE rises / SHIFT sinks
  // (same as story flight), F/click cast, Q dash, C hush
  function fpControllerP1() {
    let dashHeld = false, dimHeld = false;
    return {
      mouseCast: false,
      look() {}, // mouse events drive yaw/pitch directly
      move(out, self) {
        const f = (duelKeys.KeyW ? 1 : 0) - (duelKeys.KeyS ? 1 : 0);
        const s = (duelKeys.KeyD ? 1 : 0) - (duelKeys.KeyA ? 1 : 0);
        self.viewDir(out).multiplyScalar(f);
        out.x += Math.cos(self.yaw) * s;
        out.z += -Math.sin(self.yaw) * s;
        out.y += (duelKeys.Space ? 1 : 0) - ((duelKeys.ShiftLeft || duelKeys.ShiftRight) ? 1 : 0);
        if (out.lengthSq() > 0) out.normalize();
      },
      wantCast() { return !!duelKeys.KeyF || this.mouseCast; },
      wantDash() { const h = !!duelKeys.KeyQ, f = h && !dashHeld; dashHeld = h; return f; },
      wantDim() { const h = !!duelKeys.KeyC, f = h && !dimHeld; dimHeld = h; return f; }
    };
  }
  
  // P2: arrow keys look, IJKL flies along the view, U rises / O sinks, H cast, N dash, M hush
  function fpControllerP2() {
    let dashHeld = false, dimHeld = false;
    return {
      look(self, dt) {
        self.yaw -= (((duelKeys.ArrowRight ? 1 : 0) - (duelKeys.ArrowLeft ? 1 : 0)) * 2.3) * dt;
        self.pitch = clamp(
          self.pitch + (((duelKeys.ArrowUp ? 1 : 0) - (duelKeys.ArrowDown ? 1 : 0)) * 1.9) * dt,
          -1.25, 1.25);
      },
      move(out, self) {
        const f = (duelKeys.KeyI ? 1 : 0) - (duelKeys.KeyK ? 1 : 0);
        const s = (duelKeys.KeyL ? 1 : 0) - (duelKeys.KeyJ ? 1 : 0);
        self.viewDir(out).multiplyScalar(f);
        out.x += Math.cos(self.yaw) * s;
        out.z += -Math.sin(self.yaw) * s;
        out.y += (duelKeys.KeyU ? 1 : 0) - (duelKeys.KeyO ? 1 : 0);
        if (out.lengthSq() > 0) out.normalize();
      },
      wantCast() { return !!duelKeys.KeyH; },
      wantDash() { const h = !!duelKeys.KeyN, f = h && !dashHeld; dashHeld = h; return f; },
      wantDim() { const h = !!duelKeys.KeyM, f = h && !dimHeld; dimHeld = h; return f; }
    };
  }
  
  // the grey warden: hunts your light, loses you when you hush it, stalks with his own lantern doused
  function fpControllerAI() {
    const lastSeen = new THREE.Vector3(0, 6, 0);
    const wander = new THREE.Vector3(0, 6, 0);
    let wanderT = 0, thinkT = 0, strafe = 1, knows = false;
    const pickWander = () => {
      const a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 50;
      wander.set(Math.cos(a) * r, 2 + Math.random() * 16, Math.sin(a) * r);
      wanderT = 8;
    };
    return {
      look(self, dt, opp, tNow) {
        knows = !opp.dim || self.pos.distanceTo(opp.pos) < 18 || (tNow - opp.lastCastAt) < 2.5;
        if (knows) lastSeen.copy(opp.pos);
        const aim = knows ? opp.pos : lastSeen;
        const dx = aim.x - self.pos.x, dz = aim.z - self.pos.z;
        const dy = aim.y + 0.9 - (self.pos.y + 1.45);
        self.yaw = Math.atan2(-dx, -dz);
        self.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz) || 1e-4), -1.2, 1.2);
      },
      move(out, self, dt, opp) {
        thinkT -= dt;
        if (thinkT <= 0) { thinkT = 0.3 + Math.random() * 0.4; if (Math.random() < 0.3) strafe = -strafe; }
        const goal = knows ? opp.pos : (self.pos.distanceTo(lastSeen) > 4 ? lastSeen : wander);
        if (!knows) { wanderT -= dt; if (wanderT <= 0 || self.pos.distanceTo(wander) < 4) pickWander(); }
        const dx = goal.x - self.pos.x, dy = goal.y - self.pos.y, dz = goal.z - self.pos.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        let radial = 1;
        if (knows) { const want = 14; radial = clamp((d - want) / 4, -1, 1); }
        out.set(
          (dx / d) * radial + (-dz / d) * strafe * (knows ? 0.8 : 0.15),
          clamp(dy * 0.25, -0.6, 0.6),
          (dz / d) * radial + (dx / d) * strafe * (knows ? 0.8 : 0.15));
        if (out.lengthSq() > 0) out.normalize();
      },
      wantCast(self, opp) { return knows && self.castCd <= 0 && self.pos.distanceTo(opp.pos) < 34 && Math.random() < 0.7; },
      wantDash(self, opp) {
        if (self.dashCd > 0) return false;
        for (const b of opp.bolts.pool) {
          if (b.ttl > 0 && b.g.position.distanceTo(self.pos) < 8) return true;
        }
        return false;
      },
      wantDim(self, opp) { // stalks in the dark once he has your scent
        const should = knows && self.pos.distanceTo(opp.pos) < 26;
        return should !== self.dim;
      }
    };
  }
  
  function DuelSystem(mode) {
    ensureCombatEffects();
    const twoP = mode === 'versus';
    const P1 = DuelFighter({
      x: -38, z: 6, yaw: -Math.PI / 2, layer: 1, human: true,
      cloak: 0x2c1f42, name: tr('the lantern bearer', '提燈者'),
      lanternColor: 0xffb464, glowIn: 'rgba(255,190,110,0.7)', glowOut: 'rgba(255,170,80,0)', boltColor: 0xffe0b0 });
    const P2 = DuelFighter({
      x: 38, z: -6, yaw: Math.PI / 2, layer: 2, human: twoP,
      cloak: 0x34302a, plain: true, name: twoP ? tr('the second lantern', '第二位提燈者') : tr('the grey warden', '灰袍守夜人'),
      lanternColor: 0xbfd0ff, glowIn: 'rgba(190,210,255,0.7)', glowOut: 'rgba(150,180,255,0)', boltColor: 0xdce8ff });
    const c1 = fpControllerP1();
    const c2 = twoP ? fpControllerP2() : fpControllerAI();
    const aiCastCd = 1.05;
  
    // first-person cameras: each sees the world, the rival, but not its own body
    const mkCam = (seesLayer) => {
      const c = new THREE.PerspectiveCamera(68, 1, 0.1, 400);
      c.rotation.order = 'YXZ';
      c.layers.enable(seesLayer);
      return c;
    };
    const cam1 = mkCam(2);
    const cam2 = twoP ? mkCam(1) : null;
  
    // pointer lock gives P1 true mouselook; a click also casts once locked
    const cvs = renderer.domElement;
    cvs.addEventListener('mousedown', () => {
      if (!document.pointerLockElement) { cvs.requestPointerLock(); return; }
      c1.mouseCast = true;
    });
    window.addEventListener('mouseup', () => { c1.mouseCast = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== cvs) return;
      P1.yaw -= e.movementX * 0.0024 * PLAYER_PREFS.lookSensitivity;
      P1.pitch = clamp(P1.pitch - e.movementY * 0.0021 * PLAYER_PREFS.lookSensitivity, -1.25, 1.25);
    });
  
    const dname1 = document.getElementById('dname1'), dname2 = document.getElementById('dname2');
    const dkeys = document.getElementById('dkeys');
    const duelHud = document.getElementById('duelhud');
    duelHud.classList.add('on');
    const xh1 = document.getElementById('xh1'), xh2 = document.getElementById('xh2');
    xh1.style.left = twoP ? '25%' : '50%';
    xh1.style.display = 'block';
    if (twoP) { xh2.style.left = '75%'; xh2.style.display = 'block'; }
    document.getElementById('splitline').style.display = twoP ? 'block' : 'none';
  
    const fill1 = document.getElementById('dfill1'), fill2 = document.getElementById('dfill2');
    const pips1 = document.getElementById('dpips1'), pips2 = document.getElementById('dpips2');
    const _m1 = new THREE.Vector3(), _m2 = new THREE.Vector3();
    const _size = new THREE.Vector2();
    const _reticleOrigin = new THREE.Vector3(), _reticleDir = new THREE.Vector3();
    const _reticleRay = new THREE.Raycaster();
    const _reticleHits = [];
    _reticleRay.layers.enableAll();
    let state = 'intro', stateT = 2.6, round = 1, over = false;
    storyCard(tr('the hunt begins', '獵殺開始'), tr('douse your lantern to vanish — but a hushed flame cannot cast', '熄灭提燈即可隱身——但熄燈時無法施法'), 4200);
  
    // Raycast the rival's actual cloak, hood, arm and lantern meshes. This is
    // intentionally separate from aim assist: red means the centre dot is truly
    // touching the visible player model, not merely pointing somewhere near it.
    function reticleHitDistance(self, opp) {
      _reticleOrigin.set(self.pos.x, self.pos.y + 1.45, self.pos.z);
      self.viewDir(_reticleDir).normalize();
      _reticleRay.set(_reticleOrigin, _reticleDir);
      _reticleHits.length = 0;
      _reticleRay.intersectObjects(opp.hitMeshes, false, _reticleHits);
      return _reticleHits.length ? _reticleHits[0].distance : Infinity;
    }
  
    function reticleSeesEnemy(self, opp, tNow) {
      const distance = self.pos.distanceTo(opp.pos);
      const concealed = opp.dim && distance >= 18 && (tNow - opp.lastCastAt) >= 2.5;
      if (concealed || opp.hp <= 0) return false;
      const hitDistance = reticleHitDistance(self, opp);
      if (!Number.isFinite(hitDistance)) return false;
      return !duelRayBlocked(_reticleOrigin, _reticleDir, Math.max(0.01, hitDistance - 0.02));
    }
  
    const pipStr = (w) => '● '.repeat(w) + '○ '.repeat(Math.max(0, 2 - w));
    const refreshPips = () => { pips1.textContent = pipStr(P1.wins); pips2.textContent = pipStr(P2.wins); };
    refreshPips();
  
    // weapon readout — the warden's shows too: he telegraphs his snipes
    const dweap1 = document.getElementById('dweap1'), dweap2 = document.getElementById('dweap2');
    const weaponName = w => ({ 1: tr('EMBER', '晨焰'), 2: tr('SCATTER', '星屑'), 3: tr('MOONBOW', '月弓') })[w];
    function refreshWeapons() {
      const t1 = weaponName(P1.weapon), t2 = weaponName(P2.weapon);
      if (dweap1.textContent !== t1) dweap1.textContent = t1;
      if (dweap2.textContent !== t2) dweap2.textContent = t2;
    }
    function refreshDuelLanguage() {
      P1.name = tr('the lantern bearer', '提燈者');
      P2.name = twoP ? tr('the second lantern', '第二位提燈者') : tr('the grey warden', '灰袍守夜人');
      dname1.textContent = P1.name;
      dname2.textContent = P2.name;
      dkeys.innerHTML = twoP
        ? tr('RETICLE RED = ENEMY HIT &nbsp;|&nbsp; P1 — Mouse look · WASD fly · Space rise / Shift descend · Click/F cast · 1/2/3 weapons · Q dash · C douse &nbsp;|&nbsp; P2 — Arrow keys look · IJKL fly · U rise / O descend · H cast · 8/9/0 weapons · N dash · M douse &nbsp;|&nbsp; Hold moonbow to charge · B mute', '準星碰到敵對玩家 = 變紅 &nbsp;|&nbsp; P1 — 滑鼠視角 · WASD 飛行 · Space 升 / Shift 降 · 左鍵/F 施法 · 1/2/3 武器 · Q 衝刺 · C 熄燈 &nbsp;|&nbsp; P2 — 方向鍵視角 · IJKL 飛行 · U 升 / O 降 · H 施法 · 8/9/0 武器 · N 衝刺 · M 熄燈 &nbsp;|&nbsp; 月弓按住蓄力 · B 靜音')
        : tr('Mouse look · WASD fly · Space rise / Shift descend · Click/F cast · 1/2/3 weapons (hold moonbow to charge) · Q dash · C douse to hide · B mute', '滑鼠視角 · WASD 飛行 · Space 升 / Shift 降 · 左鍵/F 施法 · 1/2/3 武器（月弓按住蓄力） · Q 衝刺 · C 熄燈潛行 · B 靜音');
      refreshWeapons();
    }
    refreshDuelLanguage();
    window.addEventListener('sky-language-change', refreshDuelLanguage);
    // switch keys: P1 1/2/3 · P2 8/9/0 (versus only — the warden chooses his own)
    window.addEventListener('keydown', e => {
      if (over) return;
      const w1 = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code];
      if (w1) P1.setWeapon(w1);
      if (twoP) {
        const w2 = { Digit8: 1, Digit9: 2, Digit0: 3 }[e.code];
        if (w2) P2.setWeapon(w2);
      }
    });
  
    function roundOver(winner) {
      const loser = winner === P1 ? P2 : P1;
      winner.wins++;
      combatEffects.defeat(loser.pos, 'stray');
      refreshPips();
      P1.cancelDraw();
      P2.cancelDraw();
      state = 'roundEnd';
      stateT = 2.8;
      if (winner.wins >= 2) {
        over = true;
        SkyAudio.victory();
        storyCard(tr(`${winner.name} prevails`, `${winner.name}獲勝`), tr('press R to hunt again', '按 R 再次獵殺'), 60000);
        window.addEventListener('keydown', function again(e) {
          if (e.code === 'KeyR') { window.removeEventListener('keydown', again); window.location.reload(); }
        });
      } else {
        SkyAudio.roundBell();
        storyCard(tr(`round to ${winner.name}`, `本局由 ${winner.name} 獲勝`), '', 2400);
      }
    }
  
    const lockNote = document.getElementById('locknote');
    return {
      P1, P2,
      update(t, dt) {
        const locked = state !== 'fight';
        // nudge P1 to grab mouselook until the pointer is captured
        lockNote.style.opacity = document.pointerLockElement === cvs ? 0 : 1;
        // look
        c1.look(P1, dt, P2, t);
        c2.look(P2, dt, P1, t);
        // move + actions
        c1.move(_m1, P1, dt, P2);
        c2.move(_m2, P2, dt, P1);
        if (!locked) {
          // moonbow: the cast key held draws, releasing it looses
          if (P1.weapon === 3) {
            if (c1.wantCast(P1, P2)) P1.startDraw(t, P2);
            else P1.looseBow(P2, t);
          } else if (c1.wantCast(P1, P2)) P1.cast(P2, t);
          if (c1.wantDash(P1, P2)) P1.dash(_m1);
          if (c1.wantDim(P1, P2)) P1.toggleDim();
          if (twoP) {
            if (P2.weapon === 3) {
              if (c2.wantCast(P2, P1)) P2.startDraw(t, P1);
              else P2.looseBow(P1, t);
            } else if (c2.wantCast(P2, P1)) P2.cast(P1, t);
          } else {
            // the warden picks his tool: scatter up close, moonbow at long
            // sight, the plain bolt in between — never mid-draw
            const d12 = P2.pos.distanceTo(P1.pos);
            const sees = !P1.dim || d12 < 18 || (t - P1.lastCastAt) < 2.5;
            if (P2.drawT0 < 0 && P2.castCd <= 0) {
              P2.setWeapon(d12 < 11 ? 2 : d12 > 30 ? 3 : 1);
            }
            if (P2.weapon === 3) {
              if (P2.drawT0 < 0) {
                if (sees && P2.castCd <= 0 && d12 > 24) P2.startDraw(t, P1);
              } else if (P2.drawPower(t) >= 0.85) {
                if (sees) { P2.looseBow(P1, t); P2.castCd = aiCastCd; }
                else P2.cancelDraw(); // lost you — he saves the arrow
              }
            } else if (c2.wantCast(P2, P1)) {
              P2.cast(P1, t);
              P2.castCd = Math.max(P2.castCd, aiCastCd);
            }
          }
          if (c2.wantDash(P2, P1)) P2.dash(_m2);
          if (c2.wantDim(P2, P1)) P2.toggleDim();
        }
        P1.update(t, dt, _m1, locked);
        P2.update(t, dt, _m2, locked);
        P1.bolts.update(dt, P2, (dir, dmg) => {
          P2.applyHit(dir, dmg);
          if (P2.hp <= 0 && state === 'fight') roundOver(P1);
        });
        P2.bolts.update(dt, P1, (dir, dmg) => {
          P1.applyHit(dir, dmg);
          if (P1.hp <= 0 && state === 'fight') roundOver(P2);
        });
        combatEffects.update(dt, null, null, reducedMotion ? 0.16 : 1);
        if (effectsProbe) duelHud.dataset.effectStats = JSON.stringify(combatEffects.stats);
        refreshWeapons();
        fill1.style.width = P1.hp + '%';
        fill2.style.width = P2.hp + '%';
        // round flow
        stateT -= dt;
        if (state === 'intro' && stateT <= 0) { state = 'fight'; storyCard(tr('begin', '開始'), '', 1200); SkyAudio.roundBell(); }
        else if (state === 'roundEnd' && stateT <= 0 && !over) {
          round++;
          P1.resetRound();
          P2.resetRound();
          state = 'intro';
          stateT = 2.0;
          storyCard(tr(`round ${ROMAN[Math.min(round - 1, 4)]}`, `第 ${ROMAN[Math.min(round - 1, 4)]} 局`), '', 2200);
        }
        // first-person cameras with per-player impact shake (+ moonbow zoom)
        for (const [f, c] of twoP ? [[P1, cam1], [P2, cam2]] : [[P1, cam1]]) {
          const fv = 68 - 15 * f.drawPower(t);
          c.fov += (fv - c.fov) * Math.min(1, dt * 8);
          c.position.set(f.pos.x, f.pos.y + 1.45, f.pos.z);
          c.rotation.set(f.pitch, f.yaw, 0);
          if (PLAYER_PREFS.cameraShake && !reducedMotion && f.shake > 0.002) {
            f.shakePhase += dt * (31 + f.shake * 13);
            const envelope = f.shake * f.shake;
            c.position.x += Math.sin(f.shakePhase * 1.7) * envelope * 0.18;
            c.position.y += Math.sin(f.shakePhase * 2.3 + 1.1) * envelope * 0.14;
            c.rotation.z += Math.sin(f.shakePhase * 1.9) * envelope * 0.01;
            f.shake *= Math.exp(-dt * 6.2);
          }
        }
        // Split-screen hit confirmation: each half owns its own reticle state.
        // Red means the exact centre ray touches the visible rival, not merely
        // that the rival is somewhere inside the weapon's aim-assist cone.
        const canLock = twoP && state === 'fight';
        xh1.classList.toggle('enemy-lock', canLock && reticleSeesEnemy(P1, P2, t));
        if (twoP) xh2.classList.toggle('enemy-lock', canLock && reticleSeesEnemy(P2, P1, t));
      },
      render() {
        renderer.getSize(_size);
        renderer.setScissorTest(true);
        if (twoP) {
          const hw = Math.floor(_size.x / 2);
          cam1.aspect = hw / _size.y;
          cam1.updateProjectionMatrix();
          cam2.aspect = (_size.x - hw) / _size.y;
          cam2.updateProjectionMatrix();
          renderer.setViewport(0, 0, hw, _size.y);
          renderer.setScissor(0, 0, hw, _size.y);
          renderer.render(scene, cam1);
          renderer.setViewport(hw, 0, _size.x - hw, _size.y);
          renderer.setScissor(hw, 0, _size.x - hw, _size.y);
          renderer.render(scene, cam2);
        } else {
          cam1.aspect = _size.x / _size.y;
          cam1.updateProjectionMatrix();
          renderer.setViewport(0, 0, _size.x, _size.y);
          renderer.setScissor(0, 0, _size.x, _size.y);
          renderer.render(scene, cam1);
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, _size.x, _size.y);
      }
    };
  }
  
  // Fast line-of-sight checks against the same simplified colliders used by
  // movement. This keeps the red duel reticle from revealing rivals through walls.
  function rayHitsLocalBox(ox, oy, oz, dx, dy, dz, hw, y0, y1, hd, maxDist) {
    let near = 0, far = maxDist;
    const EPS = 1e-7;
    if (Math.abs(dx) < EPS) { if (ox < -hw || ox > hw) return false; }
    else {
      let a = (-hw - ox) / dx, b = (hw - ox) / dx;
      if (a > b) { const swap = a; a = b; b = swap; }
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return false;
    }
    if (Math.abs(dy) < EPS) { if (oy < y0 || oy > y1) return false; }
    else {
      let a = (y0 - oy) / dy, b = (y1 - oy) / dy;
      if (a > b) { const swap = a; a = b; b = swap; }
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return false;
    }
    if (Math.abs(dz) < EPS) { if (oz < -hd || oz > hd) return false; }
    else {
      let a = (-hd - oz) / dz, b = (hd - oz) / dz;
      if (a > b) { const swap = a; a = b; b = swap; }
      near = Math.max(near, a); far = Math.min(far, b);
    }
    return near <= far && far > 0 && near < maxDist;
  }
  
  function duelRayBlocked(origin, dir, maxDist) {
    const EPS = 1e-7;
    for (const c of COLLIDERS) {
      const rx = origin.x - c.x, rz = origin.z - c.z;
      if (c.kind === 'box') {
        const ox = rx * c.cos - rz * c.sin;
        const oz = rx * c.sin + rz * c.cos;
        const dx = dir.x * c.cos - dir.z * c.sin;
        const dz = dir.x * c.sin + dir.z * c.cos;
        if (rayHitsLocalBox(ox, origin.y, oz, dx, dir.y, dz,
          c.hw + 0.08, c.y0 - 0.08, c.y1 + 0.08, c.hd + 0.08, maxDist)) return true;
        continue;
      }
  
      const radius = c.r + 0.08;
      const qa = dir.x * dir.x + dir.z * dir.z;
      let near = 0, far = maxDist;
      if (qa < EPS) {
        if (rx * rx + rz * rz > radius * radius) continue;
      } else {
        const qb = 2 * (rx * dir.x + rz * dir.z);
        const qc = rx * rx + rz * rz - radius * radius;
        const disc = qb * qb - 4 * qa * qc;
        if (disc < 0) continue;
        const root = Math.sqrt(disc);
        let a = (-qb - root) / (2 * qa), b = (-qb + root) / (2 * qa);
        if (a > b) { const swap = a; a = b; b = swap; }
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) continue;
      }
      if (Math.abs(dir.y) < EPS) {
        if (origin.y < c.y0 || origin.y > c.y1) continue;
      } else {
        let a = (c.y0 - origin.y) / dir.y, b = (c.y1 - origin.y) / dir.y;
        if (a > b) { const swap = a; a = b; b = swap; }
        near = Math.max(near, a); far = Math.min(far, b);
      }
      if (near <= far && far > 0 && near < maxDist) return true;
    }
    return false;
  }
  
  /* ================= collision ================= */
  // sphere-vs-collider, resolved along the axis of least penetration:
  // walls push you sideways, tops let you hover/land, undersides push you down
  function resolveCollisions(p, pr) {
    for (const c of COLLIDERS) {
      if (p.y - pr > c.y1 || p.y + pr < c.y0) continue;
      if (c.kind === 'cyl') {
        const dx = p.x - c.x, dz = p.z - c.z;
        const dist = Math.hypot(dx, dz) || 1e-4;
        if (dist > c.r + pr) continue;
        const penH = c.r + pr - dist;
        const penUp = c.y1 + pr - p.y;
        const penDown = p.y + pr - c.y0;
        const m = Math.min(penH, penUp, penDown);
        if (m === penUp) p.y = c.y1 + pr;
        else if (m === penDown) p.y = c.y0 - pr;
        else { p.x = c.x + (dx / dist) * (c.r + pr); p.z = c.z + (dz / dist) * (c.r + pr); }
      } else {
        const dx = p.x - c.x, dz = p.z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const penX = c.hw + pr - Math.abs(lx);
        const penZ = c.hd + pr - Math.abs(lz);
        if (penX <= 0 || penZ <= 0) continue;
        const penUp = c.y1 + pr - p.y;
        const penDown = p.y + pr - c.y0;
        const m = Math.min(penX, penZ, penUp, penDown);
        if (m === penUp) { p.y = c.y1 + pr; continue; }
        if (m === penDown) { p.y = c.y0 - pr; continue; }
        let nlx = lx, nlz = lz;
        if (m === penX) nlx = Math.sign(lx || 1) * (c.hw + pr);
        else nlz = Math.sign(lz || 1) * (c.hd + pr);
        p.x = c.x + nlx * c.cos + nlz * c.sin;
        p.z = c.z - nlx * c.sin + nlz * c.cos;
      }
    }
  }
  
  /* ================= CameraController ================= */
  
  return { DuelSystem, resolveCollisions };
}
