const ukDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
});
export const londonDate = date => ukDate.format(date);
export function midnightUTC(date) {
  // London midnight is either 00:00 UTC or 23:00 UTC on the prior date.
  const utc = new Date(`${date}T00:00:00Z`);
  const prior = new Date(+utc - 3600000);
  return londonDate(prior) === date ? prior : utc;
}
export function yesterdayWindow(now = new Date()) {
  const today = londonDate(now);
  const date = new Date(+new Date(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(+new Date(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return { date, start: midnightUTC(date).toISOString(), end: midnightUTC(today).toISOString(),
    nextRefreshAt: midnightUTC(tomorrow).toISOString() };
}
