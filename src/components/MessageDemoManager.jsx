import './MessageDemoManager.css';
import { useEffect, useRef, useState } from 'react';
import { demoGroups, maxDemoBytes } from '../lib/messageDemoCatalogue.js';
import { demoEndpoint, fetchDemos } from '../hooks/useMessageDemos.js';

function DemoCollection({group, token, busy, setBusy}) {
  const input = useRef(null);
  const [demos, setDemos] = useState(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchDemos(group, controller.signal).then(rows => {
      if (!controller.signal.aborted) setDemos(rows);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error.message); });
    return () => controller.abort();
  }, [group, revision]);

  async function action(body) {
    const response = await fetch(demoEndpoint(group), {method:'POST', headers:{
      Authorization:'Bearer studio-owner.' + token, 'Content-Type':'application/json',
    }, body:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The demo could not be updated.');
    return result;
  }
  async function upload(event) {
    event.preventDefault();
    if (busy || !file) return;
    if (!/\.mp3$/i.test(file.name) || !file.size || file.size > maxDemoBytes) {
      setNotice('Choose an MP3 of up to 40 MB.'); return;
    }
    setBusy(true); setNotice('');
    try {
      const target = await action({action:'upload', name:name.trim(), size:file.size});
      const response = await fetch(target.url, {method:'PUT', headers:target.headers, body:file});
      if (!response.ok) throw new Error('The upload failed. Please try again.');
      if (input.current) input.current.value = '';
      setFile(null); setName('');
      setNotice('Demo published to ' + demoGroups[group] + '.');
      setRevision(value => value + 1);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  async function remove(row) {
    setBusy(true); setNotice('');
    try {
      await action({action:'delete', id:row.id});
      if (playing === row.id) setPlaying(null);
      setDemos(previous => previous?.filter(item => item.id !== row.id));
      setConfirm(null); setNotice('Demo deleted.'); setRevision(value => value + 1);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  return <>
    <form onSubmit={upload}>
      <label>MP3 audio · up to 40 MB<input ref={input} type="file" accept=".mp3,audio/mpeg" disabled={busy} onChange={event => {
        const selected = event.target.files[0]; setFile(selected || null);
        setName(selected?.name.replace(/\.mp3$/i,'').slice(0,60) || ''); setNotice('');
      }}/></label>
      <label>Demo name<input value={name} maxLength={60} required disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <button type="submit" disabled={!file || !name.trim() || busy}>{busy ? 'Working…' : 'Upload and publish'}</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    {demos === null ? <button type="button" onClick={() => setRevision(n => n + 1)}>Reload demos</button> :
      !demos.length ? <p>No audio examples yet.</p> : <ul className="demo-manager__list">{demos.map(row => <li key={row.id}>
        <strong>{row.name}</strong>
        <div><button type="button" onClick={() => setPlaying(playing === row.id ? null : row.id)}>{playing === row.id ? 'Close player' : 'Play'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirm(row.id)}>Delete</button></div>
        {playing === row.id && <audio src={row.src} controls autoPlay aria-label={'Play ' + row.name} />}
        {confirm === row.id && <div role="group" aria-label="Confirm deletion"><p>Delete “{row.name}” from {demoGroups[group]} examples?</p>
          <button type="button" disabled={busy} onClick={() => remove(row)}>Yes, delete</button>
          <button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>}
      </li>)}</ul>}
  </>;
}
export default function MessageDemoManager({ownerToken}) {
  const [group, setGroup] = useState('kids');
  const [busy, setBusy] = useState(false);
  return <section className="demo-manager" id="message-demos"><h2>Message demo audio</h2>
    <label>Publish examples to <select disabled={busy} value={group} onChange={event => setGroup(event.target.value)}>
      {Object.entries(demoGroups).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
    </select></label>
    <DemoCollection key={group} group={group} token={ownerToken} busy={busy} setBusy={setBusy} />
  </section>;
}
