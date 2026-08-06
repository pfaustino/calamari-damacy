/**
 * Simple auto-roll for the title-screen demo: chase nearest scoopable junk,
 * wander when nothing is in reach, and bias away from map edges.
 */

const WANDER_PERIOD = 2.4;

/**
 * @param {import('./Katamari.js').Katamari} ball
 * @param {import('./Collectibles.js').Collectibles} collectibles
 * @param {{ floorSize: number }} stage
 * @param {number} time elapsed demo seconds (for wander phase)
 * @returns {{ x: number, z: number }} world-space wish
 */
export function demoWish(ball, collectibles, stage, time) {
  const maxPick = ball.pickupSize;
  const px = ball.position.x;
  const pz = ball.position.z;

  let bestDx = 0;
  let bestDz = 0;
  let bestDist = Infinity;

  for (const item of collectibles.items) {
    if (!item.mesh?.userData?.alive) continue;
    if (item.type.size > maxPick) continue;
    const dx = item.mesh.position.x - px;
    const dz = item.mesh.position.z - pz;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestDx = dx;
      bestDz = dz;
    }
  }

  let wx = 0;
  let wz = 0;
  if (bestDist < Infinity && bestDist > 1e-6) {
    const len = Math.sqrt(bestDist);
    wx = bestDx / len;
    wz = bestDz / len;
  } else {
    // No scoopables — gentle wander so the ball keeps rolling
    const a = time * (Math.PI * 2) / WANDER_PERIOD;
    wx = Math.cos(a);
    wz = Math.sin(a * 0.7);
  }

  // Soft pull toward center near the rim so the demo doesn't hug walls
  const half = (stage.floorSize ?? 80) * 0.5 - 4;
  const edge = Math.max(Math.abs(px) / half, Math.abs(pz) / half);
  if (edge > 0.72) {
    const inwardX = -px;
    const inwardZ = -pz;
    const ilen = Math.hypot(inwardX, inwardZ) || 1;
    const mix = Math.min(1, (edge - 0.72) / 0.28);
    wx = wx * (1 - mix) + (inwardX / ilen) * mix;
    wz = wz * (1 - mix) + (inwardZ / ilen) * mix;
  }

  const len = Math.hypot(wx, wz);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: wx / len, z: wz / len };
}
