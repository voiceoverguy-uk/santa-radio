import test from 'node:test';
import assert from 'node:assert/strict';
import {dadDisplayCategories, dadTreatWording} from '../src/lib/dadChoiceWording.js';
import {studioTimelineArguments} from '../src/lib/studioVideoTimeline.js';
import {STUDIO_LEAD_IN_SECONDS, studioMixArgs} from '../server/dad-render.js';

test('display grammar preserves recording identity and does not double-prefix text', () => {
  const categories = {treat: [
    {id: 'one', file: 'original.wav', label: 'air fryer manual and six frozen chips'},
    {id: 'two', file: 'slippers.wav', label: 'slippers with one missing'},
    {id: 'three', file: 'beer.wav', label: 'empty case of beer'},
  ], habit: [{id: 'four', label: 'doing absolutely nothing'}]};
  const result = dadDisplayCategories(categories);
  assert.deepEqual(result.treat.map(x => x.label), ['an air fryer manual and six frozen chips', 'a pair of slippers with one missing', 'an empty case of beer']);
  assert.deepEqual(result.treat.map(({label, ...identity}) => identity), categories.treat.map(({label, ...identity}) => identity));
  assert.deepEqual(result.habit, categories.habit);
  assert.deepEqual(dadDisplayCategories(result), result);
  assert.equal(dadTreatWording('tap water in the good crystal'), 'tap water in the good crystal');
});

test('Dad mix adds four seconds before the complete speech recording', () => {
  assert.equal(STUDIO_LEAD_IN_SECONDS, 4);
  const args = studioMixArgs('voice', 'bells', 'output');
  assert.match(args[args.indexOf('-filter_complex') + 1], /adelay=192000S:all=1/);
});

test('incoming caption blinks only during its first five seconds', () => {
  const args = studioTimelineArguments([{id: 'incoming', start: 0, end: 5, blink: true, y: 540}], 112);
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.match(filter, /gte\(t,0\)\*lt\(t,5\)\*lt\(mod\(t,1\),0\.7\)/);
  const standard = studioTimelineArguments([{id: 'name', start: 10, end: 20, y: 540}], 112);
  assert.doesNotMatch(standard[standard.indexOf('-filter_complex') + 1], /enable=/);
});
