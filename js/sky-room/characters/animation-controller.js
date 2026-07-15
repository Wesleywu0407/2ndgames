import * as THREE from 'three';

export class CharacterAnimationController {
  constructor(figure) {
    this.figure = figure;
    this.mixer = null;
    this.actions = new Map();
    this.animationMap = figure?.animationMap || {};
    this.current = null;
    if (figure?.animations?.length && figure.group) {
      this.mixer = new THREE.AnimationMixer(figure.group);
      for (const clip of figure.animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
  }

  play(name = 'idle') {
    if (!this.mixer || this.current === name) return;
    const mapped = this.animationMap[name] || name;
    const idle = this.animationMap.idle || 'idle';
    const next = this.actions.get(mapped.toLowerCase()) || this.actions.get(idle.toLowerCase()) || this.actions.values().next().value;
    if (!next) return;
    next.reset().fadeIn(0.18).play();
    for (const action of this.actions.values()) if (action !== next) action.fadeOut(0.18);
    this.current = name;
  }

  update(t, dt, state = 'idle') {
    if (this.mixer) {
      this.play(state);
      this.mixer.update(dt);
    } else {
      this.figure?.update?.(t, dt, 0, { state: state === 'fly' ? 'flying' : 'ground' });
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    if (this.mixer && this.figure?.group) this.mixer.uncacheRoot(this.figure.group);
    this.actions.clear();
    this.animationMap = {};
    this.mixer = null;
    this.figure = null;
  }
}
