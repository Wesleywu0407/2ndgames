const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
};

export function createPerformanceGovernor({
  renderer, composer, settings, architecture, collisionIndex, canvas,
  getEffects = () => null, probeEnabled = false
}) {
  const probe = { warmup: 0, measured: 0, frames: 0, samples: [], schedulerPauses: 0, reported: false };
  const adaptive = { elapsed: 0, samples: [], degraded: false, reason: '' };

  const resizeForRatio = ratio => {
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio?.(ratio);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  const setDegraded = (degraded, reason = '') => {
    if (adaptive.degraded === degraded) return;
    adaptive.degraded = degraded;
    adaptive.reason = reason;
    settings.prefs.runtimePerformance = degraded;
    document.body.classList.toggle('adaptive-performance', degraded);
    canvas.dataset.adaptivePerformance = degraded ? reason || 'frame-budget' : 'off';
    renderer.shadowMap.enabled = !degraded;
    renderer.shadowMap.needsUpdate = !degraded;
    if (degraded) resizeForRatio(Math.min(window.devicePixelRatio || 1, 0.68));
    else settings.applyQuality(settings.prefs.quality);
  };
  const reportProbe = () => {
    const p95 = percentile(probe.samples, 0.95);
    const report = {
      quality: settings.prefs.quality,
      adaptivePerformance: adaptive.degraded,
      seconds: Number(probe.measured.toFixed(2)),
      frames: probe.frames,
      averageFps: Number((probe.frames / Math.max(.001, probe.measured)).toFixed(1)),
      p95FrameMs: Number((p95 * 1000).toFixed(1)),
      schedulerPauses: probe.schedulerPauses,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      architectureDetail: architecture.detailStats(),
      collisions: collisionIndex?.stats || null,
      effects: getEffects()
    };
    canvas.dataset.performanceProbe = JSON.stringify(report);
    console.info('[Sky QA] performance probe', JSON.stringify(report));
  };

  return {
    update(rawDt) {
      if (document.visibilityState === 'hidden' || rawDt <= 0) return;
      adaptive.elapsed += rawDt;
      adaptive.samples.push(Math.min(rawDt, .25));
      if (adaptive.elapsed >= 3) {
        const p90 = percentile(adaptive.samples, .9);
        const average = adaptive.samples.reduce((sum, value) => sum + value, 0) / adaptive.samples.length;
        if (!adaptive.degraded && (average > 1 / 42 || p90 > 1 / 30)) setDegraded(true, 'sustained-frame-time');
        else if (adaptive.degraded && settings.prefs.quality !== 'performance' && average < 1 / 58 && p90 < 1 / 48) setDegraded(false);
        adaptive.elapsed = 0;
        adaptive.samples.length = 0;
      }

      if (!probeEnabled || probe.reported) return;
      probe.warmup += rawDt;
      // Startup model decode, shader compilation and the first adaptive-quality
      // decision are not steady-state gameplay. Measure only after they settle.
      if (probe.warmup < 4.2) return;
      // Browser/app suspension is reported separately; it is not rendering
      // work and would otherwise make the active-frame p95 meaningless.
      if (rawDt > .25) { probe.schedulerPauses++; return; }
      probe.measured += rawDt;
      probe.frames++;
      probe.samples.push(rawDt);
      if (probe.measured >= 8) { probe.reported = true; reportProbe(); }
    },
    get degraded() { return adaptive.degraded; },
    dispose() { delete settings.prefs.runtimePerformance; }
  };
}
