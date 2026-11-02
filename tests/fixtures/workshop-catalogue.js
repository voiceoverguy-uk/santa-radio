import { createHash } from 'node:crypto';
import { parseWorkshopCatalogue } from '../../server/santa-workshop-catalogue.js';
import { workshopRegionalFolders } from '../../src/lib/workshopDestinations.js';

const record = (id, label, extra = {}) => ({ id, label, file: `fixture/${id}.wav`, ...extra });
// Deterministic UI fixtures; live HTTPS integration is verified separately.
export const workshopCatalogueFixture = {
  source: 'hosted',
  categories: {
    sports: [
      record(`c-${'b'.repeat(64)}`, 'Tennis', { file: 'sports/tennis.wav' }),
      record(`c-${'d'.repeat(64)}`, 'Cricket', { file: 'sports/cricket.wav' }),
    ],
    funny: [
      record(`c-${'c'.repeat(64)}`, 'Stealing the remote control', { file: 'funny/stealing the remote control.wav' }),
      record(`c-${'e'.repeat(64)}`, 'Smiling', { file: 'funny/smiling.wav' }),
    ],
    age: [
      ...Array.from({ length: 13 }, (_, number) => record(`month-${number}`, `${number} ${number === 1 ? 'month' : 'months'} old`, { number, unit: 'month' })),
      ...Array.from({ length: 50 }, (_, index) => record(`year-${index + 1}`, `${index + 1} ${index ? 'years' : 'year'} old`, { number: index + 1, unit: 'year' })),
    ],
    activity: [record('teamwork', 'Teamwork'), record('instrument', 'Playing a musical instrument')],
    achievement: [record('jigsaw', 'Completing a jigsaw puzzle'), record('garden', 'Planting and caring for a garden')],
    treat: [record('buche', 'Bûche de Noël'), record('turron', 'Turrón')],
    place: [
      record('forest', 'The Enchanted Forest — Fantasy place', { kind: 'fantasy' }),
      record('camelot', 'Camelot — Fantasy place', { kind: 'fantasy' }),
    ],
  },
  counts: { age: 63, activity: 2, achievement: 2, treat: 2, place: 2, sports: 2, funny: 2 },
  excludedAudioCounts: { age: 0, activity: 0, achievement: 0, treat: 0, place: 0, sports: 0, funny: 0 },
  needsReviewCounts: { age: 0, activity: 0, achievement: 0, treat: 0, place: 0, sports: 0, funny: 0 },
};

// Synthetic inventory only. These are not claims about live hosted availability.
const indexed = file => ({ file, bytes: 50000, id: `c-${createHash('sha256').update(file).digest('hex')}` });
export const workshopRegionalCatalogueFixture = parseWorkshopCatalogue({
  version: 1,
  categories: {
    age: [indexed('AGES/8-years-old.wav')],
    activity: [indexed('Trying Hard at/art.wav')],
    achievement: [indexed('Achievment/being-brave.wav')],
    treat: [indexed('treats/map.wav')],
    place: [...Object.values(workshopRegionalFolders).map(indexed), indexed('countries/ireland.wav')],
    ...Object.fromEntries(Object.keys(workshopRegionalFolders).map((folder, index) => [folder,
      [indexed(`${folder}/${['georgia', 'kent', 'fife', 'powys', 'antrim'][index]}.wav`),
        indexed(`${folder}/z-fixture-place.mp3`)]])),
  },
  excludedAudioCounts: Object.fromEntries(['age', 'activity', 'achievement', 'treat', 'place',
    ...Object.keys(workshopRegionalFolders)].map(key => [key, 0])),
});
