const record = (id, label, extra = {}) => ({ id, label, file: `fixture/${id}.wav`, ...extra });
// Deterministic UI fixtures; live HTTPS integration is verified separately.
export const workshopCatalogueFixture = {
  source: 'hosted',
  categories: {
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
  counts: { age: 63, activity: 2, achievement: 2, treat: 2, place: 2 },
  excludedAudioCounts: { age: 0, activity: 0, achievement: 0, treat: 0, place: 0 },
  needsReviewCounts: { age: 0, activity: 0, achievement: 0, treat: 0, place: 0 },
};
