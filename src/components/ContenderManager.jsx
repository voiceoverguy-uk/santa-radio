import { useState } from 'react';
import { uploadPresigned } from '@vercel/blob/client';

const formats = {mp3:'audio/mpeg',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
function ReviewLink({id}) {
  return <a href={`/christmas-contenders#${id}`} target="_blank" rel="noreferrer">Check artwork and listen to the song ↗</a>;
}
function Contact({entry,run,busy,replace}) {
  const [file,setFile]=useState(null), [status,setStatus]=useState('');

  const [name,setName]=useState(entry.name), [email,setEmail]=useState(entry.email);
  const dirty=name!==entry.name || email!==entry.email;
  return <details><summary><span style={{display:'inline-grid',gridTemplateColumns:'minmax(0, 1fr) 5rem',alignItems:'center',width:'calc(100% - 1.5em)',verticalAlign:'middle'}}>
      <span>{entry.artist} — {entry.title}</span>
      <span style={{textAlign:'center',color:entry.state==='sent'?'#94ebae':undefined}} aria-label={entry.state==='sent'?'Invitation sent':entry.state==='sending'?'Invitation pending':'Not invited'} role="img">
        {entry.state==='sent'?'✓':entry.state==='sending'?'Pending':'—'}
      </span>
    </span></summary>
    <form onSubmit={e=>{e.preventDefault();run({action:'contact',id:entry.id,name,email},'Contact saved.');}}>
      <label>Contact name<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label>
      <label>Contact email<input type="email" value={email} maxLength={254} onChange={e=>setEmail(e.target.value)}/></label>
      <button disabled={busy || !dirty}>Save contact</button>
      <button type="button" disabled={busy || dirty || !entry.email || entry.state!=='ready'}
        onClick={()=>run({action:'invite',id:entry.id,email:entry.email},'Brevo accepted the invitation.')}>Send invitation</button>
      {entry.state==='sent' && <span> Sent {new Date(entry.sentAt).toLocaleDateString('en-GB')}</span>}
      {entry.state==='sending' && <span> Delivery pending confirmation. Check Brevo’s transactional log.</span>}
    </form>
    <form onSubmit={async event=>{
      event.preventDefault();const form=event.currentTarget;
      try {await replace(entry,file,setStatus);setFile(null);form.reset();}
      catch(error){setStatus(error.message);}
    }}>
      <label>Replacement MP3 (up to 40 MB)<input type="file" accept=".mp3" required onChange={e=>setFile(e.target.files[0])}/></label>
      <button disabled={busy || !file}>Replace MP3</button>
      <p role="status">{status}</p>
    </form><ReviewLink id={entry.id}/></details>;
}
export default function ContenderManager({ownerToken,onPublish}) {
  const [tab,setTab]=useState('songs');
  const [entries,setEntries]=useState(null), [busy,setBusy]=useState(false), [notice,setNotice]=useState('');
  const [files,setFiles]=useState({}), [job,setJob]=useState(null);
  const [published,setPublished]=useState(null);
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
    try {
      if (body?.action === 'invite') {
        const entry = entries.find(item => item.id === body.id);
        const rendererUrl = '/contenders/render-picture.js';
        const { votingPicture } = await import(/* @vite-ignore */ rendererUrl);
        const picture = await votingPicture(entry);
        const key = 'poster-' + crypto.randomUUID();
        await uploadFile(key, 'png', picture, () => {});
        body = { ...body, poster: key };
      }
      if(body) await request(body); await refresh();setNotice(message); }
    catch(error){setNotice(error.message);if(body) await refresh().catch(()=>{});}
    finally{setBusy(false);}
  }
  async function uploadFile(id,ext,file,progress) {
          await uploadPresigned(`christmas-contenders/${id}.${ext}`,file,{
            access:'private',contentType:formats[ext],
            handleUploadUrl:'/api/message-statistics?view=contender-upload',
            headers:{Authorization:`Bearer studio-owner.${ownerToken}`},
            onUploadProgress:({percentage})=>progress(`Uploading ${file.name} — ${Math.round(percentage)}%`)
          });
  }
  async function replace(entry,file,progress) {
    if(!file || !/\.mp3$/i.test(file.name) || !file.size || file.size>40*1024*1024) throw new Error('Choose an MP3 up to 40 MB.');
    setBusy(true);
    try {
      const key='song-'+crypto.randomUUID();
      progress('Uploading replacement MP3…');
      await uploadFile(key,'mp3',file,progress);
      const result=await request({action:'replace-audio',id:entry.id,key,previous:entry.audio});
      setEntries(rows=>rows.map(row=>row.id===entry.id?{...row,audio:result.audio}:row));
      progress('Replacement MP3 published. Your votes are preserved. No email sent.');
    } finally {setBusy(false);}
  }
  async function publish(event) {
    event.preventDefault();
    setPublished(null);
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
          await uploadFile(upload.id,ext,file,setNotice);
          upload.done[key]=file;
        }
        if(key==='artwork') upload.ext=ext;
      }
      setNotice('Publishing your song…');
      await request({...fields,action:'publish',id:upload.id,ext:upload.ext});
      form.reset();setFiles({});setJob(null);setNotice('');setPublished({id:upload.id,title:fields.title});await refresh();onPublish();
    }catch(error){setNotice(error.message);}
    finally{setBusy(false);}
  }
  return <div className="contender-manager">
    <div role="tablist" aria-label="Christmas Contenders management" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {['songs','artists'].map(key=><button key={key} type="button" role="tab"
        id={'contender-tab-'+key} aria-controls={'contender-panel-'+key} aria-selected={tab===key}
        tabIndex={tab===key?0:-1} disabled={busy}
        style={{borderBottom:tab===key?'3px solid #f5d58e':undefined}}
        onKeyDown={event=>{
          const target={ArrowRight:tab==='songs'?'artists':'songs',ArrowLeft:tab==='songs'?'artists':'songs',Home:'songs',End:'artists'}[event.key];
          if(target){event.preventDefault();const button=document.getElementById('contender-tab-'+target);button.focus();button.click();}
        }}
        onClick={()=>{setTab(key);if(key==='artists' && !entries)run(null,'');else if(key!==tab)setNotice('');}}>
        {key==='songs'?'Add new songs':'Artists and Invites'}
      </button>)}
    </div>
    <div role="tabpanel" id="contender-panel-songs" aria-labelledby="contender-tab-songs" hidden={tab!=='songs'}><form onSubmit={publish}><fieldset disabled={busy}>
      {[['artist','Artist',120],['title','Song title',160],['name','Private contact name',120],['email','Private contact email',254]].map(([key,label,max])=><label key={key}>{label}
        <input name={key} type={key==='email'?'email':'text'} maxLength={max} required={key==='artist'||key==='title'}/></label>)}
      {['audio','artwork'].map(key=><label key={key} className="contender-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy){setFiles({...files,[key]:e.dataTransfer.files[0]});setJob(null);}}}>
        {key==='audio'?'Drop or choose MP3 (40 MB max)':'Drop or choose artwork (JPG, PNG or WebP, 10 MB max)'}
        <input type="file" accept={key==='audio'?'.mp3':'.jpeg,.jpg,.png,.webp'} onChange={e=>{setFiles({...files,[key]:e.target.files[0]});setJob(null);}}/>
        {files[key]?.name}</label>)}
      <button>{busy ? 'Please wait…' : 'Publish song'}</button><p role="status" aria-live="polite">{notice}</p>{published && <div role="status"><strong>✓ “{published.title}” is published.</strong><p>No email has been sent. Check the artwork and recording, then choose Send invitation when you’re ready.</p><ReviewLink id={published.id}/></div>}</fieldset></form></div>
    <div role="tabpanel" id="contender-panel-artists" aria-labelledby="contender-tab-artists" hidden={tab!=='artists'}>
      <p role="status">{notice || (busy && !entries ? 'Loading artists…' : entries?.length===0 ? 'No artists yet.' : '')}</p>
      {!entries && !busy && notice && <button type="button" onClick={()=>run(null,'')}>Try again</button>}
      {entries?.length>0 && <div style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr) 5rem',paddingLeft:'1.5em',fontWeight:700}}><span>Artist and song</span><span style={{textAlign:'center'}}>Invited</span></div>}
      {entries?.map(entry=><Contact key={[entry.id,entry.name,entry.email].join('|')} entry={entry} run={run} busy={busy} replace={replace}/>)}</div>
  </div>;
}
