import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
const number=value=>value==null?'Unavailable':value.toLocaleString('en-GB');
const issueMessages = {
  bucket_missing: 'Google Play report bucket is not configured. Copy the Cloud Storage URI from Play Console → Play apps reports → Statistics and set GOOGLE_PLAY_REPORTS_BUCKET in the server environment.',
  bucket_invalid: 'The Google Play report bucket is invalid. Use the pubsite_prod_rev_ name or the full gs://…/stats/installs/ URI from Play Console.',
  credentials_missing: 'Google Play reporting credentials are not configured. Add the read-only Google service account to the server environment.',
  credentials_invalid: 'The Google Play service account credentials could not be read. Check the server’s service account JSON.',
  authentication_failed: 'Google rejected the service account authentication. Check that its credentials are valid and enabled.',
  access_denied: 'Google denied access to the install reports. In Play Console → Users and permissions, grant the configured service account the account-level View app information and download bulk reports (read-only) permission.',
  reports_missing: 'Google did not return install report files. Check the reporting bucket and app package names in Play Console. New reports may be delayed.',
  report_format: 'Google returned an install report that could not be read. Check the current CSV format in Play Console.',
  network_failed: 'Google’s reporting request failed or timed out. Refresh the Android figures to retry.',
};
const issueLabel = {
  access_denied: 'Access denied',
  reports_missing: 'Report files not found',
  report_format: 'Report format could not be read',
  network_failed: 'Report request failed',
  bucket_missing: 'Bucket not configured',
  bucket_invalid: 'Bucket invalid',
  credentials_missing: 'Credentials missing',
  credentials_invalid: 'Credentials invalid',
  authentication_failed: 'Authentication failed',
};

export default function AndroidAppInstalls({source}) {
  const { report, error, refresh } = source;
  const apps=report?.apps??[];
  return <div className="apple-app-downloads__content">
    <h3>Android app installs</h3>
    <p>Device installs from Google Play over the last 30 reported days.</p>
    {report?.issue && <p role="status"><strong>Google Play:</strong> {issueMessages[report.issue] || 'Report unavailable. Try refreshing.'}</p>
    {apps.length?<div className="santa-dashboard__table"><table><caption>{report.hasReportDates===false ? 'No report dates available' : `${formatUkDate(apps[0].startDate)} to ${formatUkDate(apps[0].endDate)} · Google’s report dates`}</caption><thead><tr><th scope="col">App</th><th scope="col">Latest day</th><th scope="col">7 days</th><th scope="col">30 days</th><th scope="col">Uninstalls · 30 days</th></tr></thead><tbody>{apps.map(app=><tr key={app.id}><th scope="row">{app.name}<small style={{display:'block'}}>{app.reportState==='available'?`${app.availableDays}/30 daily reports${app.issue && issueLabel[app.issue] ? ` · ${issueLabel[app.issue]}` : ''}`:(issueLabel[app.issue] || (app.reportState==='no-report'?'No install report yet':'Report unavailable'))}</small></th>{[app.latest?.installs,app.last7Days,app.last30Days,app.uninstalls30Days].map((n,i)=><td key={i}>{number(n)}</td>)}</tr>)}</tbody></table></div>:<p role="status">{error?'Google Play reports are temporarily unavailable.':'Loading Google Play install reports…'}</p>}
    <button type="button" onClick={refresh}>Refresh Android figures</button>
    {error && report && <p role="status">Refresh failed. Showing the last fetched figures.</p>}
    <p className="apple-app-downloads__note">Google’s exports can lag 3–7 days. Missing dates show Unavailable, not zero. {report?.fetchedAt&&`Last refreshed: ${formatUkDateTime(report.fetchedAt)}.`}</p>
  </div>;
}
