// Search equivalence is deliberately separate from recording identity.
export const santaNameKey = value => value.normalize('NFC').trim()
  .toLocaleLowerCase('en-GB').replace(/’/g, "'");

// Presentation only: recording keys and filenames retain their original casing.
export const santaNameDisplay = value => String(value || '').replace(/(^|[\s\p{Pd}])(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase('en-GB'));
