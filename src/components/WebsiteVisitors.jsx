import { useEffect, useState } from 'react';
import './WebsiteVisitors.css';
const number = value => value.toLocaleString('en-GB');
const label = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day:'numeric', month:'short' });
function Movement({ value, previous }) {
  if (previous == null) return <span className="website-visitors__movement" title="No previous day in this report">— <small>No comparison</small></span>;
  const change = value - previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'same';
  const text = change === 0 ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${number(Math.abs(change))} visitors`;
  return <span className={`website-visitors__movement website-visitors__movement--${direction}`} aria-label={`${text} from the previous day`}>
    <span aria-hidden="true">{change > 0 ? '↑' : change < 0 ? '↓' : '—'} {change === 0 ? 'No change' : `${change > 0 ? '+' : '−'}${number(Math.abs(change))}`}{previous > 0 && change !== 0 ? ` (${(Math.abs(change) / previous * 100).toFixed(1)}%)` : ''}</span>
  </span>;
}
export default function WebsiteVisitors({ ownerToken }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch('/api/message-statistics?view=visitors', { headers: { Authorization: `Bearer studio-owner.${ownerToken}` }, cache:'no-store', signal:controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setData).catch(error => { if (error.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [ownerToken, refresh]);
  const days = data?.days || [];
  const max = Math.max(1, ...days.map(day => day.visitors));
  const points = days.map((day, i) => `${48 + i * 844 / 29},${210 - day.visitors / max * 170}`).join(' ');
  return <section className="website-visitors" aria-labelledby="website-visitors-title">
    <header><p>GOOGLE ANALYTICS · LAST 30 COMPLETE DAYS</p><h2 id="website-visitors-title">Website visitors</h2></header>
    {error ? <p role="status">Visitor figures are temporarily unavailable. <button onClick={() => setRefresh(value => value + 1)}>Try again</button></p> : !data ? <p role="status">Loading visitor figures…</p> : <>
      <div className="website-visitors__stats"><div><strong>{number(days.at(-1)?.visitors || 0)}</strong><span>Visitors yesterday</span><Movement value={days.at(-1)?.visitors || 0} previous={days.at(-2)?.visitors} /></div><div><strong>{number(Math.round(days.reduce((sum, day) => sum + day.visitors, 0) / 30))}</strong><span>Average daily visitors</span></div><div><strong>{number(days.reduce((sum, day) => sum + day.views, 0))}</strong><span>Page views · 30 days</span></div></div>
      <svg viewBox="0 0 930 255" role="img" aria-label="Daily active visitors to Santa Radio over the last 30 complete days">
        {[0, .5, 1].map(t => <g key={t}><line x1="48" x2="892" y1={210 - t * 170} y2={210 - t * 170} stroke="currentColor" opacity=".18"/><text x="40" y={215 - t * 170} textAnchor="end">{number(Math.round(max * t))}</text></g>)}
        <polygon points={`48,210 ${points} 892,210`} fill="currentColor" opacity=".1"/>
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3"/>
        {days.map((day, i) => <circle key={day.date} cx={48 + i * 844 / 29} cy={210 - day.visitors / max * 170} r="4" fill="currentColor"><title>{label(day.date)}: {number(day.visitors)} visitors</title></circle>)}
        {[0, 7, 14, 21, 29].map(i => <text key={i} x={48 + i * 844 / 29} y="242" textAnchor="middle">{label(days[i].date)}</text>)}
      </svg>
      <p className="website-visitors__note">Visitors means Google Analytics active users. A returning visitor can count on multiple days. Figures may be delayed and exclude visits Google cannot measure. Reporting timezone: {data.timeZone}.</p>
      <details><summary>View daily figures</summary><div className="santa-dashboard__table"><table><thead><tr><th>Date</th><th>Visitors</th><th>Daily change</th><th>Page views</th></tr></thead><tbody>{[...days].reverse().map((day, index) => <tr key={day.date}><td>{label(day.date)}</td><td>{number(day.visitors)}</td><td><Movement value={day.visitors} previous={days[days.length - index - 2]?.visitors} /></td><td>{number(day.views)}</td></tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
