export const HISTORY_KEY = 'santa-video-stitcher-history-v1';
export const HISTORY_LIMIT = 20;
export function validHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(row => row && typeof row.name === 'string' && typeof row.bells === 'boolean'
    && Number.isFinite(row.stitchingMs) && row.stitchingMs >= 0
    && Number.isFinite(row.totalMs) && row.totalMs >= row.stitchingMs)
    .slice(-HISTORY_LIMIT).map(row => ({ name: row.name.slice(0, 160), bells: row.bells,
      stitchingMs: row.stitchingMs, totalMs: row.totalMs, nameCaption: typeof row.nameCaption === 'string' ? row.nameCaption.slice(0, 80) : '' }));
}
export function averageTimes(rows) {
  const count = rows.length;
  return { count,
    stitchingMs: count ? rows.reduce((sum, row) => sum + row.stitchingMs, 0) / count : null,
    totalMs: count ? rows.reduce((sum, row) => sum + row.totalMs, 0) / count : null };
}
