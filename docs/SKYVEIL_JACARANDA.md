# SKYVEIL Purple Jacaranda

The Great Court now uses the authored Higgsfield purple jacaranda GLB instead of
the former low-poly procedural jacarandas. Twelve campus placements share one
GPU-instanced source mesh, preserving the authored silhouette without cloning
its geometry or materials twelve times.

## Runtime treatment

- Canopy-only vertex wind creates a slow, layered breeze while the lower trunk
  remains stable.
- Curved textured petals and full 3D five-lobed bell flowers fall independently.
- Quadratic vertical drag, layered wind, player displacement, threat attraction,
  and restoration pulses make airborne paths irregular.
- A flower that reaches the ground has no bounce. Its angular velocity becomes
  zero immediately and a petal settles flat with only a random ground-plane yaw.
- Landed flowers slide briefly under strong friction, fade, and later respawn in
  the canopy.
- Balanced quality uses 90 petals and 14 complete bell flowers; high and
  performance modes adjust the shared instance budgets.

The procedural fallback remains visible only while the GLB loads or if the asset
cannot be fetched. Runtime state is exposed through `data-jacaranda-*` attributes
on `body` for browser QA.

Run `node scripts/qa-skyveil-jacaranda.mjs` after modifying the model, physics,
cache keys, or campus integration.
