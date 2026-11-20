import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import WorkshopNamePicker from '../components/WorkshopNamePicker.jsx';
import WorkshopAgeCarousel from '../components/WorkshopAgeCarousel.jsx';
import WorkshopSearchableChoices from '../components/WorkshopSearchableChoices.jsx';
import StudioPreparationRunner from '../components/StudioPreparationRunner.jsx';
import DadCertificate from '../components/DadCertificate.jsx';
import SantaVideoPlayer from '../components/SantaVideoPlayer.jsx';
import useWorkshopNameResolution from '../hooks/useWorkshopNameResolution.js';
import {DAD_ARTWORK,createDadVideo,createDadShareVideo,dadPoster,dadVideoFilename} from '../lib/dadVideo.js';
import './SantaMessageWorkshop.css';
import './DadMessageStudio.css';
const capitalise=value=>value.trim().replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('en-GB'));
async function request(path,body){const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Please try again.');return data;}
export default function DadMessageStudio(){
 const [ownerCode,setOwnerCode]=useState('');const [sales,setSales]=useState(false);
 const [access,setAccess]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[step,setStep]=useState(0),[choices,setChoices]=useState({}),[art,setArt]=useState(0),[result,setResult]=useState(null),[progress,setProgress]=useState(null),[status,setStatus]=useState(''),[showProgress,setShowProgress]=useState(false),[email,setEmail]=useState(''),[notice,setNotice]=useState('');
 const name=useWorkshopNameResolution(),job=useRef(null),saved=useRef(null),videoURL=useRef(null),confirmed=useRef(null),audioFlight=useRef(false),videoFlight=useRef(false),hideTimer=useRef(null);
 const [audioState,setAudioState]=useState('idle'),[editingReview,setEditingReview]=useState(false),[sceneChosen,setSceneChosen]=useState(false);
 const [shareResult,setShareResult]=useState(null),[sharing,setSharing]=useState(false),[shareProgress,setShareProgress]=useState(null);const shareJob=useRef(null),shareURL=useRef(null),shareFlight=useRef(false);
 const load=async()=>{try{await request('/api/dad-studio-access');}catch{}try{setAccess(await request('/api/dad-studio-message'));}catch(e){setAccess({authorized:false});}};
 useEffect(()=>{const boot=async()=>{const token=new URLSearchParams(location.hash.slice(1)).get('studio-return');if(token){history.replaceState(null,'',location.pathname);try{await request('/api/dad-studio-return',{token});}catch(e){setError(e.message);}}await load();try{const setup=await request('/api/dad-studio-checkout?prepare=1');setSales(setup.configured===true);}catch{};};boot();return()=>{job.current?.abort();shareJob.current?.abort();if(shareURL.current)URL.revokeObjectURL(shareURL.current);clearTimeout(hideTimer.current);if(videoURL.current)URL.revokeObjectURL(videoURL.current);};},[]);
 const checkout=async()=>{setBusy(true);setError('');try{await request('/api/dad-studio-checkout?prepare=1');const r=await request('/api/dad-studio-checkout',{});if(r.pending){await load();setNotice('Checking your payment. Please wait a moment and refresh if needed.');}else if(r.url&&new URL(r.url).hostname==='checkout.stripe.com')location.assign(r.url);else throw Error('Checkout is not ready yet.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const prepareAudio=async()=>{
  if(audioFlight.current||saved.current||!confirmed.current)return;
  audioFlight.current=true;setError('');setAudioState('preparing');
  const controller=new AbortController();job.current=controller;
  const selection=confirmed.current;
  try{
   const r=await fetch('/api/dad-studio-message',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':selection.operation},body:JSON.stringify(selection.request),signal:controller.signal});
   if(!r.ok){const data=await r.json();throw Error(data.error||'Please try again.');}
   const metadata=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get('X-Studio-Selection')),c=>c.charCodeAt(0))));
   const audioBlob=await r.blob();controller.signal.throwIfAborted();
   saved.current={...metadata,...selection.details,writtenName:capitalise(metadata.record.name),audioBlob};
   setAccess(a=>({...a,remaining:a.admin?1:0}));setAudioState('ready');
  }catch(e){if(!controller.signal.aborted){setError(e.message);setAudioState('error');}}
  finally{audioFlight.current=false;if(job.current===controller)job.current=null;}
 };
 const confirm=()=>{
  if(confirmed.current||!name.record)return;
  const selected=Object.fromEntries(['age','habit','viewing','treat'].map(k=>[k,access.categories[k].find(x=>x.id===choices[k])]));
  if(Object.values(selected).some(x=>!x))return;
  confirmed.current={operation:crypto.randomUUID(),request:{name:name.record.id,...choices},details:{age:selected.age.number,habit:selected.habit.label,viewing:selected.viewing.label,treat:selected.treat.label}};
  setStep(6);setSceneChosen(false);setEditingReview(false);prepareAudio();
 };
 const make=async()=>{
  if(videoFlight.current||!saved.current||!sceneChosen)return;
  videoFlight.current=true;setError('');setBusy(true);setShowProgress(true);setProgress(null);setStatus('Creating your Christmas video…');clearTimeout(hideTimer.current);
  const controller=new AbortController();job.current=controller;
  // Artwork is selected only now; the confirmed recording stays reusable.
  const current={...saved.current,artwork:DAD_ARTWORK[art].src};
  try{
   const poster=await dadPoster(current);controller.signal.throwIfAborted();
   const blob=await createDadVideo(current,{signal:controller.signal,onProgress:setProgress,onStatus:setStatus});controller.signal.throwIfAborted();
   if(videoURL.current)URL.revokeObjectURL(videoURL.current);
   videoURL.current=URL.createObjectURL(blob);setResult({...current,blob,url:videoURL.current,poster});setProgress(1);setStatus('Your Christmas video is ready.');hideTimer.current=setTimeout(()=>setShowProgress(false),3000);
  }catch(e){setError(controller.signal.aborted?'Video preparation cancelled. Your recording is ready; you can retry without using another creation.':e.message);setShowProgress(false);}
  finally{videoFlight.current=false;setBusy(false);if(job.current===controller)job.current=null;}
 };
 const stages=['His name','His age','Household habits','TV choices','Santa’s treat','Confirm your selections','Choose the scene'];
 const valid=step===0?!!name.record:step<5?!!choices[['','age','habit','viewing','treat'][step]]:true;
 const change=(key,value)=>setChoices(c=>({...c,[key]:value}));
 const edit=target=>{setEditingReview(true);setStep(target);setError('');};
 const reviewRows=[{label:'His recorded name',value:capitalise(name.record?.name||''),step:0},...['age','habit','viewing','treat'].map((key,index)=>({label:stages[index+1],value:access?.categories?.[key]?.find(x=>x.id===choices[key])?.label||'',step:index+1}))];
 const prepareShare=async()=>{
  if(!result||shareFlight.current||shareResult)return;
  shareFlight.current=true;setSharing(true);setShareProgress(null);setNotice('');setError('');const controller=new AbortController();shareJob.current=controller;
  try{
   const blob=await createDadShareVideo(result,{signal:controller.signal,onProgress:setShareProgress});controller.signal.throwIfAborted();
   shareURL.current=URL.createObjectURL(blob);setShareResult({blob,url:shareURL.current});setNotice('Your share video is ready. Tap Share, or download the share copy.');
  }catch(e){if(!controller.signal.aborted)setError('The share copy could not be prepared. Your original video is ready; please try again.');}
  finally{shareFlight.current=false;setSharing(false);shareJob.current=null;}
 };
 const share=async()=>{if(!shareResult)return;try{const file=new File([shareResult.blob],dadVideoFilename(result),{type:'video/mp4'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:`Message for Dad ${result.writtenName}`});else setNotice('Download the share copy below, then attach it in your favourite messaging app.');}catch(e){if(e.name!=='AbortError')setNotice('Please download the share copy below to share it.');}};

 return <main className="dad-studio smw-page"><Helmet><title>Dad Message Maker Studio | Santa Radio</title><meta name="robots" content="noindex,follow"/></Helmet>
 <nav className="dad-tabs" aria-label="Message type"><Link to="/bespoke-personalised-message-from-santa">For Kids</Link><span aria-current="page">For Dads</span></nav>
 <header><p className="dad-eyebrow">A WORD FROM THE NORTH POLE</p><h1>Dad’s Message Maker Studio</h1><p>Even Dad can make the Nice List. Just.</p><p>A funny, personalised message from Santa — his name, age, household habits, TV choices and Christmas Eve treat.</p></header>
 <div className="dad-layout"><section className="dad-art"><img src={DAD_ARTWORK[art].src} alt={DAD_ARTWORK[art].label}/></section>
 <section className="dad-panel" aria-label="Dad recording studio"><h2>The North Pole Recording Studio</h2>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!access?<p>Opening Studio…</p>:!access.authorized?<><h3>One Dad. One very personal message.</h3><p>£5 includes one message creation and your choice of six Christmas scenes. Preview, download and share your personalised video and Nice-ish List certificate.</p><button className="dad-primary" disabled={busy||!sales} onClick={checkout}>{busy?'Opening checkout…':sales?'Create Dad’s message — £5':'Purchases opening soon — £5'}</button><p>Already purchased? Enter your purchase email for a private return link.</p><form onSubmit={async e=>{e.preventDefault();try{setNotice((await request('/api/dad-studio-return',{email})).message);}catch(e){setError(e.message);}}}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button type="submit">Email my return link</button></form><details><summary>Studio owner preview</summary><form onSubmit={async e=>{e.preventDefault();setError('');try{await request('/api/santa-workshop-access',{code:ownerCode});setOwnerCode('');await load();}catch(e){setError(e.message);}}}><label>Owner access code<input type="password" autoComplete="off" required value={ownerCode} onChange={e=>setOwnerCode(e.target.value)}/></label><button type="submit">Open owner preview</button></form></details></>:
 <>
 {showProgress&&<div role="status"><p>{status}</p><div className="dad-progress" role="progressbar" aria-label="Creating your video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress===null?undefined:Math.round(progress*100)}><span style={{width:progress===null?'25%':`${progress*100}%`}}/></div>{busy&&<><StudioPreparationRunner costume="classic"/><button onClick={()=>job.current?.abort()}>Cancel preparation</button></>}</div>}
 {result?<><h3>A message for {result.writtenName}</h3><SantaVideoPlayer src={result.url} poster={result.poster} glow label={`Santa’s message for ${result.writtenName}`}/><div className="dad-actions"><a className="dad-primary" href={result.url} download={dadVideoFilename(result)}>Download your message ↓</a><button aria-label={shareResult?"Share your message":"Prepare your message for sharing"} disabled={sharing} onClick={shareResult?share:prepareShare}>{sharing?"Preparing share video…":shareResult?"Share ↗":"Prepare to share ↗"}</button></div>{sharing&&<p role="status">Preparing a share copy with a large name on the opening frame… {shareProgress===null?"":`${Math.round(shareProgress*100)}%`}</p>}{shareResult&&<a href={shareResult.url} download={dadVideoFilename(result).replace(/\.mp4$/,"-share.mp4")}>Download share copy ↓</a>}<DadCertificate name={result.writtenName} downloadable/><p>Download before leaving this page. Your video and certificate are not saved online.</p></>:
 !busy&&access.remaining===0&&!confirmed.current?<><p>Your message creation has been used. Keep your downloaded MP4 to watch and share.</p>{sales&&<button className="dad-primary" onClick={checkout}>Create another Dad message — £5</button>}</>:
 !busy&&<><p>Step {step+1} of 7</p><h3>{stages[step]}</h3>
 {step===0&&<WorkshopNamePicker selected={name.choice} resolution={name} onSelect={name.choose}/>}
 {step===1&&<WorkshopAgeCarousel options={access.categories.age} value={choices.age} onChange={v=>change('age',v)}/>}
 {step>=2&&step<=4&&(()=>{const key=['habit','viewing','treat'][step-2];return <WorkshopSearchableChoices category={['activity','achievement','treat'][step-2]} label={stages[step]} options={access.categories[key]} value={choices[key]} onChange={v=>change(key,v)} onTick={()=>{}} onSoundInteraction={()=>{}} searchLabel={`Search ${stages[step].toLowerCase()}`} placeholder="Start typing…" selectedText="" wording={access.categories[key].find(x=>x.id===choices[key])?.label||''}/>;})()}
 {step===5&&<><p>Happy with these choices? Check the recap and edit anything before confirming.</p><dl className="dad-recap">{reviewRows.map(row=><div className="dad-recap-row" key={row.label}><div><dt>{row.label}</dt><dd>{row.value}</dd></div><button type="button" aria-label={`Edit ${row.label.toLowerCase()}`} onClick={()=>edit(row.step)}>Edit ✎</button></div>)}</dl><p>Confirming starts Santa’s recording and uses your one message creation. You’ll choose the picture next while Santa gets to work.</p></>}
 {step===6&&<><div className="dad-audio-status" role="status">{audioState==='preparing'?<><p>Santa is preparing your recording. Choose a picture while he gets to work.</p><StudioPreparationRunner costume="classic"/></>:audioState==='ready'?<p>Your recording is ready. Choose your picture, then create your video.</p>:audioState==='error'?<><p>The recording could not be prepared. Retry with your confirmed choices.</p><button className="dad-primary" onClick={prepareAudio}>Retry recording</button></>:null}</div><p>Your message choices are confirmed. Keep this page open until you’ve downloaded your video.</p><div className="dad-art-options">{DAD_ARTWORK.map((item,i)=><button key={item.id} type="button" aria-pressed={sceneChosen&&art===i} disabled={busy} onClick={()=>{setArt(i);setSceneChosen(true);}}><img src={item.src} alt=""/>{item.label}</button>)}</div></>}
 <div className="dad-actions">{step>0&&step<6&&<button onClick={()=>{setStep(editingReview?5:step-1);setEditingReview(false);}}>{editingReview?'Back to recap':'← Back'}</button>}{step<5?<button className="dad-primary" disabled={!valid} onClick={()=>{setStep(editingReview?5:step+1);setEditingReview(false);}}>{editingReview?'Save choice →':'Continue →'}</button>:step===5?<button className="dad-primary" onClick={confirm}>Confirm and choose a picture →</button>:<button className="dad-primary" disabled={audioState!=='ready'||!sceneChosen} onClick={make}>{audioState==='preparing'?'Preparing your recording…':'Create my video →'}</button>}</div>

 </>}
 </>}
 </section></div></main>;
}
