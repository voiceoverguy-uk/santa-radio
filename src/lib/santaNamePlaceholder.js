import { popularSantaExamples } from '../data/santaPlaceholderNames.js';
export { popularSantaExamples };

export function randomSantaExample(random = Math.random) {
  return popularSantaExamples[Math.floor(random() * popularSantaExamples.length)];
}

export function santaNamePlaceholder(example) {
  return `Start typing, eg. ${example}`;
}
