import { useEffect, useRef, useState } from 'react';
import './AppPromotionManager.css';
const PROMPT = `Create a premium festive promotional banner for the Santa Radio and Christmas Radio app welcome screens. Size 1920 × 800 pixels, landscape, 2.4:1. Deep emerald background, polished gold border, warm Christmas lights and rich red details, matching SantaRadio.co.uk. Use large, highly legible gold lettering for: “[HEADLINE]” and “[OFFER]”. Include “SantaRadio.co.uk” in elegant gold serif lettering on a traditional red ribbon with gold edges and folded tails. A cheerful Santa with headphones and a gold microphone can sit on the right. Keep all text inside generous safe margins and readable on a phone. No phone mockup, App Store badge or extra wording. Return only the finished banner.`;
const EMPTY={title:'',label:'',linkURL:'https://www.santaradio.co.uk/'};
export default function AppPromotionManager({ownerToken}) {
 const [data,setData]=useState(null),[selected,setSelected]=useState(null),[fields,setFields]=useState(EMPTY);
 const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [santaRadio,setSanta]=useState(true),[christmasRadio,setChristmas]=useState(true),[previewApp,setPreviewApp]=useState('Santa Radio');
 const generation=useRef(0);
 const [reload,setReload]=useState(0);
 const headers={Authorization:`Bearer studio-owner.${ownerToken}`};
 const item=data?.items.find(row=>row.id===selected);
 const dirty=!!item&&['title','label','linkURL'].some(k=>fields[k]!==item[k]);
 useEffect(()=>{let active=true;fetch('/api/app-promotions?view=manage',{headers,cache:'no-store',signal:AbortSignal.timeout(15000)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;generation.current++;};},[ownerToken,reload]);
 useEffect(()=>{
  let active=true,url='';const controller=new AbortController();setPreview('');
  if(file){url=URL.createObjectURL(file);setPreview(url);}
  else if(selected)fetch(`/api/app-promotions?image=${selected}`,{headers,signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Preview could not load.');return r.blob();}).then(blob=>{if(active){url=URL.createObjectURL(blob);setPreview(url);}}).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);});
  return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[file,selected,ownerToken]);
 async function run(action) {
  if(busy)return;const runID=++generation.current;setBusy(true);setError('');setNotice('');
  try {
   let response;
   if(action==='upload'){
    if(!file)throw Error('Choose a banner image first.');
    response=await fetch(`/api/app-promotions?${new URLSearchParams(fields)}`,{method:'POST',headers:{...headers,'Content-Type':file.type},body:file,signal:AbortSignal.timeout(30000)});
   }else response=await fetch('/api/app-promotions',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action,id:selected,revision:item?.revision,liveRevision:data?.live.revision,...fields,santaRadio,christmasRadio}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not save the banner.');
   if(runID!==generation.current)return;
   setData(result);
   if(action==='upload'){const saved=result.items[0];setSelected(saved.id);setFields({title:saved.title,label:saved.label,linkURL:saved.linkURL});setFile(null);}
   setNotice(action==='publish'?'Published. The selected apps will fetch this banner on their next launch (allow up to 30 seconds).':action==='off'?'Promotional banners are off for both apps.':action==='default'?'Both apps will use their bundled welcome design.':'Saved in your library. The live banner has not changed.');
  }catch(e){if(runID===generation.current)setError(e.name==='TimeoutError'?'The request timed out. Reload the library to check before retrying.':e.message);}
  finally{if(runID===generation.current)setBusy(false);}
 }
 function choose(row){setSelected(row.id);setFile(null);setFields({title:row.title,label:row.label,linkURL:row.linkURL});setNotice('');setError('');}
 const live=data?.live.campaign;
 return <section className="app-promotions">
  <h2>App welcome banners</h2>
  <p>Build a library of designs, preview them here, then publish one to Santa Radio, Christmas Radio or both. Saving a design does not publish it.</p>
  <p className="app-promotions__live"><strong>Live now:</strong> {live?.mode==='promotion'?`${live.title} · ${[live.santaRadio&&'Santa Radio',live.christmasRadio&&'Christmas Radio'].filter(Boolean).join(' + ')}`:live?.mode==='off'?'Promotions off':'Bundled welcome designs'}</p>
  <p>Requires the app update with live banners. Listeners with older app versions will keep their existing welcome screen.</p>
  {error&&<p role="alert">{error} <button disabled={busy} onClick={()=>{setError('');setReload(n=>n+1);}}>Reload library</button></p>}{notice&&<p role="status">{notice}</p>}
  {!data?<p>{error?'Library unavailable. Use Reload library to retry.':'Loading your library…'}</p>:<>
   <div className="app-promotions__library" aria-label="Saved banner library">
    {data.items.map(row=><button key={row.id} disabled={busy} aria-pressed={selected===row.id} onClick={()=>choose(row)}><img src={row.thumbnail} alt=""/><strong>{row.title}</strong>{live?.id===row.id&&<span>Live</span>}</button>)}
    <button disabled={busy} onClick={()=>{setSelected(null);setFile(null);setFields(EMPTY);setNotice('');}}>+ New banner</button>
   </div>
   <form onSubmit={event=>{event.preventDefault();void run(file?'upload':'edit');}}>
    <fieldset disabled={busy}>
     <legend>{selected?'Saved banner details':'Add a banner to your library'}</legend>
     <label>Banner image (PNG, JPEG or WebP, up to 4 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{const next=event.target.files?.[0];if(!next)return;if(next.size>4*1024*1024){setError('Choose an image under 4 MB.');return;}setSelected(null);setFile(next);setError('');}}/></label>
     <p><strong>Recommended size: 1920 × 800 pixels (2.4:1).</strong> Minimum 960 × 400. Keep text large and away from the edges.</p>
     <label>Library title<input value={fields.title} maxLength={100} required onChange={e=>setFields({...fields,title:e.target.value})} placeholder="Black Friday 50% off"/></label>
     <label>Link when tapped<input type="url" value={fields.linkURL} required onChange={e=>setFields({...fields,linkURL:e.target.value})}/></label>
     <p>Use a SantaRadio.co.uk page or an Apple App Store link.</p>
     <label>Accessible description<input value={fields.label} maxLength={240} required onChange={e=>setFields({...fields,label:e.target.value})} placeholder="Black Friday. 50% off at SantaRadio.co.uk."/></label>
     <button type="submit" disabled={!file&&!dirty}>{busy?'Working…':file?'Save new banner to library':'Save details'}</button>
    </fieldset>
   </form>
   {preview&&<div className="app-promotions__preview"><h3>Welcome screen preview</h3><label>Preview app <select value={previewApp} onChange={e=>setPreviewApp(e.target.value)}><option>Santa Radio</option><option>Christmas Radio</option></select></label><div className="app-promotions__phone"><span>{previewApp}</span><p>Your normal app splash artwork</p><img src={preview} alt={fields.label||'Banner preview'}/><div className="app-promotions__continue">Continue to {previewApp} ›</div></div><small>Layout preview. Each app retains its own splash artwork.</small></div>}
   <fieldset disabled={busy||!item||dirty||!!file}><legend>Publish this saved design</legend><label><input type="checkbox" checked={santaRadio} onChange={e=>setSanta(e.target.checked)}/> Santa Radio</label><label><input type="checkbox" checked={christmasRadio} onChange={e=>setChristmas(e.target.checked)}/> Christmas Radio</label><button disabled={!santaRadio&&!christmasRadio} onClick={()=>void run('publish')}>Publish to {santaRadio&&christmasRadio?'both apps':santaRadio?'Santa Radio':'Christmas Radio'}</button></fieldset>
   {dirty&&<p>Save your changes before publishing.</p>}
   <div className="app-promotions__actions"><button disabled={busy} onClick={()=>void run('off')}>Turn promotions off in both apps</button><button disabled={busy} onClick={()=>void run('default')}>Use bundled welcome designs</button></div>
  </>}
  <details><summary>Suggested image prompt</summary><p>Replace [HEADLINE] and [OFFER] with your campaign wording.</p><textarea aria-label="Suggested image generation prompt" readOnly value={PROMPT} rows={9}/><button onClick={async()=>{try{await navigator.clipboard.writeText(PROMPT);setNotice('Image prompt copied.');}catch{setError('Select the prompt text and copy it manually.');}}}>Copy prompt</button></details>
 </section>;
}
