import test from 'node:test';
import assert from 'node:assert/strict';
import { studioSelectionIdentity as identity } from '../src/lib/studioSelectionIdentity.js';

const choices = { name: 'example-recording', age: 'age', activity: 'activity',
  achievement: 'achievement', treat: 'treat', place: 'country', talent: { skip: true } };

test('empty and absent optional regions identify the same recording', () => {
  assert.equal(identity(choices), identity({ ...choices, region: '' }));
  assert.notEqual(identity(choices), identity({ ...choices, region: 'county' }));
  assert.notEqual(identity({ ...choices, region: 'county' }), identity({ ...choices, region: 'other-county' }));
});

test('talent identity compares values independently of property order', () => {
  const selected = { ...choices, talent: { category: 'sports', id: 'tennis' } };
  assert.equal(identity(selected), identity({ ...selected, talent: { id: 'tennis', category: 'sports' } }));
  for (const talent of [null, { skip: true }, { category: 'funny', id: 'tennis' },
    { category: 'sports', id: 'cricket' }]) {
    assert.notEqual(identity(selected), identity({ ...selected, talent }));
  }
  assert.notEqual(identity(choices), identity({ ...choices, talent: null }));
});

test('every recorded choice remains significant', () => {
  for (const key of ['name', 'age', 'activity', 'achievement', 'treat', 'place']) {
    assert.notEqual(identity(choices), identity({ ...choices, [key]: `other-${key}` }), key);
  }
});
