import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
const number=value=>value?.toLocaleString() ?? 'Unavailable';
export default function AppleAppDownloads({report}) {
  const apps=report?.apps ?? [];
  const period=apps[0] ?? report;
  return <>
    <div className="apple-app-downloads__content">
      <h3>Apple app download rankings</h3>
      <p>Ranked by new downloads over 30 days. Updates and re-downloads are counted separately.</p>
      {apps.length ? <div className="santa-dashboard__table"><table><caption className="apple-app-downloads__caption">{formatUkDate(period.startDate)} to {formatUkDate(period.endDate)} · Apple’s Pacific reporting dates</caption><thead><tr><th scope="col">Rank</th><th scope="col">App</th><th scope="col">Latest day</th><th scope="col">7 days</th><th scope="col">30 days</th><th scope="col">Re-downloads</th><th scope="col">Updates</th></tr></thead><tbody>{apps.map(app=><tr key={app.id}>
        <td>{app.rank ? `#${app.rank}` : '—'}</td>
        <th scope="row"><div className="apple-app-downloads__app"><img src={app.icon} width="44" height="44" alt=""/><div>{app.name}<small>{app.status==='pending'?'Pending · not released':app.status==='released'?'Released':'Release status unavailable'}{app.status!=='pending'&&app.availableDays!==30?` · ${app.availableDays}/30 reports`:''}</small></div></div></th>
        {[app.latest?.downloads,app.last7Days,app.last30Days,app.redownloads30Days,app.updates30Days].map((value,index)=><td key={index}>{app.status==='pending'?'—':number(value)}</td>)}
      </tr>)}</tbody></table></div>:<p>Rankings will appear after the next Apple report import.</p>}
      <p className="apple-app-downloads__note">Re-downloads and updates cover the same 30-day period. Pending apps remain here until released; their artwork is included above. Missing reports show Unavailable, not zero. Apple’s figures are delayed and refresh daily. {period?.latest?.fetchedAt && `Last refreshed: ${formatUkDateTime(period.latest.fetchedAt)}.`}</p>
    </div>
  </>;
}
