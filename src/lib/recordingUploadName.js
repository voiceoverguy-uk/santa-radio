export function recordingUploadName(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, '-') : '';
}
