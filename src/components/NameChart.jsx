import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './NameChart.css';

function movementLabel(entry) {
  if (entry.movement === 'up' || entry.movement === 'down') {
    const places = Math.abs(entry.change);
    return `${entry.movement === 'up' ? 'Up' : 'Down'} ${places} ${places === 1 ? 'place' : 'places'} compared with one week ago`;
  }
  if (entry.movement === 'new') return 'New since last week';
  if (entry.movement === 'same') return 'Same position as one week ago';
  return 'Weekly comparison building — not enough history yet';
}

export default function NameChart() {
  const location = useLocation();
  const section = useRef(null);
  useEffect(() => {
    if (location.hash !== '#name-chart') return;
    let active = true;
    let frame;
    let timer;
    // Run after Navbar's route scroll reset, then settle late fonts/images.
    const position = () => {
      if (!active || !section.current) return;
      const target = section.current.querySelector('.nc-chart');
      const navbar = document.querySelector('.navbar');
      const offset = (navbar?.getBoundingClientRect().height || 80) + 16;
      section.current.focus({ preventScroll: true });
      window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset), behavior: 'instant' });
    };
    const schedule = () => { cancelAnimationFrame(frame); if (active) frame = requestAnimationFrame(position); };
    const observer = new ResizeObserver(schedule);
    for (const sibling of section.current?.parentElement?.children || []) {
      if (sibling === section.current) break;
      observer.observe(sibling);
    }
    const stop = () => {
      active = false; cancelAnimationFrame(frame); clearTimeout(timer); observer.disconnect();
      window.removeEventListener('load', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(event, stop);
    };
    window.addEventListener('load', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    document.fonts.ready.then(schedule);
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(event, stop, { passive: true });
    timer = setTimeout(stop, 5000);
    schedule();
    return stop;
  }, [location.key, location.hash]);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetch('/api/name-chart?ranking=recordings-30d-weekly', { signal: controller.signal });
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
      <span className="nc-name">{entry.name}</span><span className={`nc-movement nc-movement--${entry.movement || 'pending'}`} aria-label={movementLabel(entry)} title={movementLabel(entry)}>
        <span aria-hidden="true">{entry.movement === 'new' ? 'NEW' : entry.movement === 'up' ? `↑ ${entry.change}` : entry.movement === 'down' ? `↓ ${Math.abs(entry.change)}` : '—'}</span>
      </span>
    </li>)}</ol>;
  return <section ref={section} tabIndex={-1} className="name-chart-section" id="name-chart" aria-labelledby="name-chart-title"><div className="nc-chart">
    <header className="nc-heading">
      <div className="nc-snow" aria-hidden="true"><i>✳</i><i>✦</i><i>❄</i><i>✧</i><i>✳</i><i>✦</i></div>
      <div>
        <p className="nc-kicker">STRAIGHT FROM THE NORTH POLE</p>
        <h2 id="name-chart-title">The name <span>chart</span></h2>
        <p className="nc-subtitle">THE MOST POPULAR RECORDED NAMES ON SANTA RADIO</p>
      </div>
      <div className="nc-top"><span className="nc-christmas">CHRISTMAS</span>TOP<b>{expanded ? 25 : 10}</b></div>
    </header>
    <div className="nc-bar"><span>IS YOUR NAME IN THE CHART?</span></div>
    {rows.length > 0 ? <div className="nc-columns">{list(rows.slice(0,5))}{list(rows.slice(5,10))}</div> :
      <p className="nc-chart-status" role="status">{error ? 'Santa’s chart is temporarily unavailable. Please check back shortly.' : chart ? 'Santa’s chart is waiting for its first recordings.' : 'Loading Santa’s name chart…'}</p>}
    <p className="nc-movement-key">↑ Up · ↓ Down · — No change · NEW New entry <span>Compared with one week ago{rows.length > 0 && rows.every(entry => entry.movement === 'pending') ? ' · Weekly comparison building — not enough history yet' : ''}</span></p>
    <footer className="nc-footer"><p>Has your name made the chart?<small>Recordings created · Last 30 days · Refreshed every 12 hours · Ties listed alphabetically</small></p>
      {rows.length > 10 && <button type="button" aria-expanded={expanded} aria-controls="name-chart-more" onClick={() => setExpanded(value => !value)}>{expanded ? 'BACK TO TOP 10 ↑' : 'VIEW THE TOP 25 ↗'}</button>}
    </footer>
    <div id="name-chart-more" hidden={!expanded}><div className="nc-columns">{list(rows.slice(10,18))}{list(rows.slice(18,25))}</div></div>
    {chart && <p className="nc-chart-updated">Updated {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(chart.updatedAt))} UK time{error ? ' · Refresh delayed; showing the last chart.' : ''}</p>}
  </div></section>;
}
