import test from 'node:test';
import assert from 'node:assert/strict';
import { createContenderOrdering } from '../src/lib/contender-order.js';
import { sourceContenderCatalogue } from '../src/lib/contenders.js';

const ids = entries => entries.map(entry => entry.id);

test('first list shuffles all nine, including Bob, without mutating input', () => {
  const original = ids(sourceContenderCatalogue);
  let draws = 0;
  const order = createContenderOrdering(() => { draws++; return 0; });
  const result = order(sourceContenderCatalogue);
  assert.equal(draws, 8);
  assert.deepEqual(ids(sourceContenderCatalogue), original);
  assert.deepEqual(ids(result).sort(), [...original].sort());
  assert.equal(result.at(-1).id, 'bob-the-elf');
  assert.strictEqual(result.at(-1), sourceContenderCatalogue[0]);
});

test('Fisher–Yates yields all six equally weighted permutations of three entries', () => {
  const permutations = new Set();
  for (let first = 0; first < 3; first++) {
    for (let second = 0; second < 2; second++) {
      const draws = [(first + 0.5) / 3, (second + 0.5) / 2];
      const order = createContenderOrdering(() => draws.shift());
      permutations.add(ids(order([{id:'bob'}, {id:'a'}, {id:'b'}])).join(','));
    }
  }
  assert.equal(permutations.size, 6);
});

test('polling refreshes totals and preserves anchors, objects and order without more random draws', () => {
  let draws = 0;
  const order = createContenderOrdering(() => { draws++; return 0.5; });
  assert.deepEqual(order([]), []);
  const initial = ids(order(sourceContenderCatalogue));
  const updated = sourceContenderCatalogue.toReversed().map(entry => ({...entry, total:7}));
  const result = order(updated);
  assert.deepEqual(ids(result), initial);
  assert.equal(draws, 8);
  assert.ok(result.every(entry => entry.total === 7 && entry.anchor === entry.id));
  assert.ok(result.every(entry => updated.includes(entry)));
  assert.deepEqual(order([]), []);
  assert.deepEqual(ids(order(sourceContenderCatalogue)), initial);
  assert.equal(draws, 8);
});

test('new page controllers start fresh, not from a stored order or fixed seed', () => {
  const first = createContenderOrdering(() => 0);
  const second = createContenderOrdering(() => 0.999);
  assert.notDeepEqual(ids(first(sourceContenderCatalogue)), ids(second(sourceContenderCatalogue)));
});

test('new entries append without disturbing the first-load order', () => {
  const order = createContenderOrdering(() => 0);
  const initial = ids(order(sourceContenderCatalogue));
  const result = order([{id:'new-recording',anchor:'new-recording'}, ...sourceContenderCatalogue]);
  assert.deepEqual(ids(result), [...initial, 'new-recording']);
});
