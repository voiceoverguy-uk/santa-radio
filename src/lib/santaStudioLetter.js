import { responseLibraries, resolveLetterGroup, createStudioLetterVariation,
  letterOpenings, letterFarewells, letterSignoffs } from './studioLetterResponses.js';
export { createStudioLetterVariation } from './studioLetterResponses.js';

// Public-safe display labels verified against the hosted Studio inventory.
// This deliberately contains no recording paths, IDs, or gated API calls.
export const studioLetterChoices = {
  activity: ['art', 'ballet', 'bike riding', 'building Lego'],
  achievement: ['being brave', 'completing a jigsaw puzzle', 'helping others', 'finishing your homework on time'],
  destination: ['England', 'Scotland', 'Ireland', 'Wales'],
  treats: ['a beautiful note', 'a bowl of porridge', 'a box of shortbread', 'carrots for the reindeer'],
};

export function createStudioLetter(name, random = Math.random, overrides = null, variation = null) {
  const pick = values => values[Math.floor(random() * values.length)];
  const details = overrides
    ? Object.fromEntries(Object.keys(studioLetterChoices).map(key => {
      if (typeof overrides[key] !== 'string' || !overrides[key].trim()) {
        throw new TypeError(`Missing selected Studio letter detail: ${key}`);
      }
      return [key, overrides[key].trim()];
    }))
    : Object.fromEntries(Object.entries(studioLetterChoices).map(([key, values]) => [key, pick(values)]));
  if (overrides && (typeof overrides.age !== 'string' || !overrides.age.trim())) {
    throw new TypeError('Missing selected Studio letter detail: age');
  }
  const age = overrides ? overrides.age.trim() : 3 + Math.floor(random() * 9);
  // Selected-letter callers own a page-local variation. The fixed default keeps
  // pure/server callers deterministic without inventing replacement selections.
  const slots = variation || (overrides ? {} : createStudioLetterVariation(random));
  const choose = (values, slot) => values[Math.min(values.length - 1,
    Math.max(0, Math.floor((Number.isFinite(slots[slot]) ? slots[slot] : 0) * values.length)))];
  const groups = Object.fromEntries(Object.keys(responseLibraries).map(category =>
    [category, resolveLetterGroup(category, category === 'age' ? age : details[category], overrides?.context)]));
  const response = category => choose(responseLibraries[category][groups[category].group], category);
  const adult = ['adult', 'eighteen'].includes(groups.age.group);
  const reminder = groups.age.group === 'months'
    ? `Now, ${name}, remember this: this Christmas welcome asks nothing of you. You are welcome here simply as you are.`
    : adult
      ? `Now, ${name}, remember this: you do not have to earn a little joy by getting everything done. Leave some kindness for yourself too.`
      : `Now, ${name}, remember this: you do not have to get everything right to matter. Keep room for kindness, curiosity and the things you enjoy.`;
  const paragraphs = [
    `Dear ${name},`,
    choose(letterOpenings, 'opening'),
    `${groups.age.needsReview ? `My age entry reads “${age}”.` : `You are ${typeof age === 'number' ? `${age} years old` : age}.`} ${response('age')}`,
    `I have heard about your efforts with “${details.activity}”. ${response('activity')}`,
    `An extra celebration for “${details.achievement}”! ${response('achievement')}`,
    `The destination in my travel book is ${details.destination}. ${response('destination')}`,
    `Your possible offering is listed as “${details.treats}”. ${response('treats')}`,
    reminder,
    choose(letterFarewells, 'farewell'),
    choose(letterSignoffs, 'signoff'),
  ];
  return { name, age, ...details, paragraphs,
    editorialReview: Object.entries(groups).filter(([, context]) => context.needsReview).map(([category]) => category),
    closing: ['The North Pole', 'P.S. Your Nice List certificate has my seal of approval. The elves do love making things official!'] };
}

export const CERTIFICATE_WRITE_MS = 1800;
export const LETTER_CHARACTER_MS = 2;
export const SIGNATURE_WRITE_MS = 1400;
export const GIFT_EXAMPLE_INTERVAL_MS = 10000;
export const letterBodyDuration = letter => letter.paragraphs.join('').length * LETTER_CHARACTER_MS;
export const letterDuration = letter => CERTIFICATE_WRITE_MS + letterBodyDuration(letter) + SIGNATURE_WRITE_MS;
