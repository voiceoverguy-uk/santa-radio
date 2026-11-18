const ukDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', month: 'numeric', day: 'numeric',
});

export function nameRequestsOpen(now = new Date()) {
  const parts = ukDate.formatToParts(now);
  const month = Number(parts.find(part => part.type === 'month').value);
  const day = Number(parts.find(part => part.type === 'day').value);
  return month >= 10 && (month < 12 || day < 25);
}

export const NAME_REQUESTS_CLOSED = 'New name requests reopen on 1 October. You can still choose from Santa’s existing recorded names all year.';
