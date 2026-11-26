import { startJump, advanceJump } from '../lib/studioMiniDashPhysics.js';
export const ROUND_MS = 60000;
export function newRound() {
  return { elapsed: 0, score: 0, height: 0, velocity: 0, held: false, pies: [], nextPie: 300, nextId: 0, obstacles: [], nextObstacle: 2200, obstacleId: 0, tripUntil: 0, collected: 0, trips: 0 };
}
export function jumpHeight(state) { return state.height; }
export function pressJump(state) {
  const next = { ...state, held: true, time: state.elapsed };
  startJump(next);
  return next;
}
export function releaseJump(state) { return { ...state, held: false }; }
export function advanceRound(state, milliseconds, width) {
  const dt = Math.min(milliseconds, ROUND_MS - state.elapsed);
  if (dt <= 0) return state;
  const next = { ...state, elapsed: state.elapsed + dt, pies: state.pies.map(pie => ({ ...pie, x: pie.x - dt * .000272 })) };
  advanceJump(next, dt / 1000);
  if (next.elapsed >= next.nextPie) {
    next.pies.push({ id: next.nextId, x: 1.06, height: next.nextId % 3 === 2 ? 125 : 90 });
    next.nextId += 1;
    next.nextPie += 500;
  }
  next.obstacles = state.obstacles.map(item => ({ ...item, x: item.x - dt * .00034 })).filter(item => item.x > -.2);
  if (next.elapsed >= next.nextObstacle) {
    const kind = ['gary', 'tree', 'snowman'][next.obstacleId % 3];
    next.obstacles.push({ id: next.obstacleId++, kind, x: 1.06, hit: false });
    next.nextObstacle += 3600;
  }
  let bottom = jumpHeight(next);
  for (const obstacle of next.obstacles) {
    const height = { gary: 57, tree: 53, snowman: 44 }[obstacle.kind];
    if (obstacle.hit || obstacle.x > .16) continue;
    obstacle.hit = true;
    if (next.elapsed >= next.tripUntil && bottom < height) {
      next.score = Math.max(0, next.score - 2);
      next.trips += 1;
      next.tripUntil = next.elapsed + 650;
      next.height = 0;
      next.velocity = 0;
      next.held = false;
      bottom = 0;
    }
  }
  next.pies = next.pies.filter(pie => {
    const caught = next.elapsed >= next.tripUntil && Math.abs((pie.x - .16) * width) < 36 && pie.height > bottom + 6 && pie.height < bottom + 70;
    if (caught) { next.score += 1; next.collected += 1; }
    return !caught && pie.x > -.1;
  });
  return next;
}
