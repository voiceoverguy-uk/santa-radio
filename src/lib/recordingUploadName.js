export function recordingUploadName(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().toLocaleLowerCase('en-GB').replace(/\s+/gu, '-') : '';
}
