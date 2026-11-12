import { useEffect, useRef, useState } from 'react';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import { nameRequestToken } from '../lib/santaNameRequestTokens.js';
export default function WorkshopMissingName({name}) {
  const [state,setState]=useState('idle'),[message,setMessage]=useState('');
  const current=useRef(name);current.current=name;
  useEffect(()=>{setState('idle');setMessage('');},[name]);
  const requested=normaliseRequestedName(name);
  if(!requested)return null;
  async function submit() {
    setState('pending');setMessage('');
    try {
      const token=nameRequestToken(requested.key);
      const response=await fetch('/api/name-requests',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:requested.name,requestId:token.id,source:'paid'}),signal:AbortSignal.timeout(30000)});
      const result=await response.json();if(!response.ok||!result.saved)throw new Error(result.error||'Your request could not be saved. Please try again.');
      if(current.current===name){setState('success');setMessage(result.message);}
    }catch(error){if(current.current!==name)return;setState('error');setMessage(error.name==='TimeoutError'?'The request timed out. Please try again.':error.message);}
  }
  return <div className="smw-stage-note"><p>Can’t find the right recording? Ask Santa to add “{requested.name}”.</p><p><strong>Please request first names only.</strong> Hyphenated and two-part first names, such as Ellie-May or Ellie May, are welcome. Surnames, full names, group names and phrases won’t be considered for recording.</p><p>Up to 5 new names every 2 hours.</p>{state!=='success'&&<button type="button" className="smw-name-retry" disabled={state==='pending'} onClick={submit}>{state==='pending'?'Sending request…':'Request this first name'}</button>}{message&&<p role={state==='error'?'alert':'status'}>{message}</p>}<p>Requests are reviewed manually. You can return later using your Studio access link.</p></div>;
}
