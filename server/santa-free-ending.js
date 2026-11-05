// Public clients continue to request 1 or 2. Only the server can select nov.
const ukMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', month: '2-digit',
});

export function resolveFreeEnding(requested, date = new Date()) {
  if (requested !== 1 && requested !== 2) throw new RangeError('Invalid Santa outro.');
  return ukMonth.format(date) === '11' ? 'nov' : requested;
}
