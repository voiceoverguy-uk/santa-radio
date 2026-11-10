import { responseLibraries, resolveLetterGroup, createStudioLetterVariation,
  letterSignoffs } from './studioLetterResponses.js';
import { letterNarratives, detailIntroductions, letterReminders, letterPostscripts } from './studioLetterNarratives.js';
import { studioChristmasJokes } from './studioChristmasJokes.js';
import { compactLetterResponses, compactLetterNarratives } from './studioLetterCompact.js';
export { createStudioLetterVariation } from './studioLetterResponses.js';

// Public-safe display labels verified against the hosted Studio inventory.
// This deliberately contains no recording paths, IDs, or gated API calls.
export const studioLetterChoices = {
  activity: ['art', 'ballet', 'bike riding', 'building Lego'],
  achievement: ['being brave', 'completing a jigsaw puzzle', 'helping others', 'finishing your homework on time'],
  destination: ['England', 'Scotland', 'Ireland', 'Wales'],
  treats: ['a beautiful note', 'a bowl of porridge', 'a box of shortbread', 'carrots for the reindeer'],
};

// Public promotional examples only. These are not questionnaire defaults or
// saved recipient details; each field mirrors information in a named sample.
export const studioPromotionalSampleProfiles = {
  Harry: {
    age: 10, talent: 'golf', effort: 'helping around the house',
    achievement: 'doing well at sports day', treat: 'carrots for the reindeer',
    place: 'the Isle of Anglesey', activityGroup: 'target', treatGroup: 'reindeer',
  },
  Edward: {
    age: 10, talent: 'running', effort: 'keeping active and healthy',
    achievement: 'patience with siblings', treat: 'carrot cake',
    place: null, activityGroup: 'movement', treatGroup: 'food',
  },
  Arabella: {
    age: 10, talent: 'singing', effort: 'baking and cooking',
    achievement: 'helping cook dinner', treat: 'a glass of wine',
    place: null, activityGroup: 'music', treatGroup: 'alcohol',
  },
  Charlotte: {
    age: 10, talent: 'athletics', effort: 'arts and crafts',
    achievement: 'reading your first book', treat: 'hot mulled cider',
    place: null, activityGroup: 'movement', treatGroup: 'drink',
  },
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
  const introduction = category => category === 'destination' && groups.destination.regional
    ? `My route: ${details.destination}.`
    : choose(detailIntroductions[category], `${category}Intro`)(details[category]);
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
  const compactParagraphs = [...paragraphs];
  for (const [role, index] of [['workshop', 1], ['departure', 4], ['atmosphere', 8]]) {
    compactParagraphs[index] = choose(compactLetterNarratives[role][adult ? 'adult' : 'family'], role);
  }
  for (const [category, index] of [['age', 2], ['activity', 3], ['achievement', 5], ['treats', 7]]) {
    const introductionText = category === 'age'
      ? paragraphs[2].slice(0, paragraphs[2].length - response('age').length).trim()
      : introduction(category);
    compactParagraphs[index] = `${introductionText} ${compactLetterResponses[category][groups[category].group]}`;
  }
  // The greeting already carries the complete chosen name. For overflow cases,
  // avoid repeating a long name in both encouragement and joke setup; the full
  // personalisation and wording remain unchanged in the normal version.
  const compactReminder = compactParagraphs[9].replace(`Now, ${name}, `, '');
  compactParagraphs[9] = `${compactReminder[0].toUpperCase()}${compactReminder.slice(1)}`;
  compactParagraphs[10] = compactParagraphs[10]
    .replace(`By the way, ${name}, do you like jokes? `, 'For a Christmas joke: ');
  return { name, age, ...details, paragraphs, compactParagraphs,
    editorialReview: Object.entries(groups).filter(([, context]) => context.needsReview).map(([category]) => category),
    closing: ['The North Pole', choose(letterPostscripts, 'postscript')] };
}

export function createStudioPromotionalSampleLetter(name, profile, random = Math.random) {
  if (!profile || !Number.isInteger(profile.age) || typeof profile.talent !== 'string'
    || typeof profile.effort !== 'string' || typeof profile.achievement !== 'string'
    || typeof profile.treat !== 'string' || !(profile.place === null || typeof profile.place === 'string')) {
    throw new TypeError('A complete promotional Studio sample profile is required');
  }
  const destination = profile.place || 'no destination supplied';
  const letter = createStudioLetter(name, random, {
    age: `${profile.age} years old`,
    activity: profile.talent,
    achievement: profile.achievement,
    destination,
    treats: profile.treat,
    context: {
      activity: { group: profile.activityGroup },
      achievement: { group: 'neutral' },
      destination: { group: 'neutral' },
      treats: { group: profile.treatGroup },
    },
  });
  const paragraphs = [...letter.paragraphs];
  const compactParagraphs = [...letter.compactParagraphs];
  const replace = (index, text) => {
    paragraphs[index] = text;
    compactParagraphs[index] = text;
  };
  replace(3, `You have been trying hard at ${profile.effort}, and you have a real talent for ${profile.talent}.`);
  replace(5, `I have made a note of “${profile.achievement}”; it deserves a Christmas cheer.`);
  replace(6, profile.place
    ? `I have noted ${profile.place} in my travel book.`
    : 'I have left the destination blank rather than guess.');
  if (profile.treatGroup === 'alcohol') {
    replace(7, 'A glass of wine is an adults-only offering. It is not for children or reindeer, and I shall not drink it while I am flying; it must wait until my duties are finished.');
  } else if (profile.treatGroup === 'drink') {
    replace(7, 'Hot mulled cider sounds warming. A grown-up should check the ingredients and make sure any cup for a child is alcohol-free; I shall save my own until the sleigh is parked.');
  }
  return {
    ...letter,
    age: profile.age,
    activity: profile.talent,
    achievement: profile.achievement,
    destination: profile.place,
    treats: profile.treat,
    talent: profile.talent,
    effort: profile.effort,
    paragraphs,
    compactParagraphs,
  };
}

export const CERTIFICATE_WRITE_MS = 1800;
export const LETTER_CHARACTER_MS = 2;
export const SIGNATURE_WRITE_MS = 1400;
export const GIFT_EXAMPLE_INTERVAL_MS = 10000;
export const letterBodyDuration = letter => letter.paragraphs.join('').length * LETTER_CHARACTER_MS;
export const letterDuration = letter => CERTIFICATE_WRITE_MS + letterBodyDuration(letter) + SIGNATURE_WRITE_MS;
