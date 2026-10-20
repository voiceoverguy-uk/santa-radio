// Search equivalence is deliberately separate from recording identity.
export const santaNameKey = value => value.normalize('NFC').trim()
  .toLocaleLowerCase('en-GB').replace(/’/g, "'");
