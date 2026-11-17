import { useEffect, useState } from 'react';
import './NameChart.css';

export default function NameChart() {
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetch('/api/name-chart?ranking=recordings-30d', { signal: controller.signal });
        if (!response.ok) throw new Error('Chart unavailable');
        const data = await response.json();
        if (!Array.isArray(data.names)) throw new Error('Invalid chart');
        setChart(data); setError(false);
        timer = setTimeout(refresh, Math.max(60000, Date.parse(data.refreshAfter) - Date.now() || 43200000));
      } catch {
        if (!controller.signal.aborted) { setError(true); timer = setTimeout(refresh, 60000); }
      }
    }
    refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const rows = chart?.names || [];
  const list = entries => <ol role="list" className="nc-list" start={entries[0]?.rank || 1}>{entries.map(entry =>
    <li className={`nc-row ${entry.rank === 1 ? 'nc-first' : ''}`} key={entry.rank}>
      <span className="nc-number" aria-hidden="true">{String(entry.rank).padStart(2, '0')}</span>
      <span className="nc-name">{entry.name}</span>{entry.rank === 1 && <span className="nc-tag">NO. 1</span>}
    </li>)}</ol>;
  return <section className="name-chart-section" id="name-chart" aria-labelledby="name-chart-title"><div className="nc-chart">
<div className="nc-topline"><span className="nc-brand">santa<span>radio</span><svg className="nc-holly" aria-hidden="true" viewBox="0 0 90 60"><path d="M43 35Q13 40 7 7L20 11 25 3 31 16 42 14Q35 25 43 35Z" fill="#16df9a" stroke="#092b21" strokeWidth="2"/><path d="M43 35Q52 9 83 14L75 25 82 34 65 36 62 47Q54 34 43 35Z" fill="#16df9a" stroke="#092b21" strokeWidth="2"/><path d="M17 15L43 35 73 22" fill="none" stroke="#086342" strokeWidth="2"/><g fill="#ff396f" stroke="#14131c" strokeWidth="2"><circle cx="38" cy="36" r="8"/><circle cx="51" cy="35" r="8"/><circle cx="45" cy="46" r="8"/></g><g fill="#fff5d8"><circle cx="36" cy="33" r="2"/><circle cx="49" cy="32" r="2"/></g></svg></span><span className="nc-edition">★ CHRISTMAS CHART SPECIAL ★</span></div><header className="nc-heading"><div className="nc-snow" aria-hidden="true"><i>✳</i><i>✦</i><i>❄</i><i>✧</i><i>✳</i><i>✦</i></div><div><p className="nc-kicker">STRAIGHT FROM THE NORTH POLE</p><h2 id="name-chart-title">The name <span>chart</span></h2><p className="nc-subtitle">The names making Christmas magic. Is yours on the list?</p></div><div className="nc-top"><span className="nc-christmas">CHRISTMAS</span>TOP<b>{expanded ? 25 : 10}</b></div></header><div className="nc-bar"><span>THE MOST POPULAR RECORDED NAMES ON SANTA RADIO</span><span>IS YOUR NAME IN THE CHART?</span></div>
    {rows.length > 0 ? <div className="nc-columns">{list(rows.slice(0,5))}{list(rows.slice(5,10))}</div> :
      <p className="nc-chart-status" role="status">{error ? 'Santa’s chart is temporarily unavailable. Please check back shortly.' : chart ? 'Santa’s chart is waiting for its first recordings.' : 'Loading Santa’s name chart…'}</p>}
    <footer className="nc-footer"><p>Has your name made the chart?<small>Recordings created · Last 30 days · Refreshed every 12 hours · Ties listed alphabetically</small></p>
      {rows.length > 10 && <button type="button" aria-expanded={expanded} aria-controls="name-chart-more" onClick={() => setExpanded(value => !value)}>{expanded ? 'BACK TO TOP 10 ↑' : 'VIEW THE TOP 25 ↗'}</button>}
    </footer>
    <div id="name-chart-more" hidden={!expanded}><div className="nc-columns">{list(rows.slice(10,18))}{list(rows.slice(18,25))}</div></div>
    {chart && <p className="nc-chart-updated">Updated {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(chart.updatedAt))} UK time{error ? ' · Refresh delayed; showing the last chart.' : ''}</p>}
  </div></section>;
}
