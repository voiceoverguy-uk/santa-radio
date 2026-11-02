import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioLetter } from '../src/lib/santaStudioLetter.js';

const chosen = {
  age: '3 months old',
  activity: 'Playing a musical instrument',
  achievement: 'Starting nursery',
  destination: 'Andorra',
  treats: 'an energy drink',
};
test('Studio letter reflects every selected choice without random replacements', () => {
  const letter = createStudioLetter('Arabella', () => { throw new Error('No random review choices'); }, chosen);
  const text = letter.paragraphs.join('\n');
  assert.match(text, /Dear Arabella,/);
  assert.match(text, /Now, Arabella,/);
  for (const [key, value] of Object.entries(chosen)) {
    assert.equal(letter[key], value);
    assert.ok(text.includes(value));
  }
});
test('written spelling changes the letter without mutating selected details', () => {
  const original = JSON.stringify(chosen);
  assert.equal(createStudioLetter('Arabelle', () => 0, chosen).name, 'Arabelle');
  assert.equal(JSON.stringify(chosen), original);
});
test('incomplete review details cannot silently become invented choices', () => {
  for (const key of Object.keys(chosen)) {
    assert.throws(() => createStudioLetter('Arabella', () => 0.5, { ...chosen, [key]: '' }), TypeError);
  }
});
test('homepage keeps its existing demo defaults', () => {
  const letter = createStudioLetter('Freya', () => 0.5);
  assert.equal(letter.age, 7);
  assert.equal(letter.activity, 'bike riding');
  assert.equal(letter.achievement, 'helping others');
  assert.equal(letter.destination, 'Ireland');
  assert.equal(letter.treats, 'a box of shortbread');
});
