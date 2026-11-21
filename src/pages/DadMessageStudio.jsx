import DadAccountSave from '../components/DadAccountSave.jsx';
import {DAD_LAUNCH_AT} from '../lib/dadLaunch.js';
import {dadDisplayCategories,dadScrollerLabel} from '../lib/dadChoiceWording.js';
import DadCertificate from '../components/DadCertificate.jsx';
import {DAD_PREPARATION_MESSAGES} from '../lib/dadPreparationMessages.js';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Info,Pencil,ZoomIn} from 'lucide-react';
import {Helmet} from 'react-helmet-async';
import WorkshopNamePicker from '../components/WorkshopNamePicker.jsx';
import WorkshopAgeCarousel from '../components/WorkshopAgeCarousel.jsx';
import WorkshopSearchableChoices from '../components/WorkshopSearchableChoices.jsx';
import StudioMiniDash from '../components/StudioMiniDash.jsx';
import SantaVideoPlayer from '../components/SantaVideoPlayer.jsx';
import {SantaGreetingShare} from '../components/SantaMessageShare.jsx';
import useWorkshopNameResolution from '../hooks/useWorkshopNameResolution.js';
import {DAD_ARTWORK,createDadVideo,dadPoster,dadVideoFilename} from '../lib/dadVideo.js';
import './SantaMessageWorkshop.css';
import './DadMessageStudio.css';
const capitalise=value=>value.trim().replace(/(^|[\s'-])\p{L}/gu,c=>c.toLocaleUpperCase('en-GB'));
async function request(path,body){const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error||'Please try again.');return data;}
function FittedArtCaption({children, className = "dad-art-caption"}) {
 const container=useRef(null),text=useRef(null);
 useLayoutEffect(()=>{
  const box=container.current,label=text.current;
  let active=true;
  const fit=()=>{
   if(!active||!box||!label)return;
   label.style.fontSize='';
   const naturalSize=parseFloat(getComputedStyle(label).fontSize);
   const available=box.clientWidth;
   const width=label.getBoundingClientRect().width;
   if(width>available&&available>0)label.style.fontSize=`${naturalSize*available/width*.98}px`;
  };
  fit();const observer=new ResizeObserver(fit);observer.observe(box);
  document.fonts.ready.then(fit);
  return()=>{active=false;observer.disconnect();};
 },[children]);
 return <p ref={container} className={className} aria-live="polite"><span ref={text} style={{whiteSpace:'nowrap',flexShrink:0}}>{children}</span></p>;
}
export default function DadMessageStudio(){
 const [gameDone,setGameDone]=useState(false);
 const [certificate,setCertificate]=useState(null);
 const [preparationMessage,setPreparationMessage]=useState(DAD_PREPARATION_MESSAGES[0]);
 const [ownerCode,setOwnerCode]=useState('');const [sales,setSales]=useState(false);
 const [access,setAccess]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[step,setStep]=useState(0),[choices,setChoices]=useState({}),[art,setArt]=useState(0),[result,setResult]=useState(null),[progress,setProgress]=useState(null),[status,setStatus]=useState(''),[showProgress,setShowProgress]=useState(false),[email,setEmail]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(result&&gameDone)setShowProgress(false);},[result,gameDone]);
 useEffect(()=>{
  if(!busy||!showProgress)return;
  let remaining=[],previous;
  const next=()=>{
   if(!remaining.length)remaining=[...DAD_PREPARATION_MESSAGES];
   const eligible=remaining.filter(line=>line!==previous);const chosen=eligible[Math.floor(Math.random()*eligible.length)]||remaining[0];remaining=remaining.filter(line=>line!==chosen);previous=chosen;setPreparationMessage(chosen);
  };
  next();const timer=window.setInterval(next,10000);
  return()=>window.clearInterval(timer);
 },[busy,showProgress]);
 const name=useWorkshopNameResolution(),job=useRef(null),saved=useRef(null),videoURL=useRef(null),confirmed=useRef(null),audioFlight=useRef(false),videoFlight=useRef(false),hideTimer=useRef(null);
 const [previewArt,setPreviewArt]=useState(0);
 const sceneDialog=useRef(null),panelRef=useRef(null);
 // Align each new step before paint; selection changes must not scroll the page.
 useLayoutEffect(()=>{
  if(step===0)return;
  const panel=panelRef.current;
  if(!panel)return;
  const top=(document.querySelector('.navbar')?.getBoundingClientRect().height||80)+24;
  panel.style.setProperty('--dad-frame-top',`${top}px`);
  window.scrollTo({top:Math.max(0,window.scrollY+panel.getBoundingClientRect().top-top),behavior:'instant'});
 },[step]);
 const [audioState,setAudioState]=useState('idle'),[editingReview,setEditingReview]=useState(false),[sceneChosen,setSceneChosen]=useState(false);

 const load=async()=>{try{await request('/api/dad-studio-access');}catch{}try{const data=await request('/api/dad-studio-message');setAccess({...data,categories:data.categories?dadDisplayCategories(data.categories):data.categories});}catch(e){setAccess({authorized:false});}};
 useEffect(()=>{const boot=async()=>{const token=new URLSearchParams(location.hash.slice(1)).get('studio-return');if(token){history.replaceState(null,'',location.pathname);try{await request('/api/dad-studio-return',{token});}catch(e){setError(e.message);}}await load();};boot();return()=>{job.current?.abort();clearTimeout(hideTimer.current);if(videoURL.current)URL.revokeObjectURL(videoURL.current);};},[]);
 useEffect(()=>{
  let cancelled=false,timer;const controller=new AbortController();
  const refresh=async()=>{try{
   const response=await fetch('/api/dad-studio-checkout?prepare=1',{credentials:'same-origin',signal:controller.signal});
   const setup=await response.json();if(cancelled)return;
   setSales(response.ok&&setup.configured===true);
   if(setup.opensAt&&!setup.configured)timer=setTimeout(refresh,Math.min(2147483647,Math.max(1000,setup.opensAt-Date.now()+100)));
  }catch{if(!cancelled){setSales(false);if(Date.now()<DAD_LAUNCH_AT)timer=setTimeout(refresh,Math.min(2147483647,DAD_LAUNCH_AT-Date.now()+100));}}};
  const onVisible=()=>{if(document.visibilityState==='visible'){clearTimeout(timer);refresh();}};
  refresh();document.addEventListener('visibilitychange',onVisible);
  return()=>{cancelled=true;clearTimeout(timer);controller.abort();document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 const checkout=async()=>{setBusy(true);setError('');try{await request('/api/dad-studio-checkout?prepare=1');const r=await request('/api/dad-studio-checkout',{});if(r.pending){await load();setNotice('Checking your payment. Please wait a moment and refresh if needed.');}else if(r.url&&new URL(r.url).hostname==='checkout.stripe.com')location.assign(r.url);else throw Error('Checkout is not ready yet.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const prepareAudio=async()=>{
  if(audioFlight.current||saved.current||!confirmed.current)return;
  audioFlight.current=true;setError('');setAudioState('preparing');
  const controller=new AbortController();job.current=controller;
  const selection=confirmed.current;
  const audioTimeout=setTimeout(()=>controller.abort(new Error('Recording preparation took too long. Please retry.')),120000);
  try{
   const r=await fetch('/api/dad-studio-message',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':selection.operation},body:JSON.stringify(selection.request),signal:controller.signal});
   if(!r.ok){const data=await r.json();throw Error(data.error||'Please try again.');}
   const metadata=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get('X-Studio-Selection')),c=>c.charCodeAt(0))));
   const audioBlob=await r.blob();controller.signal.throwIfAborted();
   saved.current={operation:selection.operation,...metadata,...selection.details,writtenName:capitalise(metadata.record.name),audioBlob};
   setAccess(a=>({...a,remaining:a.admin?1:0}));setAudioState('ready');
  }catch(e){setError(controller.signal.aborted?(controller.signal.reason?.message||'Recording preparation was interrupted. Please retry.'):e.message);setAudioState('error');}
  finally{clearTimeout(audioTimeout);audioFlight.current=false;if(job.current===controller)job.current=null;}
 };
 const confirm=()=>{
  if(confirmed.current||!name.record)return;
  const selected=Object.fromEntries(['age','habit','viewing','treat'].map(k=>[k,access.categories[k].find(x=>x.id===choices[k])]));
  if(Object.values(selected).some(x=>!x))return;
  confirmed.current={operation:crypto.randomUUID(),request:{name:name.record.id,...choices},details:{age:selected.age.number,habit:selected.habit.label,viewing:selected.viewing.label,treat:selected.treat.label}};
  setStep(5);setSceneChosen(false);setEditingReview(false);prepareAudio();
 };
 const make=async()=>{
  if(videoFlight.current||!saved.current||!sceneChosen)return;
  videoFlight.current=true;setGameDone(false);setError('');setBusy(true);setShowProgress(true);setProgress(null);setStatus('Creating your Christmas video…');clearTimeout(hideTimer.current);
  const controller=new AbortController();job.current=controller;
  // Artwork is selected only now; the confirmed recording stays reusable.
  const current={...saved.current,artwork:DAD_ARTWORK[art].src};
  try{
   const poster=await dadPoster(current);controller.signal.throwIfAborted();
   const blob=await createDadVideo(current,{signal:controller.signal,onProgress:setProgress,onStatus:setStatus});controller.signal.throwIfAborted();
   if(videoURL.current)URL.revokeObjectURL(videoURL.current);
   videoURL.current=URL.createObjectURL(blob);setResult({...current,blob,url:videoURL.current,poster});setProgress(1);setStatus('Your Christmas video is ready.');
  }catch(e){setError(controller.signal.aborted?'Video preparation cancelled. Your recording is ready; you can retry without using another creation.':e.message);setShowProgress(false);}
  finally{videoFlight.current=false;setBusy(false);if(job.current===controller)job.current=null;}
 };
 const progressLabels=['Name/Age','Bad Habits','TV choices','Santa’s treat','Review','Picture'];
 const stages=['NAME AND AGE','Household habits','TV choices','Santa’s treat','Review Time','Choose the scene'];
 const valid=step===0?!!name.record&&!!choices.age:step<4?!!choices[['','habit','viewing','treat'][step]]:true;
 const browseScene=direction=>setPreviewArt(current=>(current+direction+DAD_ARTWORK.length)%DAD_ARTWORK.length);
 const sceneName=confirmed.current?.details?.writtenName||name.record?.name||'';
 const sceneAge=confirmed.current?.details?.age||access?.categories?.age?.find(row=>row.id===choices.age)?.number;
 const continueButton=<button className="dad-primary" disabled={!valid} onClick={()=>{setStep(editingReview?4:step+1);setEditingReview(false);}}>{editingReview?'Save choice →':'Continue →'}</button>;
 const change=(key,value)=>setChoices(c=>({...c,[key]:value}));
 const edit=target=>{setEditingReview(true);setStep(target);setError('');};
 const reviewRows=[{label:'His recorded name',value:capitalise(name.record?.name||''),step:0},...['age','habit','viewing','treat'].map((key,index)=>({label:['Their age','Household habits','TV choices','Santa’s treat'][index],value:access?.categories?.[key]?.find(x=>x.id===choices[key])?.label||'',step:index}))];

 return <main className="dad-studio smw-page"><Helmet><title>Dad Message Maker Studio | Santa Radio</title><meta name="robots" content="noindex,follow"/></Helmet>
 {!access?.authorized&&<><nav className="dad-tabs" aria-label="Message type"><Link to="/bespoke-personalised-message-from-santa">For Kids</Link><span aria-current="page">For Dads</span></nav>
 <header><p className="dad-eyebrow">A WORD FROM THE NORTH POLE</p><h1>Dad’s Message Maker Studio</h1><p>Even Dad can make the Nice List. Just.</p><p>A funny, personalised message from Santa. Add his name, age, bad household habits, unpopular TV choices and the questionable Christmas Eve treats left for Santa.</p></header></>}
 <div className={`dad-layout${step===0&&!result?" dad-layout-opening":" dad-layout-focused"}`}>{step===0&&!result&&<div className="dad-intro-art"><img className="dad-intro-logo" src="/images/dad-message-logo-v4.webp" alt="Dad’s Message from Santa"/><section className="dad-art"><img src={DAD_ARTWORK[art].src} alt={DAD_ARTWORK[art].label}/><FittedArtCaption>{name.record ? `A message for ${name.record.name}${sceneAge ? ` — aged ${sceneAge}` : ''}` : 'Ready to get silly?'}</FittedArtCaption></section></div>}
 <section ref={panelRef} className="dad-panel" aria-label="Dad recording studio"><h2>The North Pole Recording Studio</h2>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {!access?<p>Opening Studio…</p>:!access.authorized?<><h3>One Dad.<br/>One very personal message.</h3><p>£5 includes one message creation and your choice of six Christmas scenes. Preview, download and share your personalised MP4.</p><button className="dad-primary dad-purchase-cta" disabled={busy||!sales} onClick={checkout}>{busy?'Opening checkout…':sales?'Create Dad’s message — £5':'Purchases opening soon — £5'}</button><div className="dad-return-purchase"><p>Already purchased? Enter your purchase email for a return link.</p><form onSubmit={async e=>{e.preventDefault();try{setNotice((await request('/api/dad-studio-return',{email})).message);}catch(e){setError(e.message);}}}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button type="submit">Email my return link</button></form></div><details><summary>Studio owner preview</summary><form onSubmit={async e=>{e.preventDefault();setError('');try{await request('/api/santa-workshop-access',{code:ownerCode});setOwnerCode('');await load();}catch(e){setError(e.message);}}}><label>Owner access code<input type="password" autoComplete="off" required value={ownerCode} onChange={e=>setOwnerCode(e.target.value)}/></label><button type="submit">Open owner preview</button></form></details></>:
 <>
 {showProgress&&<><h3>Your Santa Message</h3><section className="dad-preparation" aria-label="Preparing your Santa message">
 <strong>Your message from Santa to {capitalise(sceneName || 'Dad')}</strong>
 <div className="dad-preparation-progress"><div className="dad-progress" role="progressbar" aria-label="Creating your video" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress===null?undefined:Math.round(progress*100)}><span style={{width:progress===null?'25%':`${progress*100}%`}}/></div><span>{progress===null?'Preparing…':`${Math.round(Math.max(0,Math.min(1,progress))*100)}%`}</span></div>
 <p role="status">{busy?preparationMessage:status} {busy&&'Keep this page open.'}</p>
 {<StudioMiniDash progress={progress} onFinish={()=>setGameDone(true)}/>}
 </section>{busy&&<button className="dad-cancel-preparation" onClick={()=>job.current?.abort()}>Cancel preparation</button>}</>}

 {result?<>{gameDone&&<><h3>A message for {result.writtenName}</h3><SantaVideoPlayer festiveControls src={result.url} poster={result.poster} glow label={`Santa’s message for ${result.writtenName}`}/><div className="dad-actions dad-result-actions"><a className="dad-primary" href={result.url} download={dadVideoFilename(result)}>Download your message ↓</a><SantaGreetingShare message={{name:result.writtenName,blob:result.blob}} filename={dadVideoFilename(result)}/></div><DadCertificate name={result.writtenName} downloadable onReady={setCertificate}/><DadAccountSave result={result} certificate={certificate}/></>}</>:
 !busy&&access.remaining===0&&!confirmed.current?<><p>Your message creation has been used. Keep your downloaded MP4 to watch and share.</p>{sales&&<button className="dad-primary" onClick={checkout}>Create another Dad message — £5</button>}</>:
 !busy&&<><div className="dad-step-heading"><div><h3>{stages[step]}</h3></div>{step===5&&<button className="dad-primary dad-create-message" disabled={audioState!=='ready'||!sceneChosen} onClick={make}>Create Message <span aria-hidden="true">→</span></button>}{step<4&&continueButton}{step===4&&<div className="dad-review-actions"><button type="button" onClick={()=>{name.choose(null);setChoices({});setEditingReview(false);setError('');setStep(0);}}><span aria-hidden="true">←</span> Start Again</button><button className="dad-primary" onClick={confirm}>Choose picture <span aria-hidden="true">→</span></button></div>}</div>
 <div className="dad-step-progress">
  <div className="smw-progress" role="progressbar" aria-valuemin={1} aria-valuemax={progressLabels.length} aria-valuenow={step+1} aria-label="Dad workshop progress" aria-valuetext={`Step ${step+1} of ${progressLabels.length} · ${progressLabels[step]}`}>
   {progressLabels.map((label,index)=><span key={label} className={`smw-progress-segment${index<=step?' is-complete':''}`} aria-hidden="true"/>)}
  </div>
  <ol className="smw-step-labels" aria-hidden="true">{progressLabels.map((label,index)=><li key={label} className={index===step?'is-current':''}>{label}</li>)}</ol>
 </div>
 {step===0&&<WorkshopNamePicker showAvailableCount capitaliseFirstLetter selected={name.choice} resolution={name} onSelect={name.choose}/>}
 {step===0&&name.record&&<section className="dad-name-age"><h4>Their age</h4><WorkshopAgeCarousel options={access.categories.age} value={choices.age} onChange={v=>change('age',v)}/></section>}
 {step>=1&&step<=3&&(()=>{const key=['habit','viewing','treat'][step-1];return <WorkshopSearchableChoices key={key} showClearButton={false} getOptionLabel={key === 'treat' ? undefined : dadScrollerLabel} category={['activity','achievement','treat'][step-1]} label={stages[step]} options={access.categories[key]} value={choices[key]} onChange={v=>change(key,v)} onTick={()=>{}} onSoundInteraction={()=>{}} searchLabel={`Search ${stages[step].toLowerCase()}`} placeholder="Start typing…" selectedText={access.categories[key].find(x=>x.id===choices[key])?.label||''} wording={key==='habit'?'(sarcastically) You are very useful around the house and especially good at…':key==='viewing'?'So considerate when the family are watching something. You give it 10 minutes then you swap to…':'(sarcastically) Cheers for the imaginative treats you leave me… ah yes…'}/>;})()}
 {step===4&&<><p className="dad-review-intro">Here’s Dad’s message. Check each detail below. You can still change any of your choices.</p><dl className="dad-recap">{reviewRows.map(row=><div className="dad-recap-row" key={row.label}><div><dt>{row.label}</dt><dd>{row.value}</dd></div><button type="button" aria-label={`Edit ${row.label.toLowerCase()}`} onClick={()=>edit(row.step)}><Pencil size={20} aria-hidden="true"/></button></div>)}</dl></>}
 {step===5&&<>{audioState==='error'&&<div className="dad-audio-status"><p>The recording could not be prepared. Retry with your confirmed choices.</p><button className="dad-primary" onClick={prepareAudio}>Retry recording</button></div>}{audioState==='preparing'&&<p role="status">Preparing your recording… You can choose your picture while you wait.</p>}<div className="dad-art-options">{DAD_ARTWORK.map((item,i)=><div key={item.id} className="dad-scene-card"><button className="dad-scene-select" type="button" aria-pressed={sceneChosen&&art===i} aria-label={`Select ${item.label}`} disabled={busy} onClick={()=>{setArt(i);setSceneChosen(true);}}><span className="dad-scene-thumbnail"><img src={item.src} alt=""/><span className="dad-scene-thumbnail__label">{item.label}</span></span></button><button className="dad-scene-preview-button" type="button" aria-label={`Enlarge ${item.label}`} disabled={busy} onClick={()=>{setPreviewArt(i);sceneDialog.current?.showModal();}}><span className="dad-scene-zoom" aria-hidden="true"><ZoomIn size={22}/></span></button></div>)}</div></>}
 {step<4&&<div className="dad-actions dad-step-actions">{(step>0||editingReview)&&step<5&&<button onClick={()=>{setStep(editingReview?4:step-1);setEditingReview(false);}}>{editingReview?'Back to recap':'← Back'}</button>}{step<4?continueButton:step===4?<button className="dad-primary" onClick={confirm}>Confirm and choose a picture →</button>:<button className="dad-primary" disabled={audioState!=='ready'||!sceneChosen} onClick={make}>{audioState==='preparing'?'Preparing your recording…':'Create my video →'}</button>}</div>}

 </>}
 </>}
 </section></div><dialog ref={sceneDialog} className="dad-scene-dialog" aria-labelledby="dad-scene-title" onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();browseScene(e.key==='ArrowLeft'?-1:1);}}} onClick={e=>{if(e.target===e.currentTarget)sceneDialog.current.close();}}><div><div className="dad-scene-heading"><h2 id="dad-scene-title">{DAD_ARTWORK[previewArt].label}</h2><details className="dad-scene-info"><summary aria-label="About these images"><Info size={22} aria-hidden="true"/></summary><p>apologies, yes the images are A.I. sorry</p></details></div><div className="dad-scene-preview">
 <img src={DAD_ARTWORK[previewArt].src} alt={DAD_ARTWORK[previewArt].label}/>
 <FittedArtCaption className="dad-scene-personalisation">{`A message for ${sceneName}${sceneAge?` — aged ${sceneAge}`:''}`}</FittedArtCaption>
 <button type="button" className="dad-scene-arrow dad-scene-arrow-left" aria-label="Previous picture" onClick={()=>browseScene(-1)}><img src="/images/dad-scene-arrow-v1.png" alt=""/></button>
 <button type="button" className="dad-scene-arrow dad-scene-arrow-right" aria-label="Next picture" onClick={()=>browseScene(1)}><img src="/images/dad-scene-arrow-v1.png" alt=""/></button>
 </div><p className="dad-scene-count" aria-live="polite">Picture {previewArt+1} of {DAD_ARTWORK.length}: {DAD_ARTWORK[previewArt].label}</p>
 <div className="dad-scene-actions"><button type="button" onClick={()=>sceneDialog.current.close()}>← Back to pictures</button><button type="button" className="dad-primary" autoFocus onClick={()=>{setArt(previewArt);setSceneChosen(true);sceneDialog.current.close();}}>Use this picture →</button></div></div></dialog>
 {result && <dialog id="dad-return-home-dialog" className="dad-return-home-dialog" aria-labelledby="dad-return-home-title">
  <h2 id="dad-return-home-title">Did you download your message?</h2>
  <p>Download your video and certificate before you leave this page.</p>
  <form className="dad-actions" method="dialog">
   <button type="submit">Stay here</button>
   <Link to="/" className="dad-primary">Yes, back to the website</Link>
  </form>
 </dialog>}
 </main>;
}
