import {useEffect,useId,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';

export default function DadEarlyAccess({launchAt,children}) {
 const navigate=useNavigate(),id=useId(),dialog=useRef(null),request=useRef(null);
 const [launched,setLaunched]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const update=()=>setLaunched(Date.now()>=launchAt);update();const timer=setInterval(update,1000);return()=>{clearInterval(timer);request.current?.abort();};},[launchAt]);
 async function submit(event){
  event.preventDefault();if(request.current)return;
  if(/^FRIEND-/i.test(code.trim())){setError('Kids’ friends vouchers cannot be used for Dad’s early access. Your voucher has not been redeemed.');return;}
  const controller=new AbortController();request.current=controller;setBusy(true);setError('');
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
   await fetch('/api/santa-workshop-access',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const response=await fetch('/api/santa-workshop-access',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code.trim()}),signal:controller.signal});
   const data=await response.json();
   if(!response.ok||data.authorized!==true)throw Error(data.error||'That voucher could not be accepted. Please check the code.');
   const access=await fetch('/api/dad-studio-message',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const result=await access.json();
   if(!access.ok||result.authorized!==true)throw Error('This code does not include early access to Dad’s Studio.');
   setCode('');dialog.current.close();navigate('/dad-message-maker');
  }catch(failure){setError(controller.signal.aborted?'The request took too long. Please try again.':failure.message);}
  finally{clearTimeout(timeout);request.current=null;setBusy(false);}
 }
 return <>
 {launched?<Link className="bespoke-offer__cta" to="/dad-message-maker">Explore Dad’s message →</Link>:<button className="bespoke-offer__cta" type="button" onClick={()=>{setError('');dialog.current.showModal();}}>Explore Dad’s message →</button>}
 <dialog className="bespoke-return-dialog dad-early-access" ref={dialog} aria-labelledby={`${id}-title`} onClose={()=>{setCode('');setError('');}}>
 <button type="button" className="bespoke-return-close" onClick={()=>dialog.current.close()}>Close ×</button>
 <h2 id={`${id}-title`}>Dad’s message is almost ready</h2>
 {children}
 {launched?<Link className="bespoke-offer__cta" to="/dad-message-maker">Open Dad’s Studio →</Link>:<form onSubmit={submit}><label htmlFor={`${id}-code`}>Early access voucher code</label><input id={`${id}-code`} type="password" autoComplete="off" maxLength={80} required value={code} disabled={busy} onChange={event=>setCode(event.target.value)}/><button type="submit" disabled={busy}>{busy?'Checking voucher…':'Use early access voucher →'}</button>{error&&<p role="alert">{error}</p>}</form>}
 </dialog>
 </>;
}
