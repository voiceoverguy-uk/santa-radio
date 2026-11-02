import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { letterNarratives, detailIntroductions, letterPostscripts, letterReminders } from '../src/lib/studioLetterNarratives.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';
import { studioEditorialContext } from '../server/studio-letter-editorial.js';
import { destinationPassages } from '../server/studio-destination-passages.js';

const details = age => ({
  age, activity: 'Art', achievement: 'Being brave', destination: 'Canada', treats: 'smelly socks',
  context: {
    activity: studioEditorialContext('activity', { label: 'Art' }),
    achievement: studioEditorialContext('achievement', { label: 'Being brave' }),
    destination: studioEditorialContext('place', { label: 'Canada' }),
    treats: studioEditorialContext('treat', { label: 'Smelly socks' }),
  },
});
const roles = { workshop: 1, departure: 4, atmosphere: 8 };
test('120 substantive distinct complete scenes, each within the reviewed 30–45 word range', () => {
  const all = [];
  for (const [role, bands] of Object.entries(letterNarratives)) {
    assert.deepEqual(Object.keys(bands), ['family', 'adult']);
    for (const passages of Object.values(bands)) {
      assert.equal(passages.length, 20);
      for (const passage of passages) {
        assert.ok(passage.split(/\s+/).length >= 30 && passage.split(/\s+/).length <= 45);
        assert.match(passage, /[.!?]$/);
        assert.doesNotMatch(passage, /\b(your (?:home|parents|children|job)|go to bed|good boy|good girl|you must)\b/i);
        all.push(passage);
      }
    }
    assert.ok(roles[role]);
  }
  assert.equal(all.length, 120);
  assert.equal(new Set(all).size, 120);
});

test('every scene is reachable only in its eligible age bands, with no runtime removal', () => {
  for (const age of ['0 months old', '2 years old', '10 years old', '17 years old', '18 years old', '50 years old', 'Unknown']) {
    const band = ['18 years old', '50 years old'].includes(age) ? 'adult' : 'family';
    for (let index = 0; index < 20; index++) {
      const variation = createStudioLetterVariation(() => (index + .1) / 20);
      const letter = createStudioLetter('Invented Example', () => 0, details(age), variation);
      for (const [role, paragraph] of Object.entries(roles)) {
        assert.equal(letter.paragraphs[paragraph], letterNarratives[role][band][index]);
      }
      assert.equal(letter.paragraphs.length, 12);
      assert.equal(letter.closing.length, 2);
      assert.ok(letter.paragraphs[7].includes('smelly socks'));
      assert.ok(letter.paragraphs[7].match(/nose|spectacles/));
      if (band === 'adult') assert.doesNotMatch(letter.paragraphs.join(' '), /golden star|go to bed|good (boy|girl)/i);
    }
  }
});

test('all introduction, reminder and postscript alternatives compose grammatically', () => {
  for (const [field, introductions] of Object.entries(detailIntroductions)) {
    for (const introduction of introductions) {
      const sentence = introduction('Selected value');
      assert.ok(sentence.includes('Selected value'));
      assert.match(sentence, /[.!?]$/);
      assert.ok(field);
    }
  }
  for (let i = 0; i < 3; i++) {
    for (const [age, band] of [['1 month old', 'months'], ['17 years old', 'family'], ['18 years old', 'adult']]) {
      const letter = createStudioLetter('Example', () => 0, details(age), createStudioLetterVariation(() => (i + .1) / 3));
      assert.equal(letter.paragraphs[9], `Now, Example, ${letterReminders[band][i]}`);
      assert.equal(letter.closing[1], letterPostscripts[i]);
    }
  }
});

test('all priority selections have eight dedicated passages; Ireland is not a UK alias', () => {
  for (const label of ['England', 'Scotland', 'Wales', 'Northern Ireland', 'United States', 'Germany', 'France', 'Canada']) {
    const context = studioEditorialContext('place', { label });
    assert.equal(context.passages.length, 8, label);
    assert.equal(new Set(context.passages).size, 8);
    for (const [i, passage] of context.passages.entries()) {
      assert.match(passage, /imaginar|fictional|pretend|make-believe/);
      const selected = { ...details('50 years old'), destination: label,
        context: { ...details('').context, destination: context } };
      const letter = createStudioLetter('Example', () => 0, selected, { destination: (i + .1) / 8 });
      assert.ok(letter.paragraphs[6].includes(passage));
      assert.ok(letter.paragraphs[6].includes(label));
    }
  }
  assert.notDeepEqual(destinationPassages.ireland, destinationPassages['northern ireland']);
  assert.equal(studioEditorialContext('place', { label: 'United Kingdom' }).needsReview, true);
  for (const [label, passages] of Object.entries(destinationPassages)) {
    assert.deepEqual(studioEditorialContext('place', { label }).passages, passages, label);
  }
});

test('new region wording remains named, neutral and flagged, without client inventory imports', () => {
  for (const destination of ['California', 'East Riding of Yorkshire', 'A newly recorded place']) {
    const context = studioEditorialContext('place', { label: destination });
    assert.deepEqual(context, { group: 'neutral', needsReview: true });
    const letter = createStudioLetter('Example', () => 0, { ...details('18 years old'), destination,
      context: { ...details('').context, destination: context } });
    assert.ok(letter.paragraphs[6].includes(destination));
    assert.ok(letter.editorialReview.includes('destination'));
    assert.match(letter.paragraphs[6], /No guessing/);
  }
  for (const file of ['santaStudioLetter.js', 'studioLetterResponses.js', 'studioLetterNarratives.js', 'studioPublicDestinations.js']) {
    assert.doesNotMatch(readFileSync(`src/lib/${file}`, 'utf8'), /server\/|studio-destination-passages|\.wav|\.mp3|https:\/\//);
  }
});

test('independently varying slots do not reshuffle other authored content', () => {
  const variation = createStudioLetterVariation(() => .42);
  const initial = createStudioLetter('Example', () => 0, details('50 years old'), variation);
  for (const [slot, paragraph] of Object.entries(roles)) {
    const next = createStudioLetter('Example', () => 0, details('50 years old'), { ...variation, [slot]: .99 });
    initial.paragraphs.forEach((text, i) => i === paragraph ? assert.notEqual(next.paragraphs[i], text) : assert.equal(next.paragraphs[i], text));
  }
});
