import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSantaMessage } from '../src/data/santaMessages.js';
import { popularSantaExamples, randomSantaExample, santaNamePlaceholder } from '../src/lib/santaNamePlaceholder.js';

test('every random popular example corresponds to a real available recording', () => {
  popularSantaExamples.forEach((name, i) => {
    assert.equal(randomSantaExample(() => (i + 0.5) / popularSantaExamples.length), name);
    assert.equal(findSantaMessage(name)?.name, name);
  });
  assert.equal(randomSantaExample(() => 0), 'Olivia');
  assert.equal(randomSantaExample(() => 0.999999), 'Freya');
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
