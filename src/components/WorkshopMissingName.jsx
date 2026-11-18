import useNameRequestSeason from '../hooks/useNameRequestSeason.js';
import PronunciationNote from './PronunciationNote.jsx';
import { useEffect, useRef, useState } from 'react';
import { normaliseRequestedName } from '../lib/santaNameRequests.js';
import { nameRequestToken } from '../lib/santaNameRequestTokens.js';
export default function WorkshopMissingName({name}) {
  const requestsOpen = useNameRequestSeason();
  const [state,setState]=useState('idle'),[message,setMessage]=useState('');
  const [pronunciation,setPronunciation]=useState('');
  const [expanded,setExpanded]=useState(false);
  const current=useRef(name);current.current=name;
  useEffect(()=>{setState('idle');setMessage('');setPronunciation('');setExpanded(false);},[name]);
  const requested=normaliseRequestedName(name);
  if(!requested || !requestsOpen)return null;
  async function submit() {
    setState('pending');setMessage('');
    try {
      const token=nameRequestToken(requested.key);
      const response=await fetch('/api/name-requests',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:requested.name,requestId:token.id,source:'paid',pronunciation}),signal:AbortSignal.timeout(30000)});
      const result=await response.json();if(!response.ok||!result.saved)throw new Error(result.error||'Your request could not be saved. Please try again.');
      if(current.current===name){setState('success');setMessage(result.message);}
    }catch(error){if(current.current!==name)return;setState('error');setMessage(error.name==='TimeoutError'?'The request timed out. Please try again.':error.message);}
  }
  return <div className="smw-stage-note">
    {!expanded && state !== 'success' && <button type="button" className="smw-name-retry" onClick={() => setExpanded(true)} aria-expanded={false}>Request this first name</button>}
    {expanded && state !== 'success' && <>
      <p><strong>Request “{requested.name}”</strong></p>
      <p>First names only—hyphenated or two-part first names are welcome. No surnames.</p>
      <PronunciationNote key={name} value={pronunciation} onChange={setPronunciation} disabled={state==='pending'} initiallyOpen />
      <p>Allow up to 48 hours for the name to become available.</p>
      <button type="button" className="smw-name-retry" disabled={state==='pending'} onClick={submit}>{state==='pending'?'Sending request…':'Send name request'}</button>
      <button type="button" className="smw-name-retry" disabled={state==='pending'} onClick={() => setExpanded(false)}>Cancel</button>
    </>}
    {message && <p role={state==='error'?'alert':'status'}>{message}</p>}
    {state==='success' && <p>Allow up to 48 hours. Return using your Studio access link to check the name.</p>}
  </div>;
}
