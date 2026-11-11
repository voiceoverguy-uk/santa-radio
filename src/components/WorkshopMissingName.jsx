import { useState } from 'react';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import { nameRequestToken } from '../lib/santaNameRequestTokens.js';
export default function WorkshopMissingName({name}) {
  const [state,setState]=useState('idle'),[message,setMessage]=useState('');
  const requested=normaliseRequestedName(name);
  if(!requested)return null;
  async function submit() {
    setState('pending');setMessage('');
    try {
      const token=nameRequestToken(requested.key);
      const response=await fetch('/api/name-requests',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:requested.name,requestId:token.id}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok||!result.saved)throw new Error(result.error||'Your request could not be saved. Please try again.');
      setState('success');setMessage('Your request is on Santa’s list. Check back in a few days during December. Adding a recording is not guaranteed, and this has not used a message credit.');
    }catch(error){setState('error');setMessage(error.name==='TimeoutError'?'The request timed out. Please try again.':error.message);}
  }
  return <div className="smw-stage-note"><p>Can’t find the right recording? Ask Santa to add “{requested.name}”.</p>{state!=='success'&&<button type="button" className="smw-name-retry" disabled={state==='pending'} onClick={submit}>{state==='pending'?'Sending request…':'Request this name'}</button>}{message&&<p role={state==='error'?'alert':'status'}>{message}</p>}<p>Requests are reviewed manually. You can return later using your Studio access link.</p></div>;
}
