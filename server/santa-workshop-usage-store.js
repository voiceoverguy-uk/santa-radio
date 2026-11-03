import { databasePool } from './name-request-store.js';
import { workshopSettings } from './santa-workshop-settings.js';

export async function recordWorkshopUsage(session, kind, pool) {
  if (!session || !/^[1-6]$/.test(session.codeId)) return;
  if (!/^[a-f0-9]{64}$/.test(session.generationKey) || !['entry', 'another'].includes(kind)) {
    throw new Error('Invalid voucher usage event.');
  }
  await (pool || databasePool()).query(`INSERT INTO public.santa_workshop_usage_sessions(access_key, code_id, entry_kind)
    VALUES($1,$2,$3) ON CONFLICT(access_key) DO NOTHING`, [session.generationKey, Number(session.codeId), kind]);
}

export function buildWorkshopUsageReport(config, rows) {
  const usageBySlot = new Map(rows.map(row => [String(row.slot), row]));
  const vouchers = config.codes.map(entry => {
    const usage = usageBySlot.get(entry.id) || {};
    return {
      slot: Number(entry.id),
      name: entry.id === '6' ? 'School tester voucher' : `Voucher ${entry.id}`,
      code: entry.code,
      entries: usage.entries || 0,
      startedAnother: usage.startedAnother || 0,
      firstEntryAt: usage.firstEntryAt || null,
      messages: usage.messages || 0,
      corrections: usage.corrections || 0,
      totalRecordings: usage.totalRecordings || 0,
    };
  });
  const sum = key => vouchers.reduce((total, voucher) => total + voucher[key], 0);
  const firstEntryAt = vouchers.map(voucher => voucher.firstEntryAt).filter(Boolean)
    .sort((left, right) => new Date(left) - new Date(right))[0] || null;
  return {
    vouchers,
    entries: sum('entries'),
    messages: sum('messages'),
    corrections: sum('corrections'),
    totalRecordings: sum('totalRecordings'),
    startedAnother: sum('startedAnother'),
    firstEntryAt,
  };
}

export async function workshopUsageReport(pool) {
  const config = workshopSettings();
  const { rows } = await (pool || databasePool()).query(`
    WITH sessions AS (
      SELECT code_id,
        count(*) FILTER (WHERE entry_kind='entry')::integer AS entries,
        count(*) FILTER (WHERE entry_kind='another')::integer AS "startedAnother",
        min(created_at) FILTER (WHERE entry_kind='entry') AS "firstEntryAt"
      FROM public.santa_workshop_usage_sessions
      GROUP BY code_id
    ), recordings AS (
      SELECT s.code_id,
        count(*) FILTER (WHERE r.sequence=1 AND r.created_at >= s.created_at)::integer AS messages,
        count(*) FILTER (WHERE r.sequence=2 AND r.created_at >= s.created_at)::integer AS corrections,
        count(*) FILTER (WHERE r.created_at >= s.created_at)::integer AS "totalRecordings"
      FROM public.santa_studio_generation_results r
      JOIN public.santa_workshop_usage_sessions s ON s.access_key=r.access_key
      GROUP BY s.code_id
    )
    SELECT s.code_id AS slot, s.entries, s."startedAnother", s."firstEntryAt",
      COALESCE(r.messages,0)::integer AS messages,
      COALESCE(r.corrections,0)::integer AS corrections,
      COALESCE(r."totalRecordings",0)::integer AS "totalRecordings"
    FROM sessions s LEFT JOIN recordings r USING(code_id)
    ORDER BY s.code_id`);
  return buildWorkshopUsageReport(config, rows);
}
