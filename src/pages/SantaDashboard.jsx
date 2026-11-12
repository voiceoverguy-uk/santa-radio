import FriendVouchers from '../components/FriendVouchers.jsx';
import NameRecordingUploads from '../components/NameRecordingUploads.jsx';
import { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './SantaDashboard.css';
import SantaRequestLedger from '../components/SantaRequestLedger.jsx';
export default function SantaDashboard() {
  const [dismissed,setDismissed]=useState('');
  const [rejectionNotice,setRejectionNotice]=useState('');
  const [namePage,setNamePage]=useState(1),[namePageSize,setNamePageSize]=useState(20);
  const [ledger,setLedger]=useState(false);
  const [uploads,setUploads]=useState(false);
  const token=useRef(''), request=useRef(0);
  const [input,setInput]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(event) {
    event?.preventDefault();const version=++request.current;setBusy(true);setError('');
    if(input) {token.current=input.trim().replace(/^studio-owner\./,'');setInput('');}
    try {
      const response=await fetch('/api/message-statistics',{headers:{Authorization:`Bearer studio-owner.${token.current}`},cache:'no-store'});
      const result=await response.json();if(!response.ok)throw new Error(result.error);if(version===request.current)setData(result);
    }catch(e){if(version===request.current)setError(e.message || 'Unable to load dashboard.');}finally{if(version===request.current)setBusy(false);}
  }
  async function mark(name,action='recorded') {
    if(action==='reject' && !window.confirm(`Reject “${name}” because it includes a surname? Linked requesters will be emailed the first-name-only rule and invited to submit their first name again.`))return;
    setRejectionNotice('');
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/message-statistics',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer studio-owner.${token.current}`},body:JSON.stringify({action,name})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);if(action==='reject')setRejectionNotice(`${name} was declined. ${result.notificationsQueued} notification(s) queued. ${result.notificationsQueued ? 'Emails are processed by the notification worker.' : 'No new notification was queued; an email may already be queued/sent, or no saved contact is available.'}`);if(action==='dismiss')setDismissed(name);else if(action==='restore')setDismissed('');await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if (uploads && data) return <main className="santa-dashboard"><button onClick={()=>setUploads(false)}>← Back to dashboard</button><NameRecordingUploads ownerToken={token.current}/></main>;
  if (ledger && data) return <SantaRequestLedger ownerToken={token.current} email="Studio owner" onSignOut={()=>{setLedger(false);load();}} />;
  const namePages=Math.max(1,Math.ceil((data?.names.length||0)/namePageSize));
  const currentNamePage=Math.min(namePage,namePages);
  const nameStart=(currentNamePage-1)*namePageSize;
  const totals=data?.daily.reduce((sum,row)=>({creations:sum.creations+row.creations,downloads:sum.downloads+row.downloads}),{creations:0,downloads:0});
  const table=(headers,rows)=><div className="santa-dashboard__table"><table><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>):<tr><td colSpan={headers.length}>No activity recorded yet.</td></tr>}</tbody></table></div>;
  return <main className="santa-dashboard"><Helmet><title>Santa Radio · Private dashboard</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <header><p>THE NORTH POLE DESK</p><h1>Dashboard of Effectiveness</h1><p>Purchases, messages, votes and names to record.</p></header>
    {!data?<form onSubmit={load}><label htmlFor="dashboard-token">Private Studio owner token</label><input id="dashboard-token" type="password" autoComplete="off" value={input} onChange={e=>setInput(e.target.value)} required /><button disabled={busy}>{busy?'Opening…':'Open dashboard'}</button><p>Your token stays in this page’s memory and is cleared when you leave or reload.</p></form>:<>
      <div className="santa-dashboard__actions"><button onClick={()=>setUploads(true)}>Upload recordings</button><button onClick={load} disabled={busy}>{busy?'Refreshing…':'Refresh figures'}</button><button onClick={()=>{request.current++;token.current='';setData(null);setBusy(false);setError('');}}>Lock dashboard</button></div>
      <p>Free-message figures cover the last 30 days, by UK date. Earlier free-message activity is not reconstructed.</p>
      <div className="santa-dashboard__cards"><section><strong>{totals.creations.toLocaleString()}</strong><span>Free messages created</span></section><section><strong>{totals.downloads.toLocaleString()}</strong><span>First download clicks</span></section><section><strong>{data.votes.reduce((n,r)=>n+r.votes,0).toLocaleString()}</strong><span>Confirmed competition votes</span></section></div>
      <p>Download figures count the first click for each recording, not a confirmed file save. Failed or blocked measurement requests may be absent. Paid Studio totals are shown separately below.</p>
      <section><h2>Paid Message Maker · all time</h2>{data.paid ? <><div className="santa-dashboard__cards"><section><strong>{data.paid.purchases.toLocaleString()}</strong><span>Confirmed purchases</span></section><section><strong>{data.paid.creations.toLocaleString()}</strong><span>Paid messages created</span></section><section><strong>{data.paid.grossPence === null ? 'Unavailable' : new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(data.paid.grossPence/100)}</strong><span>Collected through Stripe</span></section></div><p>Live website purchases only; test payments and vouchers are excluded. Creations count successful messages recorded against those purchases. Stripe totals include discounts, before fees and refunds.</p>{data.paid.grossPence === null && <p>Stripe totals could not load. Refresh figures to try again.</p>}<a href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener noreferrer">Open Stripe payments ↗</a></> : <p>Paid figures could not load. Refresh figures to try again.</p>}</section>
      <FriendVouchers ownerToken={token.current} />
      <section><h2>Website emails · last 30 days</h2><div className="santa-dashboard__cards">{[['total','Recorded sends'],['studioAccess','Studio access emails'],['nameUpdates','Name availability updates']].map(([key,label])=><section key={key}><strong>{data.websiteEmails?.[key]?.toLocaleString() ?? 'Unavailable'}</strong><span>{label}</span></section>)}</div><p>Successful sends recorded by the website. This does not confirm inbox delivery. Voting codes, account sign-in emails and marketing campaigns are not included. Missing figures are unavailable, not zero.</p></section>
      <section><h2>Daily free-message usage</h2>{table(['UK date','Created','Download clicks'],data.daily.filter(r=>data.since && r.day>=data.since).map(r=>[r.day,r.creations,r.downloads]))}</section>
      <section><h2>Popular recorded names</h2>{table(['First name','Created','Download clicks'],data.names.slice(nameStart,nameStart+namePageSize).map(r=>[r.name,r.creations,r.downloads]))}<div className="santa-dashboard__pagination"><label>Names per page <select value={namePageSize} onChange={e=>{setNamePageSize(Number(e.target.value));setNamePage(1);}}>{[20,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><span role="status">{data.names.length ? `${nameStart+1}–${Math.min(nameStart+namePageSize,data.names.length)} of ${data.names.length}` : '0 names'}</span><button disabled={currentNamePage<=1} onClick={()=>setNamePage(currentNamePage-1)}>Previous</button><span>Page {currentNamePage} of {namePages}</span><button disabled={currentNamePage>=namePages} onClick={()=>setNamePage(currentNamePage+1)}>Next</button></div></section>
      <section><h2>Christmas Contenders votes</h2>{table(['Artist','Song','Confirmed votes'],data.votes.map(r=>[r.artist,r.title,r.votes]))}</section>
      <section><h2>Names awaiting your review</h2>{rejectionNotice&&<p role="status">{rejectionNotice}</p>}{dismissed&&<p role="status">Dismissed {dismissed}. <button disabled={busy} onClick={()=>mark(dismissed,'restore')}>Undo</button></p>}{data.nameNotifications?.map(row=><p key={row.state}>Name update emails — {row.state}: {row.count}</p>)}<p>Record and add the name to the library first, then mark it recorded. The server check uses exact names in the live index, or confirms the audio file directly if the index is unavailable. Refresh after uploading. Requests never add audio automatically. Marking recorded queues email updates for linked requesters. Emails are processed within five minutes. Only first names and double-barrelled first names (with a space or hyphen) can be requested. Use Reject — full name when a surname is included; this queues an explanation for linked requesters. Dismiss does not email anyone.</p>{data.requests===null?<p>Name requests could not load. <button onClick={()=>setLedger(true)}>Open the full request ledger</button>.</p>:table(['Name','Requests','Recording on server','Action'],(data.requests||[]).map(r=>[r.name,r.count,<span>{r.recordingStatus==='available'?'✓ On server — ready to mark':r.recordingStatus==='not_found'?'Not found in live index':'Could not check'}</span>,<div><button disabled={busy} onClick={()=>mark(r.name)}>Mark recorded</button> <button disabled={busy} onClick={()=>mark(r.name,'reject')}>Reject — full name</button> <button disabled={busy} onClick={()=>mark(r.name,'dismiss')}>Dismiss</button></div>]))}<p><button onClick={()=>setLedger(true)}>Full request ledger and exports</button></p></section>
    </>}{error&&<p role="alert">{error}</p>}
  </main>;
}
