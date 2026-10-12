const REQUESTED_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u;

export function normaliseRequestedName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').replace(/[’‘]/g, "'").trim().replace(/\s+/gu, ' ');
  if (!name || name.length > 80 || !REQUESTED_NAME_PATTERN.test(name)) return null;
  return { name, key: name.toLocaleLowerCase('en-GB') };
}

export function nameRequestConfirmation(date = new Date()) {
  const afterNovember = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', month: 'numeric' }).format(date)) === 12;
  return afterNovember
    ? 'Your request has been saved. Check back in a couple of days to see if Santa has added it.'
    : 'Your request has been saved. Check back in a week to see if Santa has added it.';
}
