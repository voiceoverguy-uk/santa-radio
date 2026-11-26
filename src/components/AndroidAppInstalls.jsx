import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
const number=value=>value==null?'Unavailable':value.toLocaleString();
export default function AndroidAppInstalls({source}) {
  const { report, error, refresh } = source;
  const apps=report?.apps??[];
  return <div className="apple-app-downloads__content">
    <h3>Android app installs</h3>
    <p>Device installs from Google Play, ranked over the same 30-day reporting period. These are not first opens or Apple’s new-download measure.</p>
    {apps.length?<div className="santa-dashboard__table"><table><caption>{formatUkDate(apps[0].startDate)} to {formatUkDate(apps[0].endDate)} · Google’s report dates</caption><thead><tr><th scope="col">App</th><th scope="col">Latest day</th><th scope="col">7 days</th><th scope="col">30 days</th><th scope="col">Uninstalls · 30 days</th></tr></thead><tbody>{apps.map(app=><tr key={app.id}><th scope="row">{app.name}<small style={{display:'block'}}>{app.reportState==='no-report'?'No install report yet':app.reportState==='unavailable'?'Report access unavailable':`${app.availableDays}/30 daily reports`}</small></th>{[app.latest?.installs,app.last7Days,app.last30Days,app.uninstalls30Days].map((n,i)=><td key={i}>{number(n)}</td>)}</tr>)}</tbody></table></div>:<p role="status">{error?'Google Play reports are temporarily unavailable.':'Loading Google Play install reports…'}</p>}
    <button type="button" onClick={refresh}>Refresh Android figures</button>
    {error && report && <p role="status">Refresh failed. Showing the last fetched figures.</p>}
    <p className="apple-app-downloads__note">Google’s exports can arrive 3–7 days late. Figures refresh automatically when you open the dashboard, with a 15-minute cache. Missing reports show Unavailable, not zero. Review and publication status are checked separately in Play Console. {report?.fetchedAt&&`Last refreshed: ${formatUkDateTime(report.fetchedAt)}.`}</p>
  </div>;
}
