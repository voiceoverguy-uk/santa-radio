import test from 'node:test';
import assert from 'node:assert/strict';
import { studioChristmasJokes } from '../src/lib/studioChristmasJokes.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';

const details = {
  age: '10 years old', activity: 'Art', achievement: 'Being brave',
  destination: 'England', treats: 'carrots for the reindeer',
};
const jokeParagraph = letter => letter.paragraphs.filter(text => text.startsWith('By the way, '));

test('25 distinct, short Christmas jokes are reachable in a single personalised paragraph', () => {
  assert.equal(studioChristmasJokes.length, 25);
  assert.equal(new Set(studioChristmasJokes).size, 25);
  for (const [index, joke] of studioChristmasJokes.entries()) {
    assert.ok(joke.length <= 105);
    assert.equal(joke.trim(), joke);
    const letter = createStudioLetter('Robin', () => 0, details, {
      ...createStudioLetterVariation(() => 0), joke: (index + .1) / 25,
    });
    assert.deepEqual(jokeParagraph(letter), [`By the way, Robin, do you like jokes? ${joke}`]);
    assert.ok(letter.paragraphs.indexOf(jokeParagraph(letter)[0]) < letter.paragraphs.length - 1);
  }
});

test('joke selection varies between letters without reshuffling during spelling or choice edits', () => {
  const variation = createStudioLetterVariation(() => .42);
  const original = createStudioLetter('Robin', () => 0, details, variation);
  const renamed = createStudioLetter('Robyn', () => .99, details, variation);
  assert.deepEqual(jokeParagraph(renamed), jokeParagraph(original).map(text => text.replaceAll('Robin', 'Robyn')));
  assert.deepEqual(jokeParagraph(createStudioLetter('Robin', () => .99, {
    ...details, activity: 'Ballet', age: '18 years old',
  }, variation)), jokeParagraph(original));
  assert.notDeepEqual(jokeParagraph(createStudioLetter('Robin', () => 0, details,
    createStudioLetterVariation(() => 0))), jokeParagraph(createStudioLetter('Robin', () => 0, details,
    createStudioLetterVariation(() => .999))));
  assert.equal(createStudioLetterVariation(() => .42).joke, .42);
});

test('demonstration letters also include one joke and legacy variation objects remain valid', () => {
  for (const random of [() => 0, () => .5, () => .999]) {
    assert.equal(jokeParagraph(createStudioLetter('Example', random)).length, 1);
  }
  assert.deepEqual(jokeParagraph(createStudioLetter('Example', () => .5, details, {})),
    [`By the way, Example, do you like jokes? ${studioChristmasJokes[0]}`]);
});
