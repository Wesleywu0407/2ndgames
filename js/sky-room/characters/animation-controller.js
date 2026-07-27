import * as THREE from 'three';
import { closeLoopingRootMotion } from './animation-utils.js?v=character-motion-1';

const ONE_SHOT_STATES = new Set([
  'lift', 'land', 'cast', 'hit', 'down', 'interact', 'revive', 'celebration'
]);

function positive(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export class CharacterAnimationController {
  constructor(figure) {
    this.figure = figure;
    this.mixer = null;
    this.actions = new Map();
    this.animationMap = figure?.animationMap || {};
    this.animationConfig = figure?.animationConfig || {};
    this.current = null;
    this.currentAction = null;
    this.currentToken = null;
    // Idle breaks keep a standing character alive: after a quiet stretch the
    // hero plays one short flourish (a breath, a glance) and returns to idle.
    this.idleBreakWindow = figure?.idleBreakWindow || [8, 13];
    this.idleElapsed = 0;
    this.nextIdleBreak = this.rollIdleBreak();
    this.activeBreak = null;
    this.breakRemaining = 0;
    this.breakDuration = 0;
    this.breakToken = 0;
    if (figure?.animations?.length && figure.group) {
      this.mixer = new THREE.AnimationMixer(figure.group);
      const locomotionClips = new Set(['walk', 'run']
        .map(state => this.mappedClip(state).toLowerCase()));
      for (const sourceClip of figure.animations) {
        const clipName = sourceClip.name.toLowerCase();
        const clip = locomotionClips.has(clipName)
          ? closeLoopingRootMotion(sourceClip)
          : sourceClip;
        this.actions.set(clipName, this.mixer.clipAction(clip));
      }
    }
    // Only keep breaks whose clip actually shipped, so a hero without the
    // extra flourishes never freezes on a missing state.
    this.idleBreaks = (figure?.idleBreaks || []).filter(name => this.supports(name));
  }

  rollIdleBreak() {
    const [min, max] = this.idleBreakWindow || [8, 13];
    return min + Math.random() * Math.max(0, max - min);
  }

  // True when this hero shipped a real clip for the state rather than
  // silently falling back to idle.
  supports(name) {
    if (!this.mixer) return false;
    return this.actions.has(this.mappedClip(name).toLowerCase())
      && !this.usesFallbackState(name);
  }

  mappedClip(name = 'idle') {
    return this.animationMap[name] || name;
  }

  usesFallbackState(name, fallback = 'idle') {
    return this.mappedClip(name).toLowerCase() === this.mappedClip(fallback).toLowerCase();
  }

  preferredDuration(name, fallback = 0.7) {
    const config = this.animationConfig[name] || {};
    const configured = positive(config.duration);
    if (configured) return configured;
    const action = this.actions.get(this.mappedClip(name).toLowerCase());
    const clipDuration = positive(action?.getClip?.().duration);
    const timeScale = positive(config.timeScale, 1);
    return clipDuration ? clipDuration / timeScale : fallback;
  }

  get currentClip() {
    return this.currentAction?.getClip?.().name || null;
  }

  play(name = 'idle', options = {}) {
    if (!this.mixer) return;
    const mapped = this.animationMap[name] || name;
    const idle = this.animationMap.idle || 'idle';
    const next = this.actions.get(mapped.toLowerCase()) || this.actions.get(idle.toLowerCase()) || this.actions.values().next().value;
    if (!next) return;
    const config = this.animationConfig[name] || {};
    const token = options.restartToken ?? null;
    const restart = options.restart === true || (token !== null && token !== this.currentToken);
    const targetDuration = positive(options.duration, positive(config.duration));
    const clipDuration = positive(next.getClip?.().duration, 1);
    const timeScale = targetDuration ? clipDuration / targetDuration : positive(config.timeScale, 1);
    const loop = options.loop ?? config.loop ?? !ONE_SHOT_STATES.has(name);
    const previousConfig = this.animationConfig[this.current] || {};
    const previousLoop = previousConfig.loop ?? !ONE_SHOT_STATES.has(this.current);
    const resumeSharedLoop = next === this.currentAction && this.current !== name
      && loop && previousLoop === false;
    next.enabled = true;
    next.clampWhenFinished = options.clamp ?? config.clamp ?? name === 'down';
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.setEffectiveTimeScale(timeScale);
    if (this.current === name && !restart) return;
    if (next !== this.currentAction) {
      next.reset().fadeIn(0.18).play();
      this.currentAction?.fadeOut(0.18);
    } else if (restart || resumeSharedLoop) {
      next.reset().play();
    }
    this.current = name;
    this.currentAction = next;
    this.currentToken = token;
  }

  // Substitute an idle-break flourish for a plain idle once the hero has been
  // standing still long enough. Any other requested state cancels it.
  resolveIdleState(state, dt, options) {
    if (this.breakRemaining > 0) {
      this.breakRemaining -= dt;
      if (state === 'idle' && this.breakRemaining > 0) {
        return [this.activeBreak, { duration: this.breakDuration, restartToken: this.breakToken }];
      }
      this.breakRemaining = 0;
      this.activeBreak = null;
      return [state, options];
    }
    if (state !== 'idle' || !this.idleBreaks.length) {
      this.idleElapsed = 0;
      return [state, options];
    }
    this.idleElapsed += dt;
    if (this.idleElapsed < this.nextIdleBreak) return [state, options];
    this.activeBreak = this.idleBreaks[Math.floor(Math.random() * this.idleBreaks.length)];
    this.breakDuration = this.preferredDuration(this.activeBreak, 2.4);
    this.breakRemaining = this.breakDuration;
    this.breakToken++;
    this.idleElapsed = 0;
    this.nextIdleBreak = this.rollIdleBreak();
    return [this.activeBreak, { duration: this.breakDuration, restartToken: this.breakToken }];
  }

  update(t, dt, state = 'idle', options = {}) {
    if (this.mixer) {
      const [resolved, resolvedOptions] = this.resolveIdleState(state, dt, options);
      this.play(resolved, resolvedOptions);
      this.mixer.update(dt);
    } else {
      const poseState = state === 'fly' || state === 'lift' ? 'flying' : 'ground';
      this.figure?.update?.(t, dt, 0, { state: poseState });
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    if (this.mixer && this.figure?.group) this.mixer.uncacheRoot(this.figure.group);
    this.actions.clear();
    this.animationMap = {};
    this.animationConfig = {};
    this.currentAction = null;
    this.currentToken = null;
    this.mixer = null;
    this.figure = null;
  }
}
