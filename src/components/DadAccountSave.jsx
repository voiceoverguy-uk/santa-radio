import { formatUkDate } from '../lib/ukDates.js';
import {useState,useRef} from 'react';
import {Link} from 'react-router-dom';
import './DadAccountSave.css';
export default function DadAccountSave({result,certificate}) {
 const [state,setState]=useState('idle'),[message,setMessage]=useState('');
 const flight=useRef(false);
 const signInLink=useRef(null);
 async function save(){
  if(flight.current||!certificate)return;
  flight.current=true;setState('saving');setMessage('Saving your video and certificate… Keep this tab open.');
  try{
   const response=await fetch('/api/my-santa-messages?action=dad-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:result.operation,name:result.writtenName})});
   if(response.status===401){setState('signin');setMessage('Not saved yet. Use the “Sign in to My Santa Messages” button in Step 1, then return here and complete Step 2.');signInLink.current?.focus();return;}
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
 return <section className="dad-account-save" aria-labelledby="dad-account-save-title">
  <h3 id="dad-account-save-title">Keep Dad’s Christmas message</h3>
  <p>Save your video and chosen certificate in <strong>My Santa Messages</strong> until 31 January after Christmas.</p>
  {state!=='saved'&&<div className="dad-account-save__steps">
   <div className="dad-account-save__step">
    <h4>Step 1 · Sign in or create your account</h4>
    <p>Use the <strong>same email address you used to buy this message</strong>. New here? Choose <strong>Sign up</strong> on the sign-in page.</p>
    <Link ref={signInLink} className="dad-primary dad-account-save__signin" to="/my-santa-messages/sign-in" target="_blank" rel="noopener noreferrer" aria-describedby="dad-account-save-new-tab">Sign in to My Santa Messages <span aria-hidden="true">↗</span></Link>
    <p id="dad-account-save-new-tab" className="dad-account-save__hint">Opens in a new tab. Keep this message tab open.</p>
   </div>
   <div className="dad-account-save__step">
    <h4>Step 2 · Return to this tab and save</h4>
    <p>After signing in, switch back to this tab and press the button below. Already signed in with your purchase email? You can save now.</p>
    <button type="button" className="dad-primary" disabled={state==='saving'||!certificate} onClick={save}>{state==='saving'?'Saving your video and certificate…':'Save video and certificate'}</button>
    {!certificate&&<p className="dad-account-save__hint">Your certificate is being prepared. The Save button will be ready shortly.</p>}
   </div>
  </div>}
  {message&&<p className="dad-account-save__status" role="status">{message}</p>}
  {state==='saved'?<Link className="dad-primary" to="/my-santa-messages" target="_blank" rel="noopener noreferrer">View my saved message (new tab)</Link>:<p className="dad-account-save__hint">Wait for the saved confirmation here before closing this tab. Signing in alone does not save your files. You can also download your video and certificate to keep them on your device.</p>}
 </section>;
}
