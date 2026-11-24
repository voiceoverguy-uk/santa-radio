import { formatUkDate } from '../lib/ukDates.js';
import {useState,useRef} from 'react';
import {Link} from 'react-router-dom';
export default function DadAccountSave({result,certificate}) {
 const [state,setState]=useState('idle'),[message,setMessage]=useState('');
 const flight=useRef(false);
 async function save(){
  if(flight.current||!certificate)return;
  flight.current=true;setState('saving');setMessage('Saving your video and certificate… Keep this tab open.');
  try{
   const response=await fetch('/api/my-santa-messages?action=dad-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:result.operation,name:result.writtenName})});
   if(response.status===401){setState('signin');setMessage('Sign in using your purchase email, then return to this tab and press Save.');return;}
   const data=await response.json();if(!response.ok)throw Error(data.error||'Saving is unavailable. Please retry.');
   const {uploadPresigned}=await import('@vercel/blob/client');
   for(const [kind,blob] of [['video',result.blob],['picture',certificate]]){
    const check=async()=>{const r=await fetch('/api/my-santa-messages?action=gift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.id,kind})});if(!r.ok)throw Error('Saving could not be confirmed. Please retry.');return (await r.json()).saved;};
    if(await check())continue;
    await uploadPresigned(`santa-messages/${data.id}/${kind}.${kind==='video'?'mp4':'png'}`,blob,{access:'private',handleUploadUrl:'/api/my-santa-messages?action=upload',clientPayload:JSON.stringify({id:data.id,kind}),contentType:kind==='video'?'video/mp4':'image/png'});
    if(!await check())throw Error('Saving could not be confirmed. Please retry.');
   }
   setState('saved');setMessage(`Your video and certificate are saved until ${formatUkDate(Date.parse(data.expiresAt) - 1)}.`);
  }catch(e){setState('error');setMessage(`${e.message} Download your files before leaving this page.`);}
  finally{flight.current=false;}
 }
 return <section className="dad-account-save"><h3>Keep Dad’s Christmas message</h3><p>Save your video and chosen certificate in My Santa Messages until 31 January after Christmas. Use the email address you purchased with.</p>{state!=='saved'&&<><p><Link to="/my-santa-messages" target="_blank" rel="noopener noreferrer">Sign in or create an account with your email ↗</Link> — opens a new tab. Keep this message open, then return here to save.</p><button type="button" className="dad-primary" disabled={state==='saving'||!certificate} onClick={save}>{state==='saving'?'Saving…':'Save video and certificate'}</button></>}<p role="status">{message}</p>{state==='saved'?<Link to="/my-santa-messages" target="_blank" rel="noopener noreferrer">Open My Santa Messages ↗</Link>:<p>Your files are only saved online after saving succeeds. Download them before leaving if you prefer not to save.</p>}</section>;
}
