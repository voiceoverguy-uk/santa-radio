import { responseLibraries, resolveLetterGroup, createStudioLetterVariation,
  letterSignoffs } from './studioLetterResponses.js';
import { letterNarratives, detailIntroductions, letterReminders, letterPostscripts } from './studioLetterNarratives.js';
import { studioChristmasJokes } from './studioChristmasJokes.js';
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
  const response = category => choose(category === 'destination' && groups.destination.passages
    ? groups.destination.passages : responseLibraries[category][groups[category].group], category);
  const adult = ['adult', 'eighteen'].includes(groups.age.group);
  const narrative = role => choose(letterNarratives[role][adult ? 'adult' : 'family'], role);
  const introduction = category => choose(detailIntroductions[category], `${category}Intro`)(details[category]);
  const reminderBand = groups.age.group === 'months' ? 'months' : adult ? 'adult' : 'family';
  const reminder = `Now, ${name}, ${choose(letterReminders[reminderBand], 'reminder')}`;
  const paragraphs = [
    `Dear ${name},`,
    narrative('workshop'),
    `${groups.age.needsReview ? `My age entry reads “${age}”.` : `You are ${typeof age === 'number' ? `${age} years old` : age}.`} ${response('age')}`,
    `${introduction('activity')} ${response('activity')}`,
    narrative('departure'),
    `${introduction('achievement')} ${response('achievement')}`,
    `${introduction('destination')} ${response('destination')}`,
    `${introduction('treats')} ${response('treats')}`,
    narrative('atmosphere'),
    reminder,
    `By the way, ${name}, do you like jokes? ${choose(studioChristmasJokes, 'joke')}`,
    choose(letterSignoffs, 'signoff'),
  ];
  return { name, age, ...details, paragraphs,
    editorialReview: Object.entries(groups).filter(([, context]) => context.needsReview).map(([category]) => category),
    closing: ['The North Pole', choose(letterPostscripts, 'postscript')] };
}

export const CERTIFICATE_WRITE_MS = 1800;
export const LETTER_CHARACTER_MS = 2;
export const SIGNATURE_WRITE_MS = 1400;
export const GIFT_EXAMPLE_INTERVAL_MS = 10000;
export const letterBodyDuration = letter => letter.paragraphs.join('').length * LETTER_CHARACTER_MS;
export const letterDuration = letter => CERTIFICATE_WRITE_MS + letterBodyDuration(letter) + SIGNATURE_WRITE_MS;
