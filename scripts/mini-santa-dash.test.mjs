import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRound, jumpHeight, newRound, ROUND_MS, JUMP_MS } from '../src/components/miniSantaDash.js';
test('round stops at exactly one minute and a replay starts clean', () => {
  const result = advanceRound({ ...newRound(), elapsed: ROUND_MS - 5, score: 9 }, 16, 390);
  assert.equal(result.elapsed, ROUND_MS);
  assert.equal(advanceRound(result, 100, 390), result);
  assert.equal(newRound().score, 0);
});
test('a pie at Santa is collected only when he jumps to its height, once', () => {
  const base = { ...newRound(), nextPie: 10000, pies: [{ id: 0, x: .16, height: 90 }] };
  assert.equal(advanceRound(base, 16, 390).score, 0);
  const caught = advanceRound({ ...base, jump: 160 }, 16, 390);
  assert.equal(caught.score, 1);
  assert.equal(caught.pies.length, 0);
  assert.equal(advanceRound(caught, 16, 390).score, 1);
});
test('jump lands and missed pies leave the arena', () => {
  assert.equal(jumpHeight(null), 0);
  assert.equal(jumpHeight(JUMP_MS / 2), 116);
  const state = advanceRound({ ...newRound(), jump: JUMP_MS - 5, pies: [{ id: 0, x: -.11, height: 90 }] }, 16, 320);
  assert.equal(state.jump, null);
  assert.deepEqual(state.pies, []);
});
test('three times the original pies spawn over a minute', () => {
 let round = newRound();
 for (let i=0;i<3750;i++) round=advanceRound(round,16,390);
 assert.equal(round.nextId,120); // Old 1500ms interval spawned 40.
 assert.equal(round.obstacleId,17);
});
test('obstacles cost two pies once, never below zero, and can be cleared', () => {
 for(const kind of ['gary','tree','snowman']) {
  const base={...newRound(),score:5,obstacles:[{id:0,kind,x:.161,hit:false}]};
  const hit=advanceRound(base,16,320);
  assert.equal(hit.score,3);assert.equal(hit.trips,1);
  assert.equal(advanceRound(hit,16,320).score,3);
  assert.equal(advanceRound({...base,score:1},16,320).score,0);
  const cleared=advanceRound({...base,jump:JUMP_MS/2-16},16,320);
  assert.equal(cleared.score,5);assert.equal(cleared.trips,0);
 }
});
