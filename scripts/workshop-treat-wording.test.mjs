import test from 'node:test';
import assert from 'node:assert/strict';
import { workshopTreatPhrases, workshopTreatWording } from '../src/lib/workshopTreatWording.js';

test('all 96 reviewed treat phrases have non-empty, stable wording', () => {
  assert.equal(Object.keys(workshopTreatPhrases).length, 96);
  for (const [label, phrase] of Object.entries(workshopTreatPhrases)) {
    assert.equal(workshopTreatWording(label), phrase);
    assert.equal(workshopTreatWording(label.toLocaleUpperCase('en-GB')), phrase);
    assert.ok(phrase.trim());
    assert.doesNotMatch(phrase, /^(a|an)\s+(a|an|some|your)\s/i);
  }
});

test('countable items and containers use a or an, not the final word or letter', () => {
  for (const [label, phrase] of [
    ['Christmas cracker', 'a Christmas cracker'],
    ['Christmas cookie', 'a Christmas cookie'],
    ['Energy drink', 'an energy drink'],
    ['Bag of nuts', 'a bag of nuts'],
    ['Glass of wine', 'a glass of wine'],
    ['Box of shortbread', 'a box of shortbread'],
    ['Cup of tea', 'a cup of tea'],
    ['Hot water bottle', 'a hot water bottle'],
    ['Bûche de Noël', 'a bûche de Noël'],
    ['Glass milk', 'a glass of milk'],
    ['Slice cake', 'a slice of cake'],
  ]) assert.equal(workshopTreatWording(label), phrase);
});

test('plurals, mass nouns and existing determiners do not gain an article', () => {
  for (const [label, phrase] of [
    ['Cupcakes', 'cupcakes'], ['Macarons', 'macarons'], ['Sunglasses', 'sunglasses'],
    ['Cheese', 'cheese'], ['Hot chocolate', 'hot chocolate'], ['Coconut milk', 'coconut milk'],
    ['Milk and a candy cane', 'milk and a candy cane'], ['Some carrots', 'some carrots'],
    ['Your rubbish', 'your rubbish'], ['Lots of chocolate', 'lots of chocolate'],
    ['Santa’s sake', 'Santa’s sake'],
  ]) assert.equal(workshopTreatWording(label), phrase);
});

test('blank choices stay blank and unreviewed choices are not guessed or double-prefixed', () => {
  for (const label of ['', ' ', null, undefined]) assert.equal(workshopTreatWording(label), '');
  for (const label of ['A biscuit', 'An apple', 'New treat']) assert.equal(workshopTreatWording(label), label);
});
