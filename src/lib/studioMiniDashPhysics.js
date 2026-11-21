// The native app starts a jump on press and damps upward velocity on release.
// Values are scaled to the compact web lane; simulation uses seconds, not frames.
export const RUN_SPEED = 185;
export function startJump(body) {
  if (body.height > 0 || body.velocity > 0 || body.time < body.tripUntil) return false;
  body.velocity = 560;
  return true;
}
export function advanceJump(body, dt) {
  if (!body.held && body.velocity > 0) body.velocity *= Math.pow(.6, dt * 60);
  body.height = Math.max(0, body.height + body.velocity * dt - 500 * dt * dt);
  body.velocity = body.height > 0 ? body.velocity - 1000 * dt : 0;
  return body.height;
}
export function nextItem(previous, random = Math.random) {
  // Plenty of pies, without a repeating obstacle sequence.
  const pool = ['pie', 'pie', 'pie', 'tree', 'snowman', 'gary'].filter(kind => kind === 'pie' || kind !== previous);
  return pool[Math.floor(random() * pool.length)];
}
export function nextGap(random = Math.random) { return 250 + random() * 130; }

// Independent streams keep plentiful individual pies without crowding obstacles.
export function nextObstacle(previous, random = Math.random) {
 const pool = ['tree','snowman','gary'].filter(kind => kind !== previous);
 return pool[Math.floor(random() * pool.length)];
}
export function nextPieGap(random = Math.random) { return 75 + random() * 90; }
export function nextPieHeight(random = Math.random) { return 50 + random() * 80; }
export function nextObstacleGap(random = Math.random) { return 420 + random() * 240; }
