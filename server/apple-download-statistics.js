import { TRACKED_APPS, releaseStatus } from './apple-tracked-apps.js';
import { sign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { databasePool } from './name-request-store.js';

export const APP_ID = '1021183593';
export function parseAppleSales(text, appId = APP_ID) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map(line => line.split('\t'));
  const headers = lines.shift();
  const columns = ['Apple Identifier', 'Product Type Identifier', 'Units'].map(name => headers.indexOf(name));
  if (columns.some(index => index < 0)) throw new Error('Invalid Apple report');
  const result = { downloads: 0, redownloads: 0, updates: 0 };
  const types = { '1':'downloads', '1F':'downloads', '1T':'downloads', F1:'downloads', '3':'redownloads', '3F':'redownloads', '7':'updates', '7F':'updates', '7T':'updates', F7:'updates' };
  for (const row of lines) {
    if (row[columns[0]] !== appId) continue;
    const type = types[row[columns[1]]];
    if (!type) continue;
    if (!/^-?\d+$/.test(row[columns[2]])) throw new Error('Invalid Apple units');
    const units = Number(row[columns[2]]);
    if (!Number.isSafeInteger(units)) throw new Error('Invalid Apple units');
    result[type] += units;
  }
  return result;
}
function token() {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = encode({ alg:'ES256', kid:process.env.APPLE_REPORTS_KEY_ID, typ:'JWT' }) + '.' + encode({ iss:process.env.APPLE_REPORTS_ISSUER_ID, iat:now, exp:now+600, aud:'appstoreconnect-v1' });
  return payload + '.' + sign('sha256', Buffer.from(payload), { key:process.env.APPLE_REPORTS_PRIVATE_KEY.replace(/\\n/g, '\n'), dsaEncoding:'ieee-p1363' }).toString('base64url');
}
export function reportDays(now = new Date(), count = 30) {
  // Apple Sales and Trends daily reports use Pacific dates.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  return Array.from({length:count}, (_,i) => new Date(Date.parse(today+'T12:00:00Z')-(i+1)*86400000).toISOString().slice(0,10));
}
export async function syncAppleDownloads({ pool=databasePool(), fetchReport=fetch, now=new Date() } = {}) {
  if (!['KEY_ID','ISSUER_ID','PRIVATE_KEY','VENDOR_NUMBER'].every(key => process.env['APPLE_REPORTS_'+key])) throw new Error('Apple reporting is not configured');
  const jwt = token();
  // Refresh review status independently; an Apple outage must not turn apps pending.
  for (const app of TRACKED_APPS) {
    try {
      const response=await fetchReport(`https://api.appstoreconnect.apple.com/v1/apps/${app.id}/appStoreVersions?limit=200`,{headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(10000)});
      if (!response.ok) continue;
      const payload=await response.json();
      if (!Array.isArray(payload.data)) continue;
      await pool.query(`INSERT INTO santa_apple_app_status (app_id,status,checked_at) VALUES ($1,$2,now()) ON CONFLICT (app_id) DO UPDATE SET status=EXCLUDED.status,checked_at=now()`,[app.id,releaseStatus(payload.data)]);
    } catch { /* retain last verified status; counts remain independently available */ }
  }
  const days = reportDays(now, 32);
  let saved=0, unavailable=0;
  // Three requests at a time; re-fetching replaces totals rather than adding them.
  for (let i=0; i<days.length; i+=3) await Promise.all(days.slice(i,i+3).map(async day => {
    const query = new URLSearchParams({ 'filter[frequency]':'DAILY', 'filter[reportType]':'SALES', 'filter[reportSubType]':'SUMMARY', 'filter[version]':'1_0', 'filter[vendorNumber]':process.env.APPLE_REPORTS_VENDOR_NUMBER, 'filter[reportDate]':day });
    const response = await fetchReport('https://api.appstoreconnect.apple.com/v1/salesReports?'+query, { headers:{Authorization:'Bearer '+jwt}, signal:AbortSignal.timeout(15000) });
    if (response.status===404) { unavailable++; return; }
    if (!response.ok) throw new Error('Apple report request failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10000000) throw new Error('Apple report too large');
    const text = (bytes[0]===31 && bytes[1]===139 ? gunzipSync(bytes,{maxOutputLength:50000000}) : bytes).toString('utf8');
    // One report contains all apps; store all selected apps together atomically.
    const values=TRACKED_APPS.flatMap(app=>{const c=parseAppleSales(text,app.id);return [app.id,day,c.downloads,c.redownloads,c.updates];});
    const placeholders=TRACKED_APPS.map((_,i)=>'('+Array.from({length:5},(_,j)=>'$'+(i*5+j+1)).join(',')+')').join(',');
    await pool.query(`INSERT INTO santa_apple_download_days (app_id,day,downloads,redownloads,updates) VALUES ${placeholders}
      ON CONFLICT (app_id,day) DO UPDATE SET downloads=EXCLUDED.downloads,redownloads=EXCLUDED.redownloads,updates=EXCLUDED.updates,fetched_at=now()`, values);
    saved++;
  }));
  return { saved, unavailable };
}
export function summariseAppleDays(rows, now=new Date(), periodEnd=null) {
  const candidates=reportDays(now,32), byDay=new Map(rows.map(row=>[row.day,row]));
  const end=periodEnd ?? candidates.find(day=>byDay.has(day)) ?? candidates[0];
  const days=Array.from({length:30},(_,i)=>new Date(Date.parse(end+'T12:00:00Z')-i*86400000).toISOString().slice(0,10));
  const daily=days.filter(day=>byDay.has(day)).map(day=>byDay.get(day));
  const total=(range,key)=>range.every(day=>byDay.has(day)) ? range.reduce((sum,day)=>sum+Number(byDay.get(day)[key]),0) : null;
  return { source:'Apple Sales and Trends', startDate:days.at(-1), endDate:days[0], availableDays:daily.length,
    latest:daily[0] ?? null, last7Days:total(days.slice(0,7),'downloads'), last30Days:total(days,'downloads'),
    redownloads30Days:total(days,'redownloads'), updates30Days:total(days,'updates') };
}
export function rankAppleApps(rows, statuses, now=new Date()) {
  const selected=new Set(TRACKED_APPS.map(app=>app.id));
  const candidates=reportDays(now,32);
  const end=candidates.find(day=>rows.some(row=>selected.has(row.appId)&&row.day===day)) ?? candidates[0];
  const apps=TRACKED_APPS.map(app=>{
    const summary=summariseAppleDays(rows.filter(row=>row.appId===app.id),now,end);
    const status=statuses.find(row=>row.appId===app.id);
    return {...app,...summary,status:status?.status ?? 'unknown',statusCheckedAt:status?.checkedAt ?? null};
  }).sort((a,b)=>{
    const eligible=x=>x.status!=='pending'&&x.last30Days!==null;
    return Number(eligible(b))-Number(eligible(a)) || (eligible(a)?b.last30Days-a.last30Days:0) || a.name.localeCompare(b.name);
  });
  let prior=null,rank=0;
  apps.forEach((app,index)=>{ if(app.status!=='pending'&&app.last30Days!==null){if(app.last30Days!==prior)rank=index+1;app.rank=rank;prior=app.last30Days;}else app.rank=null; });
  return apps;
}
export async function appleDownloadReport({pool=databasePool(), now=new Date()}={}) {
  const days=reportDays(now,32);
  const {rows}=await pool.query(`SELECT app_id AS "appId", to_char(day,'YYYY-MM-DD') AS day, downloads, redownloads, updates, fetched_at AS "fetchedAt" FROM santa_apple_download_days WHERE app_id=ANY($1::text[]) AND day BETWEEN $2 AND $3 ORDER BY day DESC`,[TRACKED_APPS.map(app=>app.id),days.at(-1),days[0]]);
  const statuses=await pool.query(`SELECT app_id AS "appId",status,checked_at AS "checkedAt" FROM santa_apple_app_status`);
  const apps=rankAppleApps(rows,statuses.rows,now);
  // Preserve existing Santa Radio fields for older installed dashboard builds.
  return {...summariseAppleDays(rows.filter(row=>row.appId===APP_ID),now),apps};
}
