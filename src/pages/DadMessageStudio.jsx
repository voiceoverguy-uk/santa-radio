import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import WorkshopNamePicker from '../components/WorkshopNamePicker.jsx';
import WorkshopAgeCarousel from '../components/WorkshopAgeCarousel.jsx';
import WorkshopSearchableChoices from '../components/WorkshopSearchableChoices.jsx';
import StudioPreparationRunner from '../components/StudioPreparationRunner.jsx';
import SantaVideoPlayer from '../components/SantaVideoPlayer.jsx';
import useWorkshopNameResolution from '../hooks/useWorkshopNameResolution.js';
import {DAD_ARTWORK,createDadVideo,dadPoster} from '../lib/dadVideo.js';
import './SantaMessageWorkshop.css';
import './DadMessageStudio.css';
const capitalise=value=>value.trim().replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('en-GB'));
async function request(path,body){const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Please try again.');return data;}
export default function DadMessageStudio(){
 const [ownerCode,setOwnerCode]=useState('');const [sales,setSales]=useState(false);
 const [access,setAccess]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[step,setStep]=useState(0),[choices,setChoices]=useState({}),[art,setArt]=useState(0),[result,setResult]=useState(null),[progress,setProgress]=useState(null),[status,setStatus]=useState(''),[showProgress,setShowProgress]=useState(false),[email,setEmail]=useState(''),[notice,setNotice]=useState('');
 const name=useWorkshopNameResolution(),job=useRef(null),saved=useRef(null),videoURL=useRef(null);
 const load=async()=>{try{await request('/api/dad-studio-access');}catch{}try{setAccess(await request('/api/dad-studio-message'));}catch(e){setAccess({authorized:false});}};
 useEffect(()=>{const boot=async()=>{const token=new URLSearchParams(location.hash.slice(1)).get('studio-return');if(token){history.replaceState(null,'',location.pathname);try{await request('/api/dad-studio-return',{token});}catch(e){setError(e.message);}}await load();try{const setup=await request('/api/dad-studio-checkout?prepare=1');setSales(setup.configured===true);}catch{};};boot();return()=>{job.current?.abort();if(videoURL.current)URL.revokeObjectURL(videoURL.current);};},[]);
 const checkout=async()=>{setBusy(true);setError('');try{await request('/api/dad-studio-checkout?prepare=1');const r=await request('/api/dad-studio-checkout',{});if(r.pending){await load();setNotice('Checking your payment. Please wait a moment and refresh if needed.');}else if(r.url&&new URL(r.url).hostname==='checkout.stripe.com')location.assign(r.url);else throw Error('Checkout is not ready yet.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const make=async()=>{
 setError('');setBusy(true);setShowProgress(true);setProgress(null);setStatus('Santa is recording your Dad message…');const controller=new AbortController();job.current=controller;
 try{
 let current=saved.current;
 if(!current){const r=await fetch('/api/dad-studio-message',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({name:name.record.id,...choices}),signal:controller.signal});if(!r.ok){const data=await r.json();throw Error(data.error||'Please try again.');}
 const metadata=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get('X-Studio-Selection')),c=>c.charCodeAt(0))));
 current={...metadata,writtenName:capitalise(metadata.record.name),age:access.categories.age.find(x=>x.id===choices.age).number,habit:access.categories.habit.find(x=>x.id===choices.habit).label,viewing:access.categories.viewing.find(x=>x.id===choices.viewing).label,treat:access.categories.treat.find(x=>x.id===choices.treat).label,audioBlob:await r.blob(),artwork:DAD_ARTWORK[art].src};saved.current=current;setAccess(a=>({...a,remaining:a.admin?1:0}));}
 const poster=await dadPoster(current);const blob=await createDadVideo(current,{signal:controller.signal,onProgress:setProgress,onStatus:setStatus});
 if(videoURL.current)URL.revokeObjectURL(videoURL.current);videoURL.current=URL.createObjectURL(blob);setResult({...current,blob,url:videoURL.current,poster});setProgress(1);setStatus('Your Christmas video is ready.');setTimeout(()=>setShowProgress(false),3000);
 }catch(e){setError(controller.signal.aborted?'Preparation cancelled. You can retry below.':e.message);setShowProgress(false);}finally{setBusy(false);job.current=null;}
 };
 const stages=['His name','His age','Household habits','TV choices','Santa’s treat','Choose the scene','Ready to record'];
 const valid=step===0?!!name.record:step<5?!!choices[['','age','habit','viewing','treat'][step]]:true;
 const change=(key,value)=>setChoices(c=>({...c,[key]:value}));
 const share=async()=>{try{const file=new File([result.blob],`${result.writtenName}-Santa.mp4`,{type:'video/mp4'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:`Santa's message for ${result.writtenName}`});else setNotice('Download your message, then attach the video in your favourite messaging app.');}catch(e){if(e.name!=='AbortError')setNotice('Please download the video to share it.');}};
 return <main className="dad-studio smw-page"><Helmet><title>Dad Message Maker Studio | Santa Radio</title><meta name="robots" content="noindex,follow"/></Helmet>
 <nav className="dad-tabs" aria-label="Message type"><Link to="/bespoke-personalised-message-from-santa">For Kids</Link><span aria-current="page">For Dads</span></nav>
 <header><p className="dad-eyebrow">A WORD FROM THE NORTH POLE</p><h1>Dad’s Message Maker Studio</h1><p>Even Dad can make the Nice List. Just.</p><p>A funny, personalised message from Santa — his name, age, household habits, TV choices and Christmas Eve treat.</p></header>
 <div className="dad-layout"><section className="dad-art"><img src={DAD_ARTWORK[art].src} alt={DAD_ARTWORK[art].label}/></section>
 <section className="dad-panel" aria-label="Dad recording studio"><h2>The North Pole Recording Studio</h2>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!access?<p>Opening Studio…</p>:!access.authorized?<><h3>One Dad. One very personal message.</h3><p>£5 includes one message creation and your choice of five Christmas scenes. Preview, download and share your personalised MP4.</p><button className="dad-primary" disabled={busy||!sales} onClick={checkout}>{busy?'Opening checkout…':sales?'Create Dad’s message — £5':'Purchases opening soon — £5'}</button><p>Already purchased? Enter your purchase email for a private return link.</p><form onSubmit={async e=>{e.preventDefault();try{setNotice((await request('/api/dad-studio-return',{email})).message);}catch(e){setError(e.message);}}}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button type="submit">Email my return link</button></form><details><summary>Studio owner preview</summary><form onSubmit={async e=>{e.preventDefault();setError('');try{await request('/api/santa-workshop-access',{code:ownerCode});setOwnerCode('');await load();}catch(e){setError(e.message);}}}><label>Owner access code<input type="password" autoComplete="off" required value={ownerCode} onChange={e=>setOwnerCode(e.target.value)}/></label><button type="submit">Open owner preview</button></form></details></>:
 <>
 {showProgress&&<div role="status"><p>{status}</p><div className="dad-progress" role="progressbar" aria-label="Creating your video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress===null?undefined:Math.round(progress*100)}><span style={{width:progress===null?'25%':`${progress*100}%`}}/></div>{busy&&<><StudioPreparationRunner costume="classic"/><button onClick={()=>job.current?.abort()}>Cancel preparation</button></>}</div>}
 {result?<><h3>A message for {result.writtenName}</h3><SantaVideoPlayer src={result.url} poster={result.poster} glow label={`Santa’s message for ${result.writtenName}`}/><div className="dad-actions"><a className="dad-primary" href={result.url} download={`${result.writtenName}-Santa.mp4`}>Download your message ↓</a><button aria-label="Share your message" onClick={share}>Share ↗</button></div><p>Download before leaving this page. Your video is not saved online.</p></>:
 saved.current&&!busy?<><p>Your recording is ready. Retry making the video without using another creation.</p><button className="dad-primary" onClick={make}>Finish my video</button></>:
 !busy&&access.remaining===0?<><p>Your message creation has been used. Keep your downloaded MP4 to watch and share.</p>{sales&&<button className="dad-primary" onClick={checkout}>Create another Dad message — £5</button>}</>:
 !busy&&<><p>Step {step+1} of 7</p><h3>{stages[step]}</h3>
 {step===0&&<WorkshopNamePicker selected={name.choice} resolution={name} onSelect={name.choose}/>}
 {step===1&&<WorkshopAgeCarousel options={access.categories.age} value={choices.age} onChange={v=>change('age',v)}/>}
 {step>=2&&step<=4&&(()=>{const key=['habit','viewing','treat'][step-2];return <WorkshopSearchableChoices category={['activity','achievement','treat'][step-2]} label={stages[step]} options={access.categories[key]} value={choices[key]} onChange={v=>change(key,v)} onTick={()=>{}} onSoundInteraction={()=>{}} searchLabel={`Search ${stages[step].toLowerCase()}`} placeholder="Start typing…" selectedText="" wording={access.categories[key].find(x=>x.id===choices[key])?.label||''}/>;})()}
 {step===5&&<><p>Choose the scene for his video.</p><div className="dad-art-options">{DAD_ARTWORK.map((item,i)=><button key={item.id} type="button" aria-pressed={art===i} disabled={busy||!!saved.current} onClick={()=>setArt(i)}><img src={item.src} alt=""/>{item.label}</button>)}</div></>}
 {step===6&&<><p>Santa’s message for <strong>{capitalise(name.record?.name||'')} aged {access.categories.age.find(x=>x.id===choices.age)?.number}</strong>.</p><ul>{['habit','viewing','treat'].map(k=><li key={k}>{access.categories[k].find(x=>x.id===choices[k])?.label}</li>)}</ul><p>This uses your one message creation. Check your choices before recording.</p></>}
 <div className="dad-actions">{step>0&&<button onClick={()=>setStep(s=>s-1)}>← Back</button>}{step<6?<button className="dad-primary" disabled={!valid} onClick={()=>setStep(s=>s+1)}>Continue →</button>:<button className="dad-primary" onClick={make}>Ask Santa to record →</button>}</div>
 </>}
 </>}
 </section></div></main>;
}
