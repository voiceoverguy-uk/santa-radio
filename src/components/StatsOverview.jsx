import { useState } from 'react';
import { countFormat, dailyMetric, moneyFormat, storeMetric, sumField } from '../lib/dashboardOverview.js';
import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
import './StatsOverview.css';

function Sparkline({ points, label, format }) {
  const max = Math.max(1, ...points.map(p => p.value));
  const coords = points.map((p, i) => [4 + (points.length === 1 ? 100 : i * 200 / (points.length - 1)), 40 - p.value / max * 36]);
  const line = coords.map(pair => pair.join(',')).join(' ');
  const [lastX, lastY] = coords.at(-1);
  const peak = points.reduce((best, p) => p.value > best.value ? p : best);
  const latest = points.at(-1);
  const description = `${label} per day. Peak ${format(peak.value)} on ${formatUkDate(peak.day)}. Latest ${format(latest.value)} on ${formatUkDate(latest.day)}.`;
  return <svg viewBox="0 0 208 44" preserveAspectRatio="none" role="img" aria-label={description} focusable="false">
    <title>{description}</title>
    <path d="M4 40H204" className="stats-overview__baseline" />
    <polygon points={`${coords[0][0]},40 ${line} ${lastX},40`} fill="currentColor" opacity=".12" />
    <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    <circle cx={lastX} cy={lastY} r="2.8" fill="currentColor" />
  </svg>;
}

function Label({ anchor, children }) {
  return anchor ? <a href={'#' + anchor}>{children}<span aria-hidden="true"> ↗</span></a> : children;
}

function Trend({ label, metric, format = n => countFormat.format(n), note, loading, anchor, tone }) {
  return <article className={'stats-overview__trend stats-overview__trend--' + tone}>
    <h3><Label anchor={anchor}>{label}</Label></h3>
    {metric ? <>
      <strong>{format(metric.value)}</strong>
      <small>{metric.partial ? 'Since tracking began' : note}</small>
      <Sparkline points={metric.points} label={label} format={format} />
      <div className="stats-overview__dates"><time dateTime={metric.start}>{formatUkDate(metric.start)}</time><time dateTime={metric.end}>{formatUkDate(metric.end)}</time></div>
    </> : <p className="stats-overview__missing">{loading ? 'Loading…' : 'Unavailable'}</p>}
  </article>;
}

function StatRow({ label, value, note, anchor, loading }) {
  return <div className="stats-overview__row">
    <div><Label anchor={anchor}>{label}</Label><small>{note}</small></div>
    <strong>{Number.isFinite(value) ? countFormat.format(value) : loading ? 'Loading…' : 'Unavailable'}</strong>
  </div>;
}

function StoreRow({ label, report, loading, period, unavailableNote }) {
  const metric = storeMetric(report, period);
  const coverage = metric && metric.count !== metric.total ? ` · ${metric.count} of ${metric.total} apps reporting` : '';
  const note = metric ? `${period} days to ${formatUkDate(metric.end)}${coverage}` : unavailableNote || `${period}-day report`;
  return <StatRow label={label} value={metric?.value} note={note} loading={loading} />;
}

export default function StatsOverview({ data, visitors, android, showLinks = false }) {
  const [period, setPeriod] = useState(7);
  const link = id => showLinks ? id : undefined;
  const money = dailyMetric(data.paid?.daily, 'grossPence', period);
  const orders = dailyMetric(data.paid?.daily, 'payments', period);
  const free = data.since ? dailyMetric(data.daily, 'creations', period, { firstTracked: data.since }) : null;
  const traffic = dailyMetric(!visitors.error && visitors.report?.days, 'visitors', period, { average: true });
  return <section className="stats-overview" id="stats-overview" aria-labelledby="stats-overview-title">
    <div className="stats-overview__header">
      <div><h2 id="stats-overview-title">Santa Radio at a glance</h2>
        {data.updatedAt && <small>Updated {formatUkDateTime(data.updatedAt)} UK time</small>}
      </div>
      <div className="stats-overview__period" role="group" aria-label="Trend and app reporting period">
        {[7, 30].map(days => <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} days</button>)}
      </div>
    </div>
    <div className="stats-overview__trends">
      <Trend label="Studio takings" metric={money} format={n => moneyFormat.format(n / 100)} note="Gross · includes today" anchor={link('studio-takings')} tone="gold" />
      <Trend label="Paid Studio orders" metric={orders} note="Includes today" anchor={link('studio-takings')} tone="coral" />
      <Trend label="Free messages made" metric={free} note="Includes today" anchor={link('free-message-activity')} tone="mint" />
      <Trend label="Daily website visitors" metric={traffic} loading={!visitors.report && !visitors.error} note="Daily average · complete days" anchor={link('website-visitors-title')} tone="blue" />
    </div>
    <div className="stats-overview__groups">
      <article><h3><Label anchor={link('app-store-reports')}>App downloads &amp; installs</Label></h3>
        <StoreRow label="Apple new downloads" report={data.appleDownloads} period={period} />
        <StoreRow label="Android device installs" report={android.report} loading={!android.report && !android.error} period={period} unavailableNote={android.report?.issue || android.error ? "See Android tab for details" : undefined} />
      </article>
      <article><h3>Across the station</h3>
        <StatRow label="Contender votes" note="Confirmed · approved entries" value={sumField(data.votes, 'votes')} anchor={link('contender-votes')} />
        <StatRow label="Naughty or Nice PDFs" note="Downloads · last 30 days" value={data.checkerDownloads?.last30Days} anchor={link('checker-downloads')} />
        <StatRow label="Website emails sent" note="Recorded sends · last 30 days" value={data.websiteEmails?.total} anchor={link('website-email-totals')} />
      </article>
    </div>
  </section>;
}
