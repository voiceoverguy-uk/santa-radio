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
  const text=(buffer[0]===255&&buffer[1]===254?buffer.toString('utf16le'):buffer.toString('utf8')).replace(/^\uFEFF/,'');
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
export function createAndroidInstallReport({env=process.env,fetcher=fetch,now=()=>new Date()}={}) {
  let cached,expires=0,pending;
  async function load() {
    const key=JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON||env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON||'null');
    const bucket=env.GOOGLE_PLAY_REPORTS_BUCKET;
    if(!key?.client_email||!key?.private_key||!/^pubsite_prod_rev_\d+$/.test(bucket||''))throw new Error('Google Play reports are not configured');
    const time=now(),seconds=Math.floor(time.getTime()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
    const unsigned=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:key.client_email,scope:'https://www.googleapis.com/auth/devstorage.read_only',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600});
    const assertion=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),key.private_key).toString('base64url');
    const auth=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
    if(!auth.ok)throw new Error('Google reporting authentication failed');
    const {access_token}=await auth.json();if(!access_token)throw new Error('Missing token');
    // Three months cover 30 days even with delayed publication at month boundaries.
    const months=Array.from({length:3},(_,i)=>new Date(Date.UTC(time.getUTCFullYear(),time.getUTCMonth()-i,1)).toISOString().slice(0,7).replace('-',''));
    const apps=await Promise.all(ANDROID_APPS.map(async app=>{
      let rows=[],failed=false;
      for(const month of months) {
        const object=`stats/installs/installs_${app.id}_${month}_country.csv`;
        const response=await fetcher(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`,{headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(15000)});
        if(response.status===404)continue;
        if(!response.ok){failed=true;break;}
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length>10000000)throw new Error('Report too large');
        rows.push(...parseInstallReport(bytes,app.id));
      }
      // Missing or denied reports are never represented as zero or a release state.
      return {...app,rows:failed?[]:rows,reportState:failed?'unavailable':rows.length?'available':'no-report'};
    }));
    const today=time.toISOString().slice(0,10);
    const end=apps.flatMap(a=>a.rows.map(r=>r.day)).filter(d=>d<today).sort().at(-1)||new Date(time.getTime()-86400000).toISOString().slice(0,10);
    return {source:'Google Play install reports',fetchedAt:time.toISOString(),apps:apps.map(({rows,...a})=>({...a,...summariseInstalls(rows,end)})).sort((a,b)=>(b.last30Days??-1)-(a.last30Days??-1)||a.name.localeCompare(b.name))};
  }
  return async()=>{
    if(cached&&now().getTime()<expires)return cached;
    if(!pending)pending=load().then(r=>{cached=r;expires=now().getTime()+15*60000;return r;}).finally(()=>{pending=null;});
    return pending;
  };
}
export const androidInstallReport=createAndroidInstallReport();
