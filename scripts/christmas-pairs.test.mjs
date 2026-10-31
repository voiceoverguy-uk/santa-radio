import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPairsState, makePairsDeck, pairsReducer, pairCount, previewDuration } from '../src/lib/christmasPairs.js';

const ready = level => pairsReducer(pairsReducer(initialPairsState, {
  type: 'ROUND', level, cards: makePairsDeck(level),
}), { type: 'READY' });
const playing = level => pairsReducer(ready(level), { type: 'TICK', elapsed: 10000 });
const flip = (state, id) => pairsReducer(state, { type: 'FLIP', id });

test('decks have exactly two copies of each picture and no duplicate card IDs', () => {
  for (const level of [1, 2, 3, 10, 100]) {
    const cards = makePairsDeck(level);
    assert.equal(cards.length, pairCount(level) * 2);
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
    for (const card of cards) assert.equal(cards.filter(other => other.picture.id === card.picture.id).length, 2);
  }
  assert.deepEqual([1, 2, 3, 4, 100].map(previewDuration), [5000, 4000, 3000, 2000, 2000]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 100].map(pairCount), [3, 4, 6, 8, 10, 12, 12]);
});

test('preview ignores flips and pause preserves preview time', () => {
  let state = ready(1);
  assert.equal(flip(state, state.cards[0].id), state);
  state = pairsReducer(state, { type: 'TICK', elapsed: 1500 });
  state = pairsReducer(state, { type: 'PAUSE' });
  assert.equal(pairsReducer(state, { type: 'TICK', elapsed: 10000 }), state);
  state = pairsReducer(state, { type: 'TOGGLE_PAUSE' });
  assert.equal(state.remainingMs, 3500);
  state = pairsReducer(state, { type: 'TICK', elapsed: 3500 });
  assert.equal(state.phase, 'playing');
});

test('duplicate taps, third taps and invalid IDs cannot advance a turn', () => {
  let state = playing(1);
  const [first] = state.cards;
  const second = state.cards.find(card => card.picture.id !== first.picture.id);
  state = flip(state, first.id);
  assert.equal(flip(state, first.id), state);
  assert.equal(flip(state, 'unknown'), state);
  state = flip(state, second.id);
  assert.equal(state.moves, 1);
  assert.equal(state.selected.length, 2);
  assert.equal(flip(state, state.cards.find(card => !state.selected.includes(card.id)).id), state);
  state = pairsReducer(state, { type: 'PAUSE' });
  assert.equal(pairsReducer(state, { type: 'TICK', elapsed: 2000 }), state);
  state = pairsReducer(state, { type: 'TOGGLE_PAUSE' });
  state = pairsReducer(state, { type: 'TICK', elapsed: 899 });
  assert.equal(state.selected.length, 2);
  state = pairsReducer(state, { type: 'TICK', elapsed: 1 });
  assert.deepEqual(state.selected, []);
});

test('matching keeps cards revealed, counts moves and completes only after every pair', () => {
  let state = playing(2);
  const pictures = [...new Set(state.cards.map(card => card.picture.id))];
  for (const picture of pictures) {
    const pair = state.cards.filter(card => card.picture.id === picture);
    state = flip(flip(state, pair[0].id), pair[1].id);
    assert(state.matched.includes(picture));
    assert.equal(flip(state, pair[0].id), state);
  }
  assert.equal(state.moves, 4);
  assert.equal(state.phase, 'complete');
  const reset = pairsReducer(state, { type: 'ROUND', level: 3, cards: makePairsDeck(3) });
  assert.equal(reset.phase, 'loading');
  assert.equal(reset.moves, 0);
  assert.deepEqual(reset.matched, []);
});

test('image failure is explicit and a new round allows a fresh load', () => {
  let state = pairsReducer(initialPairsState, { type: 'ROUND', level: 1, cards: makePairsDeck(1) });
  state = pairsReducer(state, { type: 'ERROR' });
  assert.equal(state.phase, 'error');
  assert(state.error);
  state = pairsReducer(state, { type: 'ROUND', level: 1, cards: makePairsDeck(1) });
  assert.equal(pairsReducer(state, { type: 'READY' }).phase, 'preview');
});
