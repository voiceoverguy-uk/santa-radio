import { isBlockedName, BLOCKED_NAME_NOTE } from '../lib/nameLanguage.js';

export const CHECKER_PATH = '/naughty-or-nice-list-checker';
// Reveal during the final glisten, without trimming the supplied MP3s.
export const REVEAL_LEAD_MS = 300;
export const CERTIFICATE_REVEAL_LEAD_MS = 1200;
export const RESULT_CLIP_MS = { nice: 8412, naughty: 7968 };
export const resultAnalysisMs = result => RESULT_CLIP_MS[result] - CERTIFICATE_REVEAL_LEAD_MS;
export const ANALYSIS_MS = resultAnalysisMs('nice');
export const HOMEPAGE_CHECKING_CLIP_MS = 4519;
export const HOMEPAGE_ANALYSIS_MS = HOMEPAGE_CHECKING_CLIP_MS - REVEAL_LEAD_MS;
export const CHECKER_LAUNCH_MS = 500;
export const QUESTIONS = [
  'Have you been nice?',
  'Do you help others?',
  'Have you tried hard at school or work?',
  'Are you polite?',
  'Do you behave in the supermarket?',
  'Do you try to go to bed when it’s bedtime?',
  'Do you say please and thank you?',
  'Do you share and take turns?',
  'Do you help tidy up?',
  'Do you say sorry when you make a mistake?',
];

export function nameError(value) {
  if (isBlockedName(value)) return BLOCKED_NAME_NOTE;
  const name = value.trim();
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'’ -]{0,79}$/u.test(name) || !/\p{L}/u.test(name))
    return 'Please enter a first name using letters, spaces, apostrophes or hyphens.';
  return '';
}

export function preliminaryScore(random = Math.random) {
  return 51 + Math.min(22, Math.max(0, Math.floor(random() * 23)));
}

export function classifyAnswers(answers) {
  if (answers.length !== QUESTIONS.length || answers.some(answer => answer !== 'yes' && answer !== 'no'))
    return null;
  return answers.filter(answer => answer === 'no').length >= 6 ? 'naughty' : 'nice';
}

// Router history state can be serialised to disk by browsers. Use a single-use,
// in-memory handoff instead: no name in history, URL, cookies or storage.
let handoff = '';
export function offerCheckerName(name) { handoff = nameError(name) ? '' : name.trim(); }
export function readCheckerName() { return handoff; }
export function clearCheckerName() { handoff = ''; }
