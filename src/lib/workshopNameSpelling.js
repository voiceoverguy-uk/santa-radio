import { containsWorkshopProfanity, WORKSHOP_LANGUAGE_ERROR } from './workshopSpellingLanguage.js';

export const WORKSHOP_SPELLING_MAX_LENGTH = 80;
const normaliseSpelling = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ');

export function validateWorkshopSpelling(value) {
  const name = normaliseSpelling(value);
  if (!name) return 'Enter the spelling you would like, or choose Cancel to keep the recorded spelling.';
  if (containsWorkshopProfanity(name)) return WORKSHOP_LANGUAGE_ERROR;
  if (name.length > WORKSHOP_SPELLING_MAX_LENGTH) return `Please keep the name to ${WORKSHOP_SPELLING_MAX_LENGTH} characters or fewer.`;
  if (!/^\p{L}[\p{L}\p{M} &’‘'-]*$/u.test(name)) {
    return 'Use letters, spaces, ampersands (&), apostrophes or hyphens for the name, without filename symbols.';
  }
  return '';
}

export function getWorkshopWrittenName(recordedName, spelling) {
  return spelling && !validateWorkshopSpelling(spelling) ? normaliseSpelling(spelling) : recordedName;
}

export function getWorkshopDownloadName(recordedName, spelling) {
  return `santa-message-for-${getWorkshopWrittenName(recordedName, spelling)}.mp3`;
}
