export const shortestAngleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export const CAMERA_PITCH_LIMITS = Object.freeze({
  ground: Object.freeze({ min: -0.62, max: 1.08 }),
  flying: Object.freeze({ min: -1.1, max: 1.1 })
});

export function clampCameraPitch(pitch, state = 'ground') {
  const limits = CAMERA_PITCH_LIMITS[state === 'flying' ? 'flying' : 'ground'];
  return Math.max(limits.min, Math.min(limits.max, Number(pitch) || 0));
}

export function groundCameraLookTargetY(playerY, pitch) {
  return (Number(playerY) || 0) + 0.68 + Math.sin(clampCameraPitch(pitch, 'ground')) * 4.2;
}

export function cameraRecenterPlan({ yaw, pitch, velocityX = 0, velocityZ = 0, state = 'ground' }) {
  const moving = Math.hypot(velocityX, velocityZ) > 0.35;
  const desiredYaw = moving ? Math.atan2(-velocityX, -velocityZ) : yaw;
  return Object.freeze({
    fromYaw: yaw,
    toYaw: yaw + shortestAngleDelta(yaw, desiredYaw),
    fromPitch: pitch,
    toPitch: state === 'flying' ? 0.02 : 0.08,
    duration: 0.24
  });
}
