// Radiologik exports station-local wall time without a timezone suffix.
const ukClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function parseStationTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  // UK clocks are GMT or BST. Round-trip validation rejects invalid dates and
  // the missing spring hour. The repeated autumn hour is ambiguous: don't guess.
  const candidates = [wall, wall - 3600000].filter(timestamp => {
    const parts = Object.fromEntries(ukClock.formatToParts(timestamp).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}` === value;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export function parseDuration(value) {
  if (!/^\d+(?::\d{2}){0,2}$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some(part => part > 59)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}

export function parseTrackDetails(value) {
  // Match from the right, preserving " - " inside legitimate song titles.
  const match = /^(.*?)\s+-\s+([^-\n]+?)\s+-\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/.exec(value);
  if (!match) return { title: value };
  const durationSeconds = parseDuration(match[2].trim());
  const startedAt = parseStationTime(match[3]);
  return {
    title: match[1].trim(),
    ...(durationSeconds !== null ? { durationSeconds } : {}),
    ...(startedAt !== null ? { startedAt } : {}),
  };
}
