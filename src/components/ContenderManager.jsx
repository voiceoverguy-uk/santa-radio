import { useState } from 'react';
import { put } from '@vercel/blob/client';

const formats = {mp3:'audio/mpeg',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
function Contact({entry,run,busy}) {
  const [name,setName]=useState(entry.name), [email,setEmail]=useState(entry.email);
  const dirty=name!==entry.name || email!==entry.email;
  return <details><summary>{entry.artist} — {entry.title}</summary>
    <form onSubmit={e=>{e.preventDefault();run({action:'contact',id:entry.id,name,email},'Contact saved.');}}>
      <label>Contact name<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
      <label>Contact email<input type="email" value={email} maxLength={254} onChange={e=>setEmail(e.target.value)}/></label>
      <button disabled={busy || !dirty}>Save contact</button>
      <button type="button" disabled={busy || dirty || !entry.email || entry.state!=='ready'}
        onClick={()=>run({action:'invite',id:entry.id,email:entry.email},'Brevo accepted the invitation.')}>Send invitation</button>
      {entry.state==='sent' && <span> Sent {new Date(entry.sentAt).toLocaleDateString('en-GB')}</span>}
      {entry.state==='sending' && <span> Delivery pending confirmation. Check Brevo’s transactional log.</span>}
    </form></details>;
}
export default function ContenderManager({ownerToken,onPublish}) {
  const [entries,setEntries]=useState(null), [busy,setBusy]=useState(false), [notice,setNotice]=useState('');
  const [files,setFiles]=useState({}), [job,setJob]=useState(null);
  async function request(body) {
    const response=await fetch('/api/message-statistics?view=contenders',{method:body?'PATCH':'GET',cache:'no-store',
      headers:{Authorization:`Bearer studio-owner.${ownerToken}`,'Content-Type':'application/json'},body:body && JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || 'Unable to update contenders.');
    return result;
  }
  async function refresh(){setEntries((await request()).entries);}
  async function run(body,message) {
    setBusy(true);setNotice('');
    try { if(body) await request(body); await refresh();setNotice(message); }
    catch(error){setNotice(error.message);if(body) await refresh().catch(()=>{});}
    finally{setBusy(false);}
  }
  async function publish(event) {
    event.preventDefault();
    const form=event.currentTarget, fields=Object.fromEntries(new FormData(form));
    setBusy(true);
    const upload=job || {id:'song-'+crypto.randomUUID(),done:{}};
    setJob(upload);
    try {
      for(const key of ['audio','artwork']) {
        const file=files[key], ext=file?.name.split('.').pop().toLowerCase().replace(/^jpeg$/,'jpg');
        if(!file || !(key==='audio'?ext==='mp3':['jpg','png','webp'].includes(ext)) || !file.size || file.size>(key==='audio'?40:10)*1024*1024)
          throw new Error(key==='audio'?'Choose an MP3 up to 40 MB.':'Choose a JPG, PNG or WebP up to 10 MB.');
        if(upload.done[key]!==file) {
          setNotice(`Uploading ${file.name}…`);
          const {pathname,token,access}=await request({action:'upload',id:upload.id,ext});
          await put(pathname,file,{access,token,contentType:formats[ext]});
          upload.done[key]=file;
        }
        if(key==='artwork') upload.ext=ext;
      }
      await request({...fields,action:'publish',id:upload.id,ext:upload.ext});
      form.reset();setFiles({});setJob(null);setNotice('Song published to Christmas Contenders.');await refresh();onPublish();
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  }
  return <div className="contender-manager">
    <button type="button" disabled={busy} onClick={()=>entries ? setEntries(null) : run(null,'')}>{entries?'Close song management':'Manage songs and invitations'}</button>
    <p role="status">{notice}</p>
    {entries && <><h3>Add a contender</h3><form onSubmit={publish}><fieldset disabled={busy}>
      {[['artist','Artist',120],['title','Song title',160],['name','Private contact name',120],['email','Private contact email',254]].map(([key,label,max])=><label key={key}>{label}
        <input name={key} type={key==='email'?'email':'text'} maxLength={max} required={key==='artist'||key==='title'}/></label>)}
      {['audio','artwork'].map(key=><label key={key} className="contender-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy){setFiles({...files,[key]:e.dataTransfer.files[0]});setJob(null);}}}>
        {key==='audio'?'Drop or choose MP3 (40 MB max)':'Drop or choose artwork (JPG, PNG or WebP, 10 MB max)'}
        <input type="file" accept={key==='audio'?'.mp3':'.jpeg,.jpg,.png,.webp'} onChange={e=>{setFiles({...files,[key]:e.target.files[0]});setJob(null);}}/>
        {files[key]?.name}</label>)}
      <button>Publish song</button></fieldset></form><h3>Artist contacts and invitations</h3>
      {entries.map(entry=><Contact key={[entry.id,entry.name,entry.email].join('|')} entry={entry} run={run} busy={busy}/>)}</>}
  </div>;
}
