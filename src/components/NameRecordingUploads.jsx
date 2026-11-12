import { recordingUploadName } from '../lib/recordingUploadName.js';
import { uploadNameRecording } from '../lib/uploadNameRecording.js';
import { useEffect, useRef, useState } from 'react';
import './NameRecordingUploads.css';
const endpoint='/api/name-recording-uploads';
export default function NameRecordingUploads({ownerToken}) {
  const [queue,setQueue]=useState([]),[saved,setSaved]=useState([]);
  const [search,setSearch]=useState(''),[appliedSearch,setAppliedSearch]=useState(''),[pageInfo,setPageInfo]=useState(null),[showQueue,setShowQueue]=useState(true);
  const [batch,setBatch]=useState(null);
  const [libraryScope,setLibraryScope]=useState('live');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[preview,setPreview]=useState(null);
  const urls=useRef(new Set()), alive=useRef(true), controller=useRef(new AbortController()), listVersion=useRef(0);
  useEffect(()=>{alive.current=true;controller.current=new AbortController();return ()=>{alive.current=false;controller.current.abort();for(const url of urls.current)URL.revokeObjectURL(url);};},[]);
  async function request(url,options={}) {
    const response=await fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer studio-owner.${ownerToken}`},cache:'no-store',signal:controller.current.signal});
    if(!response.ok) {const body=await response.json().catch(()=>({}));throw Error(body.error||'The request failed. Please try again.');}
    return response;
  }
  async function load(page=1,query=appliedSearch,scope=libraryScope) {
    const version=++listVersion.current;
    setLoading(true);setError('');
    try {
      const data=await (await request(`${endpoint}?scope=${scope}&page=${page}&search=${encodeURIComponent(query)}`)).json();
      if(alive.current&&version===listVersion.current){setSaved(data.recordings);setPageInfo(data);setAppliedSearch(query);setLibraryScope(scope);}
    }catch(e){if(alive.current&&version===listVersion.current)setError(e.message);}
    finally{if(alive.current&&version===listVersion.current)setLoading(false);}
  }
  function choose(files) {
    setError('');setBatch(null);setShowQueue(true);
    const candidates=Array.from(files).slice(0,20).map(file=>{
      const ext=file.name.split('.').pop().toLowerCase();const valid=['mp3','wav'].includes(ext)&&file.size>0&&file.size<=3*1024*1024;
      const url=valid?URL.createObjectURL(file):null;if(url)urls.current.add(url);
      return {id:crypto.randomUUID(),file,ext,url,name:recordingUploadName(file.name.replace(/\.(mp3|wav)$/i,'').replace(/_/g,' ')),progress:0,status:valid?'Ready':'Use MP3/WAV, up to 3 MB',valid};
    });
    for(const row of queue)if(row.url){URL.revokeObjectURL(row.url);urls.current.delete(row.url);}
    setQueue(candidates);
    if(files.length>20)setError('Please upload up to 20 recordings at a time. The first 20 are shown.');
  }
  async function upload() {
    setBusy(true);setError('');
    const pending=queue.filter(r=>r.valid&&r.status!=='Saved to Blob');
    let completed=0,failed=0;
    setBatch({total:pending.length,completed:0,failed:0,finished:false});
    for(const row of pending) {
      if(!alive.current)break;
      const update=patch=>{if(alive.current)setQueue(old=>old.map(r=>r.id===row.id?{...r,...patch}:r));};
      update({status:'Uploading…',progress:0});
      try {
        const result=await uploadNameRecording(row,ownerToken,{signal:controller.current.signal,onProgress:progress=>update({progress,status:progress===100?'Checking and saving to Blob…':'Uploading…'})});
        update({name:result.name,status:'Saved to Blob',progress:100});completed++;
      } catch(e){update({status:e.message,failed:true});failed++;}
      if(alive.current)setBatch({total:pending.length,completed,failed,finished:false});
    }
    if(alive.current){setBatch({total:pending.length,completed,failed,finished:true});setBusy(false);if(!failed)setShowQueue(false);await load(1,'','testing');}
  }
  async function listen(row) {
    setError('');
    try {const blob=await (await request(endpoint+'?path='+encodeURIComponent(row.path))).blob();if(!alive.current)return;const url=URL.createObjectURL(blob);urls.current.add(url);if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview({name:row.name,url});}
    catch(e){if(alive.current)setError(e.message);}
  }
  return <section className="name-uploads" aria-labelledby="name-upload-title">
    <div className="name-uploads__heading"><div><p className="name-uploads__eyebrow">RECORDING LIBRARY</p><h2 id="name-upload-title">Upload & listen</h2></div><span className="name-uploads__badge">Private Blob library</span></div>
    <p>Browse and play the live Blob library below. New uploads stay in a separate testing area and do not appear in the live name picker. Uploading does not mark requests recorded or send emails.</p>
    <label className="name-uploads__drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)choose(e.dataTransfer.files);}}>
      <strong>Drop recordings here, or choose files</strong><span>MP3 or WAV · up to 3 MB and 30 seconds each · 20 at a time</span>
      <input type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" multiple disabled={busy} onChange={e=>{choose(e.target.files);e.target.value='';}} />
    </label>
    <p>Spaces become dashes automatically: Ellie May → Ellie-May. Original files on your computer are unchanged.</p>
    {batch&&<div className="name-uploads__summary" role="status"><strong>{batch.finished?(batch.failed?'Batch finished with errors':'✓ Upload complete'):'Uploading your batch…'}</strong><p>{batch.completed} of {batch.total} recordings saved to Blob{batch.failed?` · ${batch.failed} failed — retry below`:''}.</p><progress max={batch.total||1} value={batch.completed+batch.failed} aria-label="Recordings processed"/>{!batch.finished&&<small>Keep this screen open while recordings are checked and saved.</small>}</div>}
    {!!queue.length&&<button onClick={()=>setShowQueue(!showQueue)}>{showQueue?'Hide batch details':'Show batch details'} ({queue.length})</button>}
    {showQueue&&queue.map(row=><div className="name-uploads__row" key={row.id}><label>Name<input value={row.name} maxLength={80} disabled={busy||row.status==='Saved to Blob'} onChange={e=>setQueue(old=>old.map(r=>r.id===row.id?{...r,name:e.target.value}:r))}/></label><small>{row.file.name}</small>{row.url&&<audio controls preload="metadata" src={row.url}/>}<small>Saved name: {recordingUploadName(row.name)}.{row.ext}</small><div className="name-uploads__progress"><progress max="100" value={row.progress} aria-label={`Upload progress for ${row.name}`}/><span>{row.status==='Saved to Blob'?'✓ Saved':`${row.progress}% transferred`}</span></div><p role="status">{row.status}</p></div>)}
    {!!queue.length&&<button className="name-uploads__primary" disabled={busy||!queue.some(r=>r.valid&&r.name.trim()&&r.status!=='Saved to Blob')||queue.some(r=>r.valid&&!r.name.trim())} onClick={upload}>{busy?'Uploading recordings…':'Upload for testing'}</button>}
    {error&&<p role="alert">{error}</p>}
    <div className="name-uploads__heading"><h3>{pageInfo?.mode==='live'?'Live recordings':'Saved test recordings'}</h3><button disabled={loading||busy} onClick={()=>load()}>{loading?'Loading…':'Load / refresh recordings'}</button></div>
    <div className="name-uploads__pages"><button disabled={loading} aria-pressed={libraryScope==='live'} onClick={()=>load(1,search,'live')}>Live library</button><button disabled={loading} aria-pressed={libraryScope==='testing'} onClick={()=>load(1,search,'testing')}>Test uploads</button></div>
    <form className="name-uploads__search" onSubmit={e=>{e.preventDefault();load(1,search);}}><label htmlFor="recording-search">Find a recording<input id="recording-search" type="search" value={search} maxLength={80} placeholder="Search names, e.g. Ellie May" onChange={e=>setSearch(e.target.value)}/></label><button disabled={loading} type="submit">Search</button><button type="button" disabled={loading} onClick={()=>{setSearch('');load(1,'');}}>Show all</button></form>
    <p>{pageInfo?`${pageInfo.total} ${appliedSearch?'matching':'saved'} recordings · page ${pageInfo.page} of ${pageInfo.totalPages}`:'Load the library or search for a name.'} · 20 per page</p>
    {pageInfo&&!saved.length&&<p>No recordings found{appliedSearch?` for “${appliedSearch}”`:''}.</p>}
    <p>{pageInfo?.mode==='live'?'Verified Blob recordings. Original server files are retained as a backup.':'Test uploads only. Matching names never replace your existing live recordings.'}</p>
    {saved.map(row=><div className="name-uploads__saved" key={row.path}><span><strong>{row.name}</strong><small>{(row.size/1024).toFixed(0)} KB · {new Date(row.uploadedAt).toLocaleDateString('en-GB')}</small></span><button onClick={()=>listen(row)}>Listen to {row.name}</button></div>)}
    {pageInfo&&pageInfo.totalPages>1&&<nav className="name-uploads__pages" aria-label="Recording pages"><button disabled={loading||pageInfo.page===1} onClick={()=>load(pageInfo.page-1)}>Previous</button><span>Page {pageInfo.page} of {pageInfo.totalPages}</span><button disabled={loading||pageInfo.page===pageInfo.totalPages} onClick={()=>load(pageInfo.page+1)}>Next</button></nav>}
    {preview&&<div className="name-uploads__player"><p>{preview.name} · saved copy</p><audio key={preview.url} controls autoPlay src={preview.url}/></div>}
  </section>;
}
