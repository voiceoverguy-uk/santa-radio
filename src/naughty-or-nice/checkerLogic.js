import { isBlockedName, BLOCKED_NAME_NOTE } from '../lib/nameLanguage.js';
import { OPENING_GROUPS, FUN_GROUPS } from './checkerQuestions.js';

export const CHECKER_PATH = '/naughty-or-nice-list-checker';
// Reveal during the final glisten, without trimming the supplied MP3s.
export const REVEAL_LEAD_MS = 300;
export const CERTIFICATE_REVEAL_LEAD_MS = 1200;
export const RESULT_CLIP_MS = { nice: 8412, naughty: 7968 };
export const resultAnalysisMs = result => RESULT_CLIP_MS[result] - CERTIFICATE_REVEAL_LEAD_MS;
export const ANALYSIS_MS = resultAnalysisMs('nice');
export const HOMEPAGE_CHECKING_CLIP_MS = 6060;
export const HOMEPAGE_ANALYSIS_MS = HOMEPAGE_CHECKING_CLIP_MS - REVEAL_LEAD_MS;
export const CHECKER_LAUNCH_MS = 500;
export const ROUND_QUESTION_COUNT = 10;
export const ALL_NO_PROMPTS = [
  'I think we all know...',
  'I’m sure we don’t need to ask…',
  'The Head Elf may already have a hunch…',
  'Santa might have spotted a pattern…',
  'That’s quite a run of No answers…',
  'This result may not come as a surprise…',
  'Let’s see if the Head Elf is surprised…',
  'I think Santa already has his answer…',
  'The Naughty List may be expecting you…',
  'Perhaps the Nice List isn’t looking likely…',
];

export function selectAllNoPrompt(random = Math.random) {
  return ALL_NO_PROMPTS[Math.floor(random() * ALL_NO_PROMPTS.length)];
}

function shuffled(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function selectQuestionRound(random = Math.random) {
  const opening = OPENING_GROUPS.map(({ questions }) =>
    questions[Math.floor(random() * questions.length)]);
  const extraGroups = new Set(shuffled(FUN_GROUPS, random).slice(0, 2));
  const fun = FUN_GROUPS.flatMap(group =>
    shuffled(group.questions, random).slice(0, extraGroups.has(group) ? 2 : 1));
  return [...opening, ...shuffled(fun, random)];
}

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
  if (!Array.isArray(answers) || answers.length !== ROUND_QUESTION_COUNT ||
      !Array.from(answers).every(answer => answer === 'yes' || answer === 'no'))
    return null;
  return answers.filter(answer => answer === 'no').length >= 6 ? 'naughty' : 'nice';
}

// Router history state can be serialised to disk by browsers. Use a single-use,
// in-memory handoff instead: no name in history, URL, cookies or storage.
let handoff = '';
export function offerCheckerName(name) { handoff = nameError(name) ? '' : name.trim(); }
export function readCheckerName() { return handoff; }
export function clearCheckerName() { handoff = ''; }
