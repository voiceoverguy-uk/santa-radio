import { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import './SantaDashboard.css';
import SantaRequestLedger from '../components/SantaRequestLedger.jsx';
export default function SantaDashboard() {
  const [dismissed,setDismissed]=useState('');
  const [ledger,setLedger]=useState(false);
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
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/message-statistics',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer studio-owner.${token.current}`},body:JSON.stringify({action,name})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);if(action==='dismiss')setDismissed(name);else if(action==='restore')setDismissed('');await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if (ledger && data) return <SantaRequestLedger ownerToken={token.current} email="Studio owner" onSignOut={()=>{setLedger(false);load();}} />;
  const totals=data?.daily.reduce((sum,row)=>({creations:sum.creations+row.creations,downloads:sum.downloads+row.downloads}),{creations:0,downloads:0});
  const table=(headers,rows)=><div className="santa-dashboard__table"><table><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>):<tr><td colSpan={headers.length}>No activity recorded yet.</td></tr>}</tbody></table></div>;
  return <main className="santa-dashboard"><Helmet><title>Santa Radio · Private dashboard</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <header><p>THE NORTH POLE DESK</p><h1>Santa Radio dashboard</h1><p>Votes, free messages and names to record.</p></header>
    {!data?<form onSubmit={load}><label htmlFor="dashboard-token">Private Studio owner token</label><input id="dashboard-token" type="password" autoComplete="off" value={input} onChange={e=>setInput(e.target.value)} required /><button disabled={busy}>{busy?'Opening…':'Open dashboard'}</button><p>Your token stays in this page’s memory and is cleared when you leave or reload.</p></form>:<>
      <div className="santa-dashboard__actions"><button onClick={load} disabled={busy}>{busy?'Refreshing…':'Refresh figures'}</button><button onClick={()=>{request.current++;token.current='';setData(null);setBusy(false);setError('');}}>Lock dashboard</button></div>
      <p>Message figures cover the last 30 days, by UK date. Tracking starts with this release; earlier activity is not reconstructed.</p>
      <div className="santa-dashboard__cards"><section><strong>{totals.creations.toLocaleString()}</strong><span>Free messages created</span></section><section><strong>{totals.downloads.toLocaleString()}</strong><span>First download clicks</span></section><section><strong>{data.votes.reduce((n,r)=>n+r.votes,0).toLocaleString()}</strong><span>Confirmed competition votes</span></section></div>
      <p>Download figures count the first click for each recording, not a confirmed file save. Failed or blocked measurement requests may be absent. Paid Studio messages are not included.</p>
      <section><h2>Daily free-message usage</h2>{table(['UK date','Created','Download clicks'],data.daily.filter(r=>data.since && r.day>=data.since).map(r=>[r.day,r.creations,r.downloads]))}</section>
      <section><h2>Popular recorded names</h2>{table(['First name','Created','Download clicks'],data.names.map(r=>[r.name,r.creations,r.downloads]))}</section>
      <section><h2>Christmas Contenders votes</h2>{table(['Artist','Song','Confirmed votes'],data.votes.map(r=>[r.artist,r.title,r.votes]))}</section>
      <section><h2>Names awaiting your review</h2>{dismissed&&<p role="status">Dismissed {dismissed}. <button disabled={busy} onClick={()=>mark(dismissed,'restore')}>Undo</button></p>}{data.nameNotifications?.map(row=><p key={row.state}>Name update emails — {row.state}: {row.count}</p>)}<p>Record and add the name to the library first, then mark it recorded. Requests never add audio automatically. Marking recorded queues email updates for linked requesters. Emails are processed within five minutes. Dismiss does not email anyone.</p>{data.requests===null?<p>Name requests could not load. <button onClick={()=>setLedger(true)}>Open the full request ledger</button>.</p>:table(['Name','Requests','Action'],(data.requests||[]).map(r=>[r.name,r.count,<div><button disabled={busy} onClick={()=>mark(r.name)}>Mark recorded</button> <button disabled={busy} onClick={()=>mark(r.name,'dismiss')}>Dismiss</button></div>]))}<p><button onClick={()=>setLedger(true)}>Full request ledger and exports</button></p></section>
    </>}{error&&<p role="alert">{error}</p>}
  </main>;
}
