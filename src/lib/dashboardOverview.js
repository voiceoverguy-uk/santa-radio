const dayMs = 86400000;
export const countFormat = new Intl.NumberFormat('en-GB');
export const moneyFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export function sumField(rows, key) {
  if (!Array.isArray(rows) || rows.some(row => !Number.isFinite(row[key]))) return null;
  return rows.reduce((sum, row) => sum + row[key], 0);
}

// Some sources return newest first. Keep a calendar window even when a day is missing.
export function dailyMetric(rows, key, period, { firstTracked, average = false } = {}) {
  const ordered = (rows || []).map(row => ({ day: row.day ?? row.date, value: row[key] }))
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.day)).sort((a, b) => a.day.localeCompare(b.day));
  if (!ordered.length) return null;
  const end = ordered.at(-1).day;
  const requestedStart = new Date(Date.parse(end) - (period - 1) * dayMs).toISOString().slice(0, 10);
  const start = firstTracked && firstTracked > requestedStart ? firstTracked : requestedStart;
  const points = ordered.filter(row => row.day >= start);
  const expected = Math.round((Date.parse(end) - Date.parse(start)) / dayMs) + 1;
  const total = sumField(points, 'value');
  if (!points.length || new Set(points.map(row => row.day)).size !== expected || points.length !== expected || total === null) return null;
  return { points, start, end, value: average ? Math.round(total / points.length) : total, partial: start > requestedStart };
}

export function storeMetric(report, period) {
  const apps = report?.apps?.filter(app => app.status !== 'pending') ?? [];
  const key = period === 7 ? 'last7Days' : 'last30Days';
  const covered = apps.filter(app => Number.isFinite(app[key]));
  if (!covered.length) return null;
  return { value: sumField(covered, key), count: covered.length, total: apps.length, end: covered[0].endDate };
}
