import { createStudioLetter } from '../../src/lib/santaStudioLetter.js';
import { letterNarratives, letterReminders, letterPostscripts, detailIntroductions } from '../../src/lib/studioLetterNarratives.js';
import { responseLibraries, resolveLetterGroup, letterSignoffs } from '../../src/lib/studioLetterResponses.js';
import { studioChristmasJokes } from '../../src/lib/studioChristmasJokes.js';
import { studioEditorialContext } from '../../server/studio-letter-editorial.js';
import { workshopTreatWording } from '../../src/lib/workshopTreatWording.js';

// Each paragraph's choices are independent. Maximise wrapped lines per slot,
// rather than character counts or a small sample of whole-letter combinations.
export function spacingCandidates(catalogue, name, age) {
  const regional = Object.values(catalogue.regionalGroups).flatMap(group => {
    const parent = catalogue.categories.place.find(record => record.id === group.parentId);
    return group.records.map(record => ({ ...record, label: `${record.label}, ${parent.label}` }));
  });
  const records = { ...catalogue.categories, place: [...catalogue.categories.place, ...regional,
    ...['California', 'East Riding of Yorkshire'].map(label => ({
      label, letterContext: studioEditorialContext('place', { label }),
    }))] };
  const mapping = { age: 'age', activity: 'activity', achievement: 'achievement', treat: 'treats', place: 'destination' };
  const value = (category, record) => category === 'treat' ? workshopTreatWording(record.label)
    : category === 'place' ? record.label.replace(/ — (?:Fantasy place|Space destination)$/, '') : record.label;
  const initial = Object.fromEntries(Object.entries(mapping).map(([category, field]) =>
    [field, value(category, records[category][0])]));
  initial.age = age;
  initial.context = Object.fromEntries(Object.entries(mapping).map(([category, field]) =>
    [field, field === 'age' ? undefined : records[category][0].letterContext]));
  const base = createStudioLetter(name, () => 0, initial);
  const paragraphs = base.paragraphs.map(text => [text]);
  const add = (paragraph, details, variation) =>
    paragraphs[paragraph].push(createStudioLetter(name, () => 0, details, variation).paragraphs[paragraph]);
  const adult = ['18 years old', '50 years old'].includes(age);
  for (const [role, paragraph] of [['workshop', 1], ['departure', 4], ['atmosphere', 8]]) {
    const variants = letterNarratives[role][adult ? 'adult' : 'family'];
    variants.forEach((_, i) => add(paragraph, initial, { [role]: (i + .1) / variants.length }));
  }
  for (const [category, field, paragraph] of [['age', 'age', 2], ['activity', 'activity', 3],
    ['achievement', 'achievement', 5], ['place', 'destination', 6], ['treat', 'treats', 7]]) {
    const options = category === 'age' ? records.age.filter(record =>
      resolveLetterGroup('age', record.label).group === resolveLetterGroup('age', age).group) : records[category];
    if (!options.length) options.push({ label: age, letterContext: { group: 'neutral', needsReview: true } });
    for (const record of options) {
      const context = record.letterContext;
      const variants = context.passages || responseLibraries[field][context.group];
      const details = { ...initial, [field]: value(category, record),
        context: { ...initial.context, [field]: context } };
      variants.forEach((_, i) => {
        const intros = detailIntroductions[field]?.length || 1;
        for (let j = 0; j < intros; j++) add(paragraph, details, {
          [field]: (i + .1) / variants.length, [`${field}Intro`]: (j + .1) / intros,
        });
      });
    }
  }
  const reminderBand = adult ? 'adult' : age.includes('month') ? 'months' : 'family';
  letterReminders[reminderBand].forEach((_, i) =>
    add(9, initial, { reminder: (i + .1) / letterReminders[reminderBand].length }));
  studioChristmasJokes.forEach((_, i) =>
    add(10, initial, { joke: (i + .1) / studioChristmasJokes.length }));
  letterSignoffs.forEach((_, i) => add(11, initial, { signoff: (i + .1) / letterSignoffs.length }));
  return { base, paragraphs: paragraphs.map(options => [...new Set(options)]),
    closing: [['The North Pole'], letterPostscripts] };
}
