import * as THREE from 'three';

export class CharacterAnimationController {
  constructor(figure) {
    this.figure = figure;
    this.mixer = null;
    this.actions = new Map();
    this.current = null;
    if (figure?.animations?.length && figure.group) {
      this.mixer = new THREE.AnimationMixer(figure.group);
      for (const clip of figure.animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
  }

  play(name = 'idle') {
    if (!this.mixer || this.current === name) return;
    const next = this.actions.get(name) || this.actions.get('idle') || this.actions.values().next().value;
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
    this.actions.clear();
    this.mixer = null;
    this.figure = null;
  }
}
