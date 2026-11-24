import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
import { useEffect, useState } from 'react';
const number=value=>value==null?'Unavailable':value.toLocaleString();
export default function AndroidAppInstalls({token}) {
  const [report,setReport]=useState(null),[error,setError]=useState(false),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),55000);
    setError(false);
    fetch('/api/message-statistics?view=android-installs',{headers:{Authorization:`Bearer studio-owner.${token}`},cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Unavailable');return response.json();})
      .then(value=>{if(active)setReport(value);}).catch(()=>{if(active)setError(true);}).finally(()=>clearTimeout(timeout));
    return ()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[token,refresh]);
  const apps=report?.apps??[];
  return <div className="apple-app-downloads__content">
    <h3>Android app installs</h3>
    <p>Device installs from Google Play, ranked over the same 30-day reporting period. These are not first opens or Apple’s new-download measure.</p>
    {apps.length?<div className="santa-dashboard__table"><table><caption>{formatUkDate(apps[0].startDate)} to {formatUkDate(apps[0].endDate)} · Google’s report dates</caption><thead><tr><th scope="col">App</th><th scope="col">Latest day</th><th scope="col">7 days</th><th scope="col">30 days</th><th scope="col">Uninstalls · 30 days</th></tr></thead><tbody>{apps.map(app=><tr key={app.id}><th scope="row">{app.name}<small style={{display:'block'}}>{app.reportState==='no-report'?'No install report yet':app.reportState==='unavailable'?'Report access unavailable':`${app.availableDays}/30 daily reports`}</small></th>{[app.latest?.installs,app.last7Days,app.last30Days,app.uninstalls30Days].map((n,i)=><td key={i}>{number(n)}</td>)}</tr>)}</tbody></table></div>:<p role="status">{error?'Google Play reports are temporarily unavailable.':'Loading Google Play install reports…'}</p>}
    <button type="button" onClick={()=>setRefresh(n=>n+1)}>Refresh Android figures</button>
    {error&&report&&<p role="status">Refresh failed. Showing the last fetched figures.</p>}
    <p className="apple-app-downloads__note">Google’s exports can arrive 3–7 days late. Figures refresh automatically when you open this tab, with a 15-minute cache. Missing reports show Unavailable, not zero. Review and publication status are checked separately in Play Console. {report?.fetchedAt&&`Last refreshed: ${formatUkDateTime(report.fetchedAt)}.`}</p>
  </div>;
}
