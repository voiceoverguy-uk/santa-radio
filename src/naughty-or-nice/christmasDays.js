const ukCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric',
});

// Count UK calendar dates, not remaining 24-hour periods or the visitor's timezone.
export function daysUntilChristmas(now = new Date()) {
  const parts = ukCalendar.formatToParts(now);
  const value = type => Number(parts.find(part => part.type === type).value);
  const year = value('year');
  const today = Date.UTC(year, value('month') - 1, value('day'));
  let christmas = Date.UTC(year, 11, 25);
  if (today > christmas) christmas = Date.UTC(year + 1, 11, 25);
  return Math.round((christmas - today) / 86400000);
}
