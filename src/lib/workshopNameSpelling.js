const normaliseSpelling = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ');

export function validateWorkshopSpelling(value) {
  const name = normaliseSpelling(value);
  if (!name) return 'Enter the spelling you would like, or choose Cancel to keep the recorded spelling.';
  if (name.length > 80) return 'Please keep the name to 80 characters or fewer.';
  if (!/^\p{L}[\p{L}\p{M} '’‘-]*$/u.test(name)) {
    return 'Use letters, spaces, apostrophes or hyphens for the name, without filename symbols.';
  }
  return '';
}

export function getWorkshopWrittenName(recordedName, spelling) {
  return spelling && !validateWorkshopSpelling(spelling) ? normaliseSpelling(spelling) : recordedName;
}

export function getWorkshopDownloadName(recordedName, spelling) {
  return `santa-message-for-${getWorkshopWrittenName(recordedName, spelling)}.mp3`;
}
