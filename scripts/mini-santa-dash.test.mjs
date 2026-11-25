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
