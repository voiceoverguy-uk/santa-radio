import { sign } from 'node:crypto';

export const ANDROID_APPS = [
  ['com.guy.santaradio', 'Santa Radio'],
  ['com.christmasmusicforshops.app', 'Christmas Music for Shops'],
  ['uk.co.santaradio.santatracker', 'Santa Tracker by Santa Radio'],
  ['com.guy.christmasradiopro', 'Christmas Radio'],
].map(([id,name])=>({id,name}));

// A single country breakdown is summed; never combine overlapping report dimensions.
export function csvRows(text) {
  const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;} else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(field);field='';}
    else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('Invalid CSV');
  row.push(field.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);
  return rows;
}
export function parseInstallReport(bytes, packageName) {
  const buffer=Buffer.from(bytes);
  // Play exports are UTF-16. Accept little-endian (including BOM-less ASCII headers),
  // big-endian with a BOM, and UTF-8 for manually exported or fixture CSVs.
  const utf16le=(buffer[0]===255&&buffer[1]===254)||(buffer[1]===0&&buffer[3]===0);
  const text=(utf16le?buffer.toString('utf16le'):buffer[0]===254&&buffer[1]===255?Buffer.from(buffer).swap16().toString('utf16le'):buffer.toString('utf8')).replace(/^\uFEFF/,'');
  const [headers,...rows]=csvRows(text);
  const fields=['Date','Package Name','Daily Device Installs','Daily Device Uninstalls'];
  if(!headers || fields.some(f=>!headers.includes(f)))throw new Error('Invalid install report');
  const at=Object.fromEntries(fields.map(f=>[f,headers.indexOf(f)]));
  const days=new Map(), seen=new Set();
  for(const row of rows) {
    if(row[at['Package Name']]!==packageName)throw new Error('Unexpected package');
    const day=row[at.Date];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)throw new Error('Invalid date');
    const countryIndex=headers.indexOf('Country');
    const key=day+'|'+(countryIndex<0?'total':row[countryIndex]);
    if(seen.has(key))throw new Error('Duplicate report row');seen.add(key);
    const count=f=>{const value=row[at[f]];if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Invalid count');return Number(value);};
    const old=days.get(day)||{day,installs:0,uninstalls:0};
    old.installs+=count('Daily Device Installs');old.uninstalls+=count('Daily Device Uninstalls');
    if(!Number.isSafeInteger(old.installs)||!Number.isSafeInteger(old.uninstalls))throw new Error('Invalid total');
    days.set(day,old);
  }
  return [...days.values()];
}
export function summariseInstalls(rows,end) {
  const byDay=new Map(rows.map(r=>[r.day,r]));
  const days=Array.from({length:30},(_,i)=>new Date(Date.parse(end+'T12:00:00Z')-i*86400000).toISOString().slice(0,10));
  const sum=(n,key)=>days.slice(0,n).every(d=>byDay.has(d))?days.slice(0,n).reduce((total,d)=>total+byDay.get(d)[key],0):null;
  return {startDate:days.at(-1),endDate:end,availableDays:days.filter(d=>byDay.has(d)).length,latest:byDay.get(end)||null,last7Days:sum(7,'installs'),last30Days:sum(30,'installs'),uninstalls30Days:sum(30,'uninstalls')};
}
// Allow the exact bucket name, or the complete URI copied from Play Console.
export function normalisePlayReportsBucket(value) {
  return String(value ?? '').trim().match(/^(?:gs:\/\/)?(pubsite_prod_rev_\d+)(?:\/(?:stats\/installs\/?)?)?$/)?.[1] ?? null;
}

export function createAndroidInstallReport({env=process.env,fetcher=fetch,now=()=>new Date()}={}) {
  let cached,expires=0,pending;
  function payload(time,apps,issue=null) {
    const today=time.toISOString().slice(0,10);
    const reportDates=apps.flatMap(a=>a.rows.map(r=>r.day)).filter(d=>d<today).sort();
    const end=reportDates.at(-1)||new Date(time.getTime()-86400000).toISOString().slice(0,10);
    return {source:'Google Play install reports',fetchedAt:time.toISOString(),hasReportDates:reportDates.length>0,issue,
      apps:apps.map(({rows,...a})=>({...a,...summariseInstalls(rows,end)})).sort((a,b)=>(b.last30Days??-1)-(a.last30Days??-1)||a.name.localeCompare(b.name))};
  }
  function unavailable(time,issue) {
    return payload(time,ANDROID_APPS.map(app=>({...app,rows:[],reportState:'unavailable',issue})),issue);
  }
  async function load() {
    const time=now(),rawBucket=env.GOOGLE_PLAY_REPORTS_BUCKET;
    if(!String(rawBucket??'').trim())return unavailable(time,'bucket_missing');
    const bucket=normalisePlayReportsBucket(rawBucket);
    if(!bucket)return unavailable(time,'bucket_invalid');
    const rawKey=env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON;
    if(!rawKey)return unavailable(time,'credentials_missing');
    let key,assertion;
    try {
      key=JSON.parse(rawKey);
      if(!key?.client_email||!key?.private_key)return unavailable(time,'credentials_invalid');
      const seconds=Math.floor(time.getTime()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
      const unsigned=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:key.client_email,scope:'https://www.googleapis.com/auth/devstorage.read_only',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600});
      assertion=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),key.private_key).toString('base64url');
    } catch { return unavailable(time,'credentials_invalid'); }
    let access_token;
    try {
      const auth=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
      if(!auth.ok)return unavailable(time,'authentication_failed');
      ({access_token}=await auth.json());
      if(!access_token)return unavailable(time,'authentication_failed');
    } catch { return unavailable(time,'network_failed'); }
    const months=Array.from({length:3},(_,i)=>new Date(Date.UTC(time.getUTCFullYear(),time.getUTCMonth()-i,1)).toISOString().slice(0,7).replace('-',''));
    // Fetch independent months concurrently so a slow report doesn't block the rest
    // of the dashboard or exceed its request timeout. Never expose provider bodies.
    async function monthReport(app,month) {
      const object=`stats/installs/installs_${app.id}_${month}_country.csv`;
      try {
        const response=await fetcher(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`,{headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(15000)});
        if(response.status===404)return {rows:[],issue:'reports_missing'};
        if(response.status===401||response.status===403)return {rows:[],issue:'access_denied'};
        if(!response.ok)return {rows:[],issue:'network_failed'};
        const bytes=Buffer.from(await response.arrayBuffer());
        try {
          if(bytes.length>10000000)throw new Error('Report too large');
          return {rows:parseInstallReport(bytes,app.id),issue:null};
        } catch { return {rows:[],issue:'report_format'}; }
      } catch { return {rows:[],issue:'network_failed'}; }
    }
    const apps=await Promise.all(ANDROID_APPS.map(async app=>{
      const results=await Promise.all(months.map(month=>monthReport(app,month)));
      const rows=results.flatMap(result=>result.rows);
      const issues=results.map(result=>result.issue).filter(Boolean);
      const issue=['access_denied','report_format','network_failed'].find(value=>issues.includes(value))||(!rows.length?'reports_missing':null);
      return {...app,rows,issue,reportState:rows.length?'available':issue==='reports_missing'?'no-report':'unavailable'};
    }));
    const hasRows=apps.some(app=>app.rows.length);
    const issue=!hasRows?['access_denied','report_format','network_failed','reports_missing'].find(value=>apps.some(app=>app.issue===value))||'reports_missing':null;
    return payload(time,apps,issue);
  }
  return async()=>{
    if(cached&&now().getTime()<expires)return cached;
    if(!pending)pending=load().then(r=>{cached=r;expires=now().getTime()+(r.issue?60000:15*60000);return r;}).finally(()=>{pending=null;});
    return pending;
  };
}
export const androidInstallReport=createAndroidInstallReport();
