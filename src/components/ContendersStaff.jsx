import { useEffect, useState } from 'react';
import './ContendersStaff.css';

const scheduleKeys = ['opensAt', 'closesAt', 'submissionCutoff'];

function editableSettings(settings) {
  const result = { ...settings };
  for (const key of scheduleKeys) {
    const iso = settings[key] ? new Date(settings[key]).toISOString() : '';
    result[key] = iso.replace(/^(\d{4})-(\d{2})-(\d{2})T(.*)Z$/, '$3/$2/$1 $4').replace(/\.000$/, '');
  }
  return result;
}

function scheduleForApi(settings) {
  const result = { ...settings };
  for (const key of scheduleKeys) {
    const value = settings[key]?.trim() || '';
    if (!value && key === 'submissionCutoff') { result[key] = null; continue; }
    const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})(:\d{2}(?:\.\d{1,3})?)?$/.exec(value);
    const day = match && `${match[3]}-${match[2]}-${match[1]}`;
    const iso = match && `${day}T${match[4]}${match[5] || ':00'}Z`;
    const date = iso && new Date(iso);
    if (!date || !Number.isFinite(date.getTime()) || !date.toISOString().startsWith(day + 'T')) {
      throw new Error('Enter a valid UTC date and time as DD/MM/YYYY HH:mm, for example 24/11/2026 17:30.');
    }
    result[key] = iso;
  }
  return result;
}

const blankEntry = {id:'',mode:'live',artist:'',title:'',artwork:'',audio:'',approved:false};
export default function ContendersStaff() {
  const [data,setData] = useState(null);
  const [settings,setSettings] = useState(null);
  const [entry,setEntry] = useState(blankEntry);
  const [editing,setEditing] = useState(false);
  const [message,setMessage] = useState('');
  const [pending,setPending] = useState(false);
  const request = async body => {
    const response = await fetch('/api/christmas-contenders?staff=1', {
      method:body ? 'PATCH' : 'GET', credentials:'same-origin',
      headers:body ? {'Content-Type':'application/json'} : {},
      body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(10000),
    });
    const next = await response.json();
    if (!response.ok) throw new Error(next.error || 'Competition management is unavailable.');
    return next;
  };
  useEffect(() => {
    let active = true;
    request().then(next => {if(active){setData(next);setSettings(editableSettings(next.settings));}})
      .catch(error => {if(active)setMessage(error.message);});
    return () => {active=false;};
  },[]);
  const save = async body => {
    if(pending)return;
    setPending(true);setMessage('');
    try { const next=await request(body?.action === 'settings' ? { ...body, settings: scheduleForApi(body.settings) } : body);setData(next);setSettings(editableSettings(next.settings));setMessage(body ? 'Saved. Real voting and real forwarding remain disabled in this preview.' : 'Results refreshed.'); }
    catch(error){setMessage(error.message);}
    finally{setPending(false);}
  };
  return <section className="contenders-staff staff-panel" aria-labelledby="contenders-staff-title">
    <h2 id="contenders-staff-title">Christmas Contenders 2026 · Preview</h2>
    <p>Screen entries manually for lyrics, family suitability and rights before approval. Real voting is not enabled. Email checks are syntax-only, not ownership verification. Preview forwarding is simulated through the existing SONG destination contract; no mail or subscription is sent. The site retains fingerprints, counts and minimal consent/forwarding status, not new recoverable emails.</p>
    <p role="status">{message}</p>
    {data && settings && <>
      <p>Voting status: <strong>{data.status}</strong> · Demo: <strong>{data.demoStatus}</strong></p>
      <form onSubmit={event => {event.preventDefault();save({action:'settings',settings});}}>
        <fieldset disabled={pending}><legend>Voting settings</legend>
          {scheduleKeys.map(key => <label key={key}>{({opensAt:'Voting opens (UTC)',closesAt:'Voting closes (UTC)',submissionCutoff:'Submission cutoff (UTC, optional)'})[key]}
            <input value={settings[key] || ''} required={key!=='submissionCutoff'} maxLength={40} placeholder="DD/MM/YYYY HH:mm"
              onChange={event => setSettings({...settings,[key]:event.target.value || null})} /></label>)}
          <label>Live availability<select value={settings.availability} onChange={event=>setSettings({...settings,availability:event.target.value})}>
            <option value="scheduled">Use voting dates</option><option value="closed">Closed</option><option value="unavailable">Unavailable</option>
          </select></label>
          <label>Isolated demo availability<select value={settings.demoAvailability} onChange={event=>setSettings({...settings,demoAvailability:event.target.value})}>
            <option value="open">Open (independent of live dates)</option><option value="closed">Closed</option><option value="unavailable">Unavailable</option>
          </select></label>
          <label><input type="checkbox" checked={settings.repeatDemo === true}
            onChange={event=>setSettings({...settings,repeatDemo:event.target.checked})} /> Allow repeat demo ballots for preview testing only (never real votes)</label>
          <button type="submit">Save voting settings</button>
        </fieldset>
      </form>
      <h3>Screened entries</h3>
      <ul>{data.entries.map(e=><li key={`${e.mode}:${e.id}`}>{e.artist} — {e.title} · {e.mode.toUpperCase()} · {e.approved?'approved':'not published'} · {e.total} confirmed
        {' '}<button type="button" disabled={pending} onClick={()=>{setEntry(e);setEditing(true);}}>Edit</button></li>)}</ul>
      <button type="button" disabled={pending} onClick={()=>{setEntry({...blankEntry});setEditing(false);}}>New screened entry</button>
      <form onSubmit={event=>{event.preventDefault();save({action:'entry',entry});}}>
        <fieldset disabled={pending}><legend>Entry details</legend>
          <p>IDs and mode are permanent. Never repurpose a demo entry as live. HTTPS review-approved media only; no automatic uploads.</p>
          {['id','artist','title','artwork','audio'].map(key=><label key={key}>{({id:'Stable entry ID (lowercase letters, numbers, hyphens)',artist:'Artist',title:'Song title',artwork:'Secure artwork URL',audio:'Secure audio URL'})[key]}
            <input required value={entry[key]} maxLength={key==='id'?80:key==='artist'?120:key==='title'?160:400}
              readOnly={key==='id' && editing} onChange={event=>setEntry({...entry,[key]:event.target.value})} /></label>)}
          <label>Mode<select value={entry.mode} disabled={editing} onChange={event=>setEntry({...entry,mode:event.target.value})}>
            <option value="live">Live (not enabled in preview)</option><option value="demo">Isolated demo</option></select></label>
          <label><input type="checkbox" checked={entry.approved} onChange={event=>setEntry({...entry,approved:event.target.checked})} /> Manually screened and approved for publication</label>
          <button type="submit">Save screened entry</button>
        </fieldset>
      </form>
      <h3>Latest 100 ballots and forwarding status</h3>
      <button type="button" disabled={pending} onClick={()=>save()}>Refresh results</button>
      <p>No email addresses or visitor names are stored here. Invalidated ballots stay deduplicated; totals use confirmed ballots only. Uncertain forwarding must not be resent without checking its reference. These review buttons only reconcile simulated preview results, never a real inbox.</p>
      <ul>{data.ballots.map(b=><li key={b.id}>{b.mode} · {b.entryId} · {b.state} · {b.id}
        {' '}· Forwarding: {b.delivery || (b.state==='pending'?'not started':'legacy ballot')}
        {b.delivery && <> · Marketing choice: {b.marketingOptIn?'yes':'no'}</>}
        {b.mode==='demo' && b.state==='pending' && b.delivery==='unknown' && <>
          <button type="button" disabled={pending} onClick={()=>{
            if(window.confirm(`Simulate acceptance for reference ${b.id}? This will count this isolated demo once without sending email.`))
              save({action:'notification-review',id:b.id,decision:'accepted',acknowledged:true});
          }}>Resolve as simulated acceptance</button>
          <button type="button" disabled={pending} onClick={()=>{
            if(window.confirm(`Confirm this simulated notification was not accepted? Reference ${b.id} will remain uncounted and an explicit retry will be allowed.`))
              save({action:'notification-review',id:b.id,decision:'not-accepted',acknowledged:true});
          }}>Resolve as not accepted</button>
        </>}
        {b.state==='confirmed'&&<button type="button" disabled={pending} onClick={()=>save({action:'invalidate',id:b.id})}>Invalidate suspicious ballot</button>}</li>)}</ul>
    </>}
  </section>;
}
