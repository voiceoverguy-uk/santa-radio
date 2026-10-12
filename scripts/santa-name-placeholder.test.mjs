import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popularSantaExamples, randomSantaExample, santaNamePlaceholder } from '../src/lib/santaNamePlaceholder.js';

test('all 200 supplied entries can be randomly chosen without filtering by recordings', () => {
  assert.equal(popularSantaExamples.length, 200);
  popularSantaExamples.forEach((name, i) => {
    assert.equal(randomSantaExample(() => (i + 0.5) / popularSantaExamples.length), name);
  });
  assert.equal(randomSantaExample(() => 0), 'Muhammad');
  assert.equal(randomSantaExample(() => 0.999999), 'Sadie');
  assert.equal(popularSantaExamples.filter(name => name === 'Olivia').length, 2);
});

test('placeholder uses the live total, requested wording and British number formatting', () => {
  assert.equal(santaNamePlaceholder('Olivia', 826), 'Start typing, eg. Olivia, over 826 names available');
  assert.equal(santaNamePlaceholder('Freya', 12345), 'Start typing, eg. Freya, over 12,345 names available');
  assert.equal(santaNamePlaceholder('Harry', 1), 'Start typing, eg. Harry, over 1 name available');
  assert.equal(santaNamePlaceholder('Jack', 0), 'Start typing, eg. Jack, 0 names available');
  for (const count of [null, undefined, -1, '826', NaN]) {
    assert.equal(santaNamePlaceholder('Jack', count), 'Start typing, eg. Jack');
  }
});
