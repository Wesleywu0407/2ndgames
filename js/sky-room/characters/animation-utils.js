// Close tiny endpoint differences in authored skeletal root motion. The
// original movement inside the loop is preserved; only the accumulated
// first-to-last drift is removed so repeated clips do not snap or climb.
export function closeLoopingRootMotion(sourceClip) {
  const clip = sourceClip.clone();
  for (const track of clip.tracks) {
    if (!/Hips\.position$/i.test(track.name) || track.times.length < 2) continue;
    const stride = track.getValueSize();
    if (stride < 3) continue;
    const firstTime = track.times[0];
    const duration = track.times[track.times.length - 1] - firstTime;
    if (duration <= 0) continue;
    const lastOffset = (track.times.length - 1) * stride;
    const drift = [
      track.values[lastOffset] - track.values[0],
      track.values[lastOffset + 1] - track.values[1],
      track.values[lastOffset + 2] - track.values[2]
    ];
    for (let i = 1; i < track.times.length; i++) {
      const progress = (track.times[i] - firstTime) / duration;
      const offset = i * stride;
      track.values[offset] -= drift[0] * progress;
      track.values[offset + 1] -= drift[1] * progress;
      track.values[offset + 2] -= drift[2] * progress;
    }
  }
  return clip;
}
