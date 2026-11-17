import { timingSafeEqual } from 'node:crypto';
import { syncAppleDownloads } from '../server/apple-download-statistics.js';
export const config = { maxDuration: 300 };
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET || ''));
  const supplied=Buffer.from(req.headers.authorization || '');
  if (!process.env.CRON_SECRET || expected.length!==supplied.length || !timingSafeEqual(expected,supplied)) return res.status(401).json({error:'Unauthorized'});
  if (req.method!=='GET') return res.status(405).end();
  try { return res.json(await syncAppleDownloads()); }
  catch { return res.status(503).json({error:'Apple reports could not be refreshed.'}); }
}
