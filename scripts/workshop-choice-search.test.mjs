import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkshopChoices } from '../src/lib/workshopChoiceSearch.js';

const options = [
  { id: 'one', label: 'Tidying away toys' },
  { id: 'two', label: 'Playing football' },
  { id: 'three', label: 'Sharing toys with others' },
  { id: 'four', label: 'Bûche de Noël' },
  { id: 'five', label: 'The Moon — Space destination' },
];
test('live search matches any part of labels, regardless of case or accents, preserving exact records and order', () => {
  assert.deepEqual(filterWorkshopChoices(options, 'TOYS'), [options[0], options[2]]);
  assert.deepEqual(filterWorkshopChoices(options, 'football'), [options[1]]);
  assert.deepEqual(filterWorkshopChoices(options, 'toys tidying'), [options[0]]);
  assert.deepEqual(filterWorkshopChoices(options, 'buche noel'), [options[3]]);
  assert.deepEqual(filterWorkshopChoices(options, 'space'), [options[4]]);
  assert.equal(filterWorkshopChoices(options, '   '), options);
  assert.deepEqual(filterWorkshopChoices(options, 'no-such-choice'), []);
  assert.equal(options.length, 5);
});
