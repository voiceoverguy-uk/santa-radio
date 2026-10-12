// Popular-name examples with real recordings in the existing bundled library.
export const popularSantaExamples = ['Olivia', 'Harry', 'Jack', 'Freya'];

export function randomSantaExample(random = Math.random) {
  return popularSantaExamples[Math.floor(random() * popularSantaExamples.length)];
}

export function santaNamePlaceholder(example, count) {
  const prompt = `Start typing, eg. ${example}`;
  if (!Number.isSafeInteger(count) || count < 0) return prompt;
  const total = count.toLocaleString('en-GB');
  return `${prompt}, ${count ? 'over ' : ''}${total} ${count === 1 ? 'name' : 'names'} available`;
}
