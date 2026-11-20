import './StudioAccountSave.css';
import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
export default function StudioAccountSave({result}) {
 const [state,setState]=useState('idle');
 const started=useRef(false);
 useEffect(()=>{if(result.archiveId && result.gift && !started.current){started.current=true;save();}},[result.archiveId]);
 async function save(){
  setState('saving');
  try {
   const {uploadPresigned:upload}=await import('@vercel/blob/client');
   const {personaliseNiceListCertificate}=await import('../lib/niceListCertificate.js');
   const {exportStudioLetter,exportStudioPicture}=await import('../lib/studioGiftExports.js');
   const exports={video:()=>result.videoBlob,certificate:()=>personaliseNiceListCertificate(result.gift.writtenName),letter:()=>exportStudioLetter(result.gift.letter),picture:()=>exportStudioPicture(result.gift.writtenName,result.gift.picture)};
   for(const [kind,render] of Object.entries(exports)) {
    const check=async()=>{const r=await fetch('/api/my-santa-messages?action=gift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:result.archiveId,kind})});if(!r.ok)throw new Error('Save failed');return (await r.json()).saved};
    if(await check())continue;
    const blob=await render();
    await upload(`santa-messages/${result.archiveId}/${kind}.${kind==='video'?'mp4':kind==='picture'?'png':'pdf'}`,blob,{access:'private',handleUploadUrl:'/api/my-santa-messages?action=upload',clientPayload:JSON.stringify({id:result.archiveId,kind}),contentType:kind==='video'?'video/mp4':kind==='picture'?'image/png':'application/pdf'});
    if(!await check())throw new Error('Save failed');
   }
   setState('saved');
  }catch{setState('error')}
 }
 if(!result.archiveId)return <p><Link className="studio-account-link" to="/my-santa-messages" target="_blank" rel="noreferrer">Sign in to save future messages in your account</Link>.</p>;
 return <div><p>Find your message in <Link className="studio-account-link" to="/my-santa-messages">My Santa Messages</Link>.</p>{state!=='saved'&&<button className="smw-button smw-button-back smw-account-save" type="button" disabled={state==='saving'} onClick={save}>{state==='saving'?'Saving your video and gifts…':'Save video and gifts to my account'}</button>}<p role="status">{state==='saved'?'Your video and all three personalised gifts are saved.':state==='error'?'Some files could not be saved. Keep this tab open and retry, or download them now.':'Keep this tab open while your video and gifts are saved.'}</p></div>;
}
