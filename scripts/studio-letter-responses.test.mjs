import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studioEditorialContext, studioEditorialGroups } from '../server/studio-letter-editorial.js';
import { responseLibraries, resolveLetterGroup, createStudioLetterVariation } from '../src/lib/studioLetterResponses.js';
import { createStudioLetter, studioLetterChoices, letterDuration, GIFT_EXAMPLE_INTERVAL_MS } from '../src/lib/santaStudioLetter.js';
import { workshopTreatPhrases, workshopTreatWording } from '../src/lib/workshopTreatWording.js';

const base = { age: '10 years old', activity: 'Art', achievement: 'Being brave', treats: 'a beautiful note', destination: 'England' };
function selected(overrides = {}) {
  const details = { ...base, ...overrides };
  const context = Object.fromEntries([
    ['activity', 'activity'], ['achievement', 'achievement'], ['treats', 'treat'], ['destination', 'place'],
  ].map(([field, category]) => [field, studioEditorialContext(category, { label: details[field] })]));
  // Treat inputs in production have already passed through the phrase adapter.
  // Classify the ORIGINAL hosted label, then pass the selected display phrase.
  const label = Object.keys(workshopTreatPhrases).find(label => workshopTreatPhrases[label] === details.treats);
  if (label) context.treats = studioEditorialContext('treat', { label });
  return { ...details, context };
}
const text = letter => letter.paragraphs.join('\n');

test('all explicit server groups resolve to reviewed non-empty libraries, not a public fixture', () => {
  const fields = { activity: 'activity', achievement: 'achievement', treat: 'treats' };
  assert.equal(Object.keys(studioEditorialGroups.activity).length, 129); // two ambiguous labels remain neutral
  assert.equal(Object.keys(studioEditorialGroups.achievement).length, 38);
  assert.equal(Object.keys(studioEditorialGroups.treat).length, 96);
  for (const [category, labels] of Object.entries(studioEditorialGroups)) {
    for (const [label, group] of Object.entries(labels)) {
      assert.ok(responseLibraries[fields[category]][group]?.length >= 2, `${category}: ${label}`);
      assert.deepEqual(studioEditorialContext(category, { label }), { group, needsReview: false });
    }
  }
});

test('the existing 96 treat phrase adapters all have a semantic classification', () => {
  for (const label of Object.keys(workshopTreatPhrases)) {
    const { group, needsReview } = studioEditorialContext('treat', { label });
    assert.equal(needsReview, false, label);
    for (const value of [0, .9999]) {
      const details = selected({ treats: workshopTreatWording(label) });
      const letter = createStudioLetter('Robin', () => 0, details, createStudioLetterVariation(() => value));
      assert.equal(letter.treats, workshopTreatWording(label));
      assert.ok(text(letter).includes(letter.treats));
      assert.ok(responseLibraries.treats[group].some(response => text(letter).includes(response)));
      assert.ok(!letter.editorialReview.includes('treats'), label);
    }
  }
});

test('month, child, teenage and adult age boundaries use appropriate groups', () => {
  for (const [age, group] of [
    ['0 months old', 'months'], ['1 month old', 'months'], ['12 months old', 'months'],
    ['1 year old', 'young'], ['2 years old', 'young'], ['5 years old', 'young'],
    ['6 years old', 'child'], ['10 years old', 'child'], ['12 years old', 'child'],
    ['13 years old', 'teen'], ['17 years old', 'teen'], ['18 years old', 'eighteen'],
    ['19 years old', 'adult'], ['50 years old', 'adult'], ['120 years old', 'adult'],
  ]) {
    const details = selected({ age });
    assert.equal(resolveLetterGroup('age', age).group, group);
    const letter = createStudioLetter('Robin', () => 0, details);
    assert.ok(text(letter).includes(age));
    assert.ok(text(letter).includes(responseLibraries.age[group][0]));
    assert.doesNotMatch(text(letter), /already!|good (boy|girl)|little Robin|go to bed/i);
  }
  for (const age of ['121 years old', 'a mysterious age', '-1', '1.5']) {
    const letter = createStudioLetter('Robin', () => 0, selected({ age }));
    assert.ok(letter.editorialReview.includes('age'));
  }
});

test('jokes are amused, alcohol waits until after flying, and reindeer/messages/practical gifts are distinct', () => {
  const categories = [
    ['your rubbish', 'rubbish'], ['smelly socks', 'socks'], ['a lump of coal', 'coal'],
    ['carrots for reindeer', 'reindeer'], ['a packet of reindeer food', 'reindeer'],
    ['a lovely letter', 'letter'], ['a map', 'practical'], ['a Christmas cracker', 'amusement'],
    ['a glass of whisky', 'alcohol'], ['rum cake', 'rumCake'], ['an energy drink', 'energy'],
  ];
  for (const [treats, group] of categories) {
    const details = selected({ treats });
    assert.equal(details.context.treats.group, group);
    for (const response of responseLibraries.treats[group]) {
      if (['rubbish', 'socks', 'coal'].includes(group)) assert.doesNotMatch(response, /thank|thoughtful|delicious|tasty/i);
      if (group === 'alcohol') {
        assert.match(response, /adult/i);
        assert.match(response, /after|until/i);
        assert.match(response, /children.*reindeer/i);
      }
    }
  }
});

test('achievements are not birthdays; sensitive encouragement has no shame or inferred diagnosis', () => {
  for (const [label, group] of [['Being brave', 'brave'], ['Starting nursery', 'starting'], ['Learning to swim', 'swimming'],
    ['Helping your mummy', 'home'], ['Doing well in your exams', 'exams']]) {
    const letter = createStudioLetter('Robin', () => 0, selected({ achievement: label }));
    assert.ok(text(letter).includes(label));
    assert.ok(text(letter).includes(responseLibraries.achievement[group][0]));
    assert.doesNotMatch(text(letter), /birthday|better than|cured|naughty|ashamed of you/i);
  }
  for (const response of responseLibraries.activity.care) assert.match(response, /help|patience/);
});

test('real, fantasy and space routes are explicitly fictional and unknowns are flagged', () => {
  for (const [destination, group] of [['Falkland Islands', 'real'], ['Japan', 'real'], ['Yorkshire', 'real'], ['Antarctica', 'real'],
    ['Wonderland', 'fantasy'], ['The Enchanted Forest — Fantasy place', 'fantasy'], ['Mars', 'space'], ['The Moon', 'space']]) {
    assert.equal(studioEditorialContext('place', { label: destination }).group, group);
    const letter = createStudioLetter('Robin', () => 0, selected({ destination }));
    assert.ok(text(letter).includes(destination));
    for (const response of responseLibraries.destination[group]) assert.match(response, /imaginar|imagin|pretend|make-believe/i);
  }
  for (const [category, label] of [['activity', 'T-B-L'], ['activity', 'Stagecoach'], ['place', 'Somewhere new'], ['treat', 'New surprise']]) {
    assert.deepEqual(studioEditorialContext(category, { label }), { group: 'neutral', needsReview: true });
  }
  const unknown = createStudioLetter('Robin', () => 0, { age: 'Unknown age', activity: 'A new thing',
    achievement: 'An unexpected achievement', treats: 'your mystery parcel', destination: 'Somewhere new' });
  assert.deepEqual(unknown.editorialReview, ['age', 'activity', 'achievement', 'treats', 'destination']);
  assert.doesNotMatch(text(unknown), /undefined|null|a a |an an /);
});

test('stable page-local variation preserves all unaffected paragraphs when name/details change', () => {
  const variation = createStudioLetterVariation(() => .72);
  const initial = createStudioLetter('Robin', () => 0, selected(), variation);
  const renamed = createStudioLetter('Robyn', () => 0, selected(), variation);
  assert.equal(text(renamed), text(initial).replaceAll('Robin', 'Robyn'));
  for (const [field, value, changed] of [
    ['activity', 'Coding', 3], ['achievement', 'Starting school', 4],
    ['treats', 'smelly socks', 6], ['destination', 'Mars', 5],
  ]) {
    const next = createStudioLetter('Robin', () => 0, selected({ [field]: value }), variation);
    next.paragraphs.forEach((paragraph, index) => {
      if (index === changed) assert.notEqual(paragraph, initial.paragraphs[index]);
      else assert.equal(paragraph, initial.paragraphs[index], field);
    });
  }
  assert.deepEqual(createStudioLetterVariation(() => .72), variation);
  assert.notEqual(text(createStudioLetter('Robin', () => 0, selected(), createStudioLetterVariation(() => 0))),
    text(createStudioLetter('Robin', () => 0, selected(), createStudioLetterVariation(() => .999))));
});

test('all alternatives use clean punctuation, fit a conservative text budget and keep public samples public-safe', () => {
  for (const library of Object.values(responseLibraries)) {
    for (const [group, variants] of Object.entries(library)) {
      assert.equal(new Set(variants).size, variants.length, group);
      for (const response of variants) {
        assert.equal(response.trim(), response);
        assert.doesNotMatch(response, /undefined|null|[{}[\]]|  |\.wav|\.mp3|a a |an an /);
        assert.match(response, /[.!?]$/);
        assert.ok(response.length < 220);
      }
    }
  }
  for (const value of [0, .34, .67, .9999]) {
    const letter = createStudioLetter('Alexandria Rose Montgomery', () => value);
    assert.ok(letterDuration(letter) < GIFT_EXAMPLE_INTERVAL_MS);
    assert.equal(letter.editorialReview.length, 0);
    assert.ok(text(letter).length < 2400);
    for (const field of Object.keys(studioLetterChoices)) assert.ok(studioLetterChoices[field].includes(letter[field]));
  }
  const client = readFileSync('src/lib/studioLetterResponses.js', 'utf8') + readFileSync('src/lib/santaStudioLetter.js', 'utf8');
  assert.doesNotMatch(client, /studio-letter-editorial|localStorage|sessionStorage|fetch\(|https:|OpenAI/i);
});
