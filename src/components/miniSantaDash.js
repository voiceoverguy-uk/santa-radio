export const ROUND_MS = 60000;
export const JUMP_MS = 900;
export function newRound() {
  return { elapsed: 0, score: 0, jump: null, pies: [], nextPie: 800, nextId: 0 };
}
export function jumpHeight(jump) {
  return jump === null ? 0 : 116 * Math.sin(Math.PI * Math.min(jump / JUMP_MS, 1));
}
export function advanceRound(state, milliseconds, width) {
  const dt = Math.min(milliseconds, ROUND_MS - state.elapsed);
  if (dt <= 0) return state;
  const next = { ...state, elapsed: state.elapsed + dt, pies: state.pies.map(pie => ({ ...pie, x: pie.x - dt * .00034 })) };
  if (next.jump !== null) next.jump = next.jump + dt >= JUMP_MS ? null : next.jump + dt;
  if (next.elapsed >= next.nextPie) {
    next.pies.push({ id: next.nextId, x: 1.06, height: next.nextId % 3 === 2 ? 125 : 90 });
    next.nextId += 1;
    next.nextPie += 1500;
  }
  const bottom = jumpHeight(next.jump);
  next.pies = next.pies.filter(pie => {
    const caught = Math.abs((pie.x - .16) * width) < 36 && pie.height > bottom + 6 && pie.height < bottom + 70;
    if (caught) next.score += 1;
    return !caught && pie.x > -.1;
  });
  return next;
}
