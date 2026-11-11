import { databasePool } from './name-request-store.js';

// Count only retained send acknowledgements; never infer delivery or query a provider.
export async function websiteEmailStatistics({pool = databasePool} = {}) {
  const count = async sql => {
    try {
      const {rows:[row]} = await pool().query(sql);
      return Number.isSafeInteger(row?.count) && row.count >= 0 ? row.count : null;
    } catch { return null; }
  };
  const [studioAccess, nameUpdates] = await Promise.all([
    count("SELECT count(*)::integer AS count FROM santa_studio_live_email WHERE sent_at >= now()-interval '30 days'"),
    count("SELECT count(*)::integer AS count FROM santa_name_request_notifications WHERE state='sent' AND sent_at >= now()-interval '30 days'"),
  ]);
  return {days:30, studioAccess, nameUpdates,
    total:studioAccess === null || nameUpdates === null ? null : studioAccess + nameUpdates};
}
