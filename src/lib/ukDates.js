export const ukDateFields = { day: '2-digit', month: '2-digit', year: 'numeric' };
const ukDate = new Intl.DateTimeFormat('en-GB', { ...ukDateFields, timeZone: 'Europe/London' });
const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const ukDateTime = new Intl.DateTimeFormat('en-GB', { ...ukDateFields, ...clock, timeZone: 'Europe/London' });
const utcDateTime = new Intl.DateTimeFormat('en-GB', { ...ukDateFields, ...clock, second: '2-digit', timeZone: 'UTC' });

function display(value, formatter) {
  if (value == null || value === '') return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatter.format(date) : '';
}

export function formatUkDate(value) {
  // A reporting day already belongs to its source calendar (including Apple's Pacific dates).
  const day = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? `${day[3]}/${day[2]}/${day[1]}` : display(value, ukDate);
}

export function formatUkDateTime(value) {
  return display(value, ukDateTime);
}

export function formatUtcDateTime(value) {
  return display(value, utcDateTime);
}
