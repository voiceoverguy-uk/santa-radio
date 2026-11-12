import { useEffect, useRef, useState } from 'react';
import './NameRecordingUploads.css';
const endpoint='/api/name-recording-uploads';
export default function NameRecordingUploads({ownerToken}) {
  const [queue,setQueue]=useState([]),[saved,setSaved]=useState([]),[cursor,setCursor]=useState(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[preview,setPreview]=useState(null);
  const urls=useRef(new Set()), alive=useRef(true), controller=useRef(new AbortController());
  useEffect(()=>{alive.current=true;controller.current=new AbortController();return ()=>{alive.current=false;controller.current.abort();for(const url of urls.current)URL.revokeObjectURL(url);};},[]);
  async function request(url,options={}) {
    const response=await fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer studio-owner.${ownerToken}`},cache:'no-store',signal:controller.current.signal});
    if(!response.ok) {const body=await response.json().catch(()=>({}));throw Error(body.error||'The request failed. Please try again.');}
    return response;
  }
  async function load(more=false) {
    setLoading(true);setError('');
    try {const data=await (await request(endpoint+(more&&cursor?'?cursor='+encodeURIComponent(cursor):''))).json();if(alive.current){setSaved(old=>more?[...old,...data.recordings.filter(r=>!old.some(o=>o.path===r.path))]:data.recordings);setCursor(data.cursor);}}
    catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}
  }
  function choose(files) {
    setError('');
    const candidates=Array.from(files).slice(0,20).map(file=>{
      const ext=file.name.split('.').pop().toLowerCase();const valid=['mp3','wav'].includes(ext)&&file.size>0&&file.size<=3*1024*1024;
      const url=valid?URL.createObjectURL(file):null;if(url)urls.current.add(url);
      return {id:crypto.randomUUID(),file,ext,url,name:file.name.replace(/\.(mp3|wav)$/i,'').replace(/_/g,' ').trim(),status:valid?'Ready':'Use MP3/WAV, up to 3 MB',valid};
    });
    for(const row of queue)if(row.url){URL.revokeObjectURL(row.url);urls.current.delete(row.url);}
    setQueue(candidates);
    if(files.length>20)setError('Please upload up to 20 recordings at a time. The first 20 are shown.');
  }
  async function upload() {
    setBusy(true);setError('');
    for(const row of queue.filter(r=>r.valid&&r.status!=='Saved for testing')) {
      if(!alive.current)break;
      const update=status=>setQueue(old=>old.map(r=>r.id===row.id?{...r,status}:r));
      update('Uploading…');
      try {await request(endpoint,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Recording-Name':encodeURIComponent(row.name.trim()),'X-Recording-Format':row.ext},body:row.file});if(alive.current)update('Saved for testing');}
      catch(e){if(alive.current)update(e.message);}
    }
    if(alive.current){setBusy(false);await load();}
  }
  async function listen(row) {
    setError('');
    try {const blob=await (await request(endpoint+'?path='+encodeURIComponent(row.path))).blob();if(!alive.current)return;const url=URL.createObjectURL(blob);urls.current.add(url);if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview({name:row.name,url});}
    catch(e){if(alive.current)setError(e.message);}
  }
  return <section className="name-uploads" aria-labelledby="name-upload-title">
    <div className="name-uploads__heading"><div><p className="name-uploads__eyebrow">RECORDING LIBRARY</p><h2 id="name-upload-title">Upload & listen</h2></div><span className="name-uploads__badge">Testing only</span></div>
    <p>Try new recordings here before we switch libraries. Saved files stay private and do not appear in the live name picker. Uploading does not mark requests recorded or send emails.</p>
    <label className="name-uploads__drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)choose(e.dataTransfer.files);}}>
      <strong>Drop recordings here, or choose files</strong><span>MP3 or WAV · up to 3 MB and 30 seconds each · 20 at a time</span>
      <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" multiple disabled={busy} onChange={e=>{choose(e.target.files);e.target.value='';}} />
    </label>
    {queue.map(row=><div className="name-uploads__row" key={row.id}><label>Name<input value={row.name} maxLength={80} disabled={busy||row.status==='Saved for testing'} onChange={e=>setQueue(old=>old.map(r=>r.id===row.id?{...r,name:e.target.value}:r))}/></label><small>{row.file.name}</small>{row.url&&<audio controls preload="metadata" src={row.url}/>}<p role="status">{row.status}</p></div>)}
    {!!queue.length&&<button className="name-uploads__primary" disabled={busy||!queue.some(r=>r.valid&&r.name.trim()&&r.status!=='Saved for testing')||queue.some(r=>r.valid&&!r.name.trim())} onClick={upload}>{busy?'Uploading recordings…':'Upload for testing'}</button>}
    {error&&<p role="alert">{error}</p>}
    <div className="name-uploads__heading"><h3>Saved test recordings</h3><button disabled={loading||busy} onClick={()=>load()}>{loading?'Loading…':'Load / refresh recordings'}</button></div>
    <p>Each upload is kept separately. Matching names never replace your existing live recordings.</p>
    {saved.map(row=><div className="name-uploads__saved" key={row.path}><span><strong>{row.name}</strong><small>{(row.size/1024).toFixed(0)} KB · {new Date(row.uploadedAt).toLocaleDateString('en-GB')}</small></span><button onClick={()=>listen(row)}>Listen to {row.name}</button></div>)}
    {cursor&&<button disabled={loading} onClick={()=>load(true)}>Load more</button>}
    {preview&&<div className="name-uploads__player"><p>{preview.name} · saved copy</p><audio key={preview.url} controls autoPlay src={preview.url}/></div>}
  </section>;
}
