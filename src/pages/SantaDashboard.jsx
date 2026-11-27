import AppPromotionManager from '../components/AppPromotionManager.jsx';
import CatalogueArtworkManager from '../components/CatalogueArtworkManager.jsx';
import MessageDemoManager from '../components/MessageDemoManager.jsx';
import { formatUkDate, formatUkDateTime } from '../lib/ukDates.js';
import { DashboardPane, DashboardPanel, DashboardSections, MessageMakerShortcuts, useDashboardAnchor } from '../components/DashboardSections.jsx';
import StatsOverview from '../components/StatsOverview.jsx';
import useDashboardReport from '../hooks/useDashboardReport.js';
import AppStoreReports from '../components/AppStoreReports.jsx';
import ContenderManager from '../components/ContenderManager.jsx';
import WebsiteVisitors from '../components/WebsiteVisitors.jsx';
import BigStitcher from '../components/BigStitcher.jsx';
import DadRecordingSupport from '../components/DadRecordingSupport.jsx';
import DashboardUsefulLinks from '../components/DashboardUsefulLinks.jsx';
import DashboardTodos from '../components/DashboardTodos.jsx';
import ReviewInbox from '../components/ReviewInbox.jsx';
import PaidRevenueChart from '../components/PaidRevenueChart.jsx';
import DashboardBackButton from '../components/DashboardBackButton.jsx';
import CopyRequestedName from '../components/CopyRequestedName.jsx';
import FriendVouchers from '../components/FriendVouchers.jsx';
import NameRecordingUploads from '../components/NameRecordingUploads.jsx';
import { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './SantaDashboard.css';
import SantaRequestLedger from '../components/SantaRequestLedger.jsx';
function RequestedTime({ value }) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return <span>Unavailable</span>;
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
  return <div><time dateTime={date.toISOString()}>{formatUkDateTime(date)}</time><small style={{display:'block'}}>{hours === 0 ? 'Less than an hour ago' : `${hours.toLocaleString('en-GB')} ${hours === 1 ? 'hour' : 'hours'} ago`}</small></div>;
}
export default function SantaDashboard() {
  const [freeDaysVisible,setFreeDaysVisible]=useState(4);
  const [moreGameDays,setMoreGameDays]=useState(false);
  const [dismissed,setDismissed]=useState('');
  const [rejectionNotice,setRejectionNotice]=useState('');
  const [namePage,setNamePage]=useState(1),[namePageSize,setNamePageSize]=useState(10);
  const anchor = useDashboardAnchor();
  const token=useRef(''), request=useRef(0);
  const [input,setInput]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const reportToken = data ? token.current : '';
  const visitors = useDashboardReport(reportToken, 'visitors', data?.updatedAt);
  const android = useDashboardReport(reportToken, 'android-installs', data?.updatedAt);
  async function load(event) {
    event?.preventDefault();const version=++request.current;setBusy(true);setError('');
    if(input) {token.current=input.trim().replace(/^studio-owner\./,'');setInput('');}
    try {
      const response=await fetch('/api/message-statistics',{headers:{Authorization:`Bearer studio-owner.${token.current}`},cache:'no-store',signal:AbortSignal.timeout(45000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error);if(version===request.current)setData(result);
    }catch(e){if(version===request.current)setError(e.name==='TimeoutError'?'The dashboard took too long to respond. Please try again.':(e instanceof SyntaxError?'The dashboard returned an unexpected response. Please try again.':e.message || 'Unable to refresh figures. Check your connection and try again.'));}finally{if(version===request.current)setBusy(false);}
  }
  async function mark(name,action='recorded') {
    if(action==='reject' && !window.confirm(`Reject “${name}” because it includes a surname? Linked requesters will be emailed the first-name-only rule and invited to submit their first name again.`))return;
    setRejectionNotice('');
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/message-statistics',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer studio-owner.${token.current}`},signal:AbortSignal.timeout(30000),body:JSON.stringify({action,name})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);if(action==='reject')setRejectionNotice(`${name} was declined. ${result.notificationsQueued} notification(s) queued. ${result.notificationsQueued ? 'Emails are processed by the notification worker.' : 'No new notification was queued; an email may already be queued/sent, or no saved contact is available.'}`);if(action==='dismiss')setDismissed(name);else if(action==='restore')setDismissed('');await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const namePages=Math.max(1,Math.ceil((data?.names.length||0)/namePageSize));
  const currentNamePage=Math.min(namePage,namePages);
  const nameStart=(currentNamePage-1)*namePageSize;
  const totals=data?.allTime ?? data?.daily.reduce((sum,row)=>({creations:sum.creations+row.creations,downloads:sum.downloads+row.downloads,listens:sum.listens+(row.listens||0),shares:sum.shares+(row.shares||0)}),{creations:0,downloads:0,listens:0,shares:0});
  const freeDays=(data?.daily ?? []).filter(r=>data.since && r.day>=data.since);
  const freeTotals=['creations','listens','downloads','mp4Downloads','shares'].map(key=>freeDays.reduce((sum,row)=>sum+(row[key]||0),0).toLocaleString('en-GB'));
  const table=(headers,rows,footer)=><div className="santa-dashboard__table"><table><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>):<tr><td colSpan={headers.length}>No activity recorded yet.</td></tr>}</tbody>{footer&&<tfoot><tr>{footer.map((cell,i)=>i===0?<th key={i} scope="row">{cell}</th>:<td key={i}>{cell}</td>)}</tr></tfoot>}</table></div>;
  return <main className={data ? "santa-dashboard santa-dashboard--workspace" : "santa-dashboard"}><Helmet><title>Santa Radio · Private dashboard</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <header><p>THE NORTH POLE DESK</p><h1>The Dashboard of Effectiveness</h1><p>Purchases, messages, votes and names to record.</p></header>
    {!data?<form onSubmit={load}><label htmlFor="dashboard-token">Private Studio owner token</label><input id="dashboard-token" type="password" autoComplete="off" value={input} onChange={e=>setInput(e.target.value)} required /><button disabled={busy}>{busy?'Opening…':'Open dashboard'}</button><p>Your token stays in this page’s memory and is cleared when you leave or reload.</p></form>:<>
      {busy && <p role="status">Updating dashboard figures…</p>}<div className="santa-dashboard__actions"><button onClick={load} disabled={busy}>{busy?'Refreshing…':'Refresh figures'}</button><button onClick={()=>{request.current++;token.current='';setData(null);setBusy(false);setError('');}}>Lock dashboard</button></div>
      <DashboardSections anchor={anchor}>
        <DashboardPanel id="overview">
          <StatsOverview data={data} visitors={visitors} android={android} showLinks />
          <WebsiteVisitors source={visitors} />
        </DashboardPanel>
        <DashboardPanel id="message-maker">
          <MessageMakerShortcuts />
          <section id="studio-takings" className="dashboard-themed dashboard-themed--money"><header className="dashboard-themed__header"><div className="dashboard-themed__gifts" aria-hidden="true">£ 💷 £</div><p>SANTA’S STUDIO TAKINGS</p><h2>Paid Message Maker · all time</h2></header>{data.paid ? <><div className="santa-dashboard__cards"><section><strong>{data.paid.purchases.toLocaleString()}</strong><span>Confirmed purchases</span></section><section><strong>{data.paid.creations.toLocaleString()}</strong><span>Paid messages created</span></section><section><strong>{data.paid.grossPence === null ? 'Unavailable' : new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(data.paid.grossPence/100)}</strong><span>Collected through Stripe</span></section></div><PaidRevenueChart daily={data.paid.daily} /><p>Live website purchases only; test payments and vouchers are excluded. Creations count successful messages recorded against those purchases. Stripe totals include discounts, before fees and refunds.</p>{data.paid.grossPence === null && <p>Stripe totals could not load. Refresh figures to try again.</p>}<a href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener noreferrer">Open Stripe payments ↗</a></> : <p>Paid figures could not load. Refresh figures to try again.</p>}</section>
          <h2>Free Message Maker</h2>
          <p>Free-message totals are all time{data.since ? ` since tracking began on ${formatUkDate(data.since)}` : '; tracking has not recorded any activity yet'}. Figures use UK dates. Earlier activity is not reconstructed.</p>
          <div className="santa-dashboard__cards"><section><strong>{totals.creations.toLocaleString()}</strong><span>Free messages created</span></section><section><strong>{totals.downloads.toLocaleString()}</strong><span>First download clicks</span></section><section><strong>{(data.allTime?.mp4Downloads ?? 0).toLocaleString()}</strong><span>MP4 download clicks</span></section><section><strong>{totals.listens.toLocaleString()}</strong><span>Recordings listened to</span></section><section><strong>{totals.shares.toLocaleString()}</strong><span>Recordings shared</span></section></div>
          <p>Each recording counts once per action within seven days of creation: playback started, download button clicked, or share handoff confirmed by the browser. MP4 download clicks are counted separately from this release and are also included in total download clicks. Downloads do not confirm a saved file; shares do not confirm delivery. Player-menu downloads are not counted. Listening and sharing measurement starts 12/11/2026; earlier activity is unavailable. Figures use the date of each action, not a creation cohort. Failed or blocked measurement may be absent. Paid Studio totals are shown separately below.</p>
          <section id="free-message-activity" className="dashboard-themed dashboard-themed--messages"><header className="dashboard-themed__header"><div className="dashboard-themed__gifts" aria-hidden="true">✉️ 📅 ✉️</div><p>MAGIC SENT FROM THE NORTH POLE</p><h2>Daily free-message usage · last 30 days</h2></header>{table(['UK date','Created','Listened','Download clicks','MP4 downloads','Shared'],freeDays.slice(0,freeDaysVisible).map(r=>[formatUkDate(r.day),r.creations,r.listens||0,r.downloads,r.mp4Downloads||0,r.shares||0]),['Total · last 30 days',...freeTotals])}{freeDaysVisible<freeDays.length&&<button type="button" onClick={()=>setFreeDaysVisible(count=>count+4)}>Load more</button>}</section>
          <BigStitcher />
          <DadRecordingSupport ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="vouchers">
          <FriendVouchers ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="demo-videos">
          <MessageDemoManager ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="message-reviews">
          <ReviewInbox ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="names-recordings">
          <div hidden={anchor === 'recording-uploads' || anchor === 'request-ledger'}>
            <section id="name-requests"><h2>Names awaiting your review</h2>{rejectionNotice&&<p role="status">{rejectionNotice}</p>}{dismissed&&<p role="status">Dismissed {dismissed}. <button disabled={busy} onClick={()=>mark(dismissed,'restore')}>Undo</button></p>}{data.nameNotifications?.map(row=><p key={row.state}>Name update emails — {row.state}: {row.count}</p>)}<p>Upload the recording, refresh, then select <strong>Send email</strong>.</p>{data.requests===null?<p>Name requests could not load. <button onClick={()=>window.location.hash='request-ledger'}>Open the full request ledger</button>.</p>:table(['Name','Requests','Requested · UK time','On Server?','Action'],(data.requests||[]).map(r=>[<div><CopyRequestedName name={r.name} />{r.pronunciationNotes?.map(note=><p key={note}><strong>Pronunciation:</strong> {note}</p>)}</div>,r.count,<RequestedTime value={r.firstRequestedAt} />,<span>{r.recordingStatus==='available'?'Yes':r.recordingStatus==='not_found'?'No':'Could not check'}</span>,<div><button disabled={busy} onClick={()=>mark(r.name)}>Send email</button> <button disabled={busy} onClick={()=>mark(r.name,'reject')}>Reject name</button> <button disabled={busy} onClick={()=>mark(r.name,'dismiss')}>Dismiss</button></div>]))}<div className="santa-dashboard__actions"><button onClick={()=>window.location.hash='request-ledger'}>Full request ledger and exports</button><button onClick={()=>window.location.hash='recording-uploads'}>Upload recordings</button></div></section>
          </div>
          <DashboardPane id="recording-uploads" active={anchor === 'recording-uploads'}>
            <DashboardBackButton onClick={() => { window.location.hash = 'name-requests'; }} />
            <NameRecordingUploads ownerToken={token.current} />
          </DashboardPane>
          <DashboardPane id="request-ledger" active={anchor === 'request-ledger'}>
            <SantaRequestLedger embedded ownerToken={token.current} email="Studio owner" onSignOut={() => { window.location.hash = 'name-requests'; load(); }} />
          </DashboardPane>
        </DashboardPanel>
        <DashboardPanel id="popular-names">
          <section className="dashboard-themed dashboard-themed--names"><header className="dashboard-themed__header"><div className="dashboard-themed__gifts" aria-hidden="true">🏷️ ✨ 🏷️</div><p>THE NAMES EVERYONE IS ASKING FOR</p><h2>Popular recorded names · last 30 days</h2></header>{table(['First name','Created'],data.names.slice(nameStart,nameStart+namePageSize).map(r=>[r.name,r.creations]))}<div className="santa-dashboard__pagination"><label>Names per page <select value={namePageSize} onChange={e=>{setNamePageSize(Number(e.target.value));setNamePage(1);}}>{[10,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><span role="status">{data.names.length ? `${nameStart+1}–${Math.min(nameStart+namePageSize,data.names.length)} of ${data.names.length}` : '0 names'}</span><button disabled={currentNamePage<=1} onClick={()=>setNamePage(currentNamePage-1)}>Previous</button><span>Page {currentNamePage} of {namePages}</span><button disabled={currentNamePage>=namePages} onClick={()=>setNamePage(currentNamePage+1)}>Next</button></div></section>
        </DashboardPanel>
        <DashboardPanel id="christmas-contenders">
          <section id="contender-votes" className="dashboard-themed dashboard-themed--music"><header className="dashboard-themed__header"><div className="dashboard-themed__gifts" aria-hidden="true">♫ 🏆 ♫</div><p>THE CHRISTMAS CHART RACE</p><h2>Christmas Contenders votes</h2></header><p><strong>{data.votes.reduce((n,r)=>n+r.votes,0).toLocaleString('en-GB')}</strong> confirmed votes</p><ContenderManager votes={data.votes} ownerToken={token.current} onPublish={()=>load()}/></section>
        </DashboardPanel>
        <DashboardPanel id="artwork">
          <CatalogueArtworkManager ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="apps">
          <AppStoreReports appleReport={data.appleDownloads} androidSource={android} />
        </DashboardPanel>
        <DashboardPanel id="app-welcome-banners">
          <div id="banner-library"><AppPromotionManager ownerToken={token.current} /></div>
        </DashboardPanel>
        <DashboardPanel id="games">
          <section id="checker-downloads" className="dashboard-themed dashboard-themed--elf"><header className="dashboard-themed__header"><img className="dashboard-themed__elf" src="/images/dashboard-elf-peek.png" alt="" aria-hidden="true"/><p>HEAD ELF’S CERTIFICATE DESK</p><h2>Naughty or Nice PDF downloads</h2></header><div className="santa-dashboard__cards">{[['today','Today'],['last30Days','Last 30 days'],['allTime','Since tracking began']].map(([key,label])=><section key={key}><strong>{data.checkerDownloads?.[key]?.toLocaleString() ?? 'Unavailable'}</strong><span>{label}</span></section>)}</div><p>PDFs generated and handed to the browser for download, not confirmed saved files or unique people. Repeat downloads count; failed generation does not. No names, answers or verdicts are recorded. UK dates. Tracking starts with this update; earlier downloads are unavailable.</p></section>
          <section id="game-figures"><h2>Santa Knows Christmas</h2>{data.christmasGame ? <>
          <h3>Rounds started per day</h3>
          {table(['UK date','Plays'],data.christmasGame.daily.slice(0,moreGameDays ? undefined : 5).map(r=>[formatUkDate(r.day),r.plays]))}
          {data.christmasGame.daily.length > 5 && <button aria-expanded={moreGameDays} onClick={()=>setMoreGameDays(!moreGameDays)}>{moreGameDays ? 'Show five days' : 'Reveal more days'}</button>}
          <h3>Films players revealed after beating Santa</h3>
          {table(['Film','Wins'],data.christmasGame.titles.map(r=>[r.title,r.wins]))}
          </> : <p>Game figures are temporarily unavailable.</p>}</section>
        </DashboardPanel>
        <DashboardPanel id="dashboard-todos">
          <DashboardTodos ownerToken={token.current} />
        </DashboardPanel>
        <DashboardPanel id="admin">
          <DashboardUsefulLinks />
          <section id="website-email-totals"><h2>Website emails · last 30 days</h2><div className="santa-dashboard__cards">{[['total','Recorded sends'],['studioAccess','Studio access emails'],['nameUpdates','Name availability updates']].map(([key,label])=><section key={key}><strong>{data.websiteEmails?.[key]?.toLocaleString() ?? 'Unavailable'}</strong><span>{label}</span></section>)}</div><p>Successful sends recorded by the website. This does not confirm inbox delivery. Voting codes, account sign-in emails and marketing campaigns are not included. Missing figures are unavailable, not zero.</p></section>
        </DashboardPanel>
      </DashboardSections>
    </>}{error&&<p role="alert">{error}</p>}
  </main>;
}
