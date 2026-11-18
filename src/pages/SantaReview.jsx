import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { validateSantaReview } from '../lib/santaReviewValidation.js';
import './SantaReview.css';
export default function SantaReview() {
  const [status,setStatus]=useState('loading'),[error,setError]=useState('');
  const [rating,setRating]=useState(0),[body,setBody]=useState(''),[displayName,setName]=useState(''),[consent,setConsent]=useState(false),[rewardEmail,setRewardEmail]=useState(true),[busy,setBusy]=useState(false);
  const count=[...body.trim()].length;
  useEffect(()=>{let active=true;fetch('/api/santa-reviews',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active){ if (d.submitted) setRewardEmail(d.rewardEmail === true); setStatus(d.submitted?'sent':'ready'); }}).catch(e=>{if(active){setStatus('unavailable');setError(e.message);}});return()=>{active=false;};},[]);
  async function submit(event){event.preventDefault();const data={rating,body,displayName,consent,rewardEmail};const checked=validateSantaReview(data);if(checked.error){setError(checked.error);return;}setBusy(true);setError('');try{let receipt='';try{receipt=sessionStorage.getItem('santa-review-receipt')||'';}catch{}const r=await fetch('/api/santa-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,receipt})});const d=await r.json();if(!r.ok)throw new Error(d.error);setStatus('sent');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <main className="santa-review"><Helmet><title>Review your free Santa message | Santa Radio</title><meta name="robots" content="noindex, nofollow" /></Helmet>
    <p className="eyebrow">A LITTLE THANK YOU</p><h1>How was your Santa message?</h1>
    {status==='loading'?<p>Opening your review form…</p>:status==='sent'?<><h2>Thank you for your feedback</h2><p>{rewardEmail ? "Your review is saved and your discount email has been requested. Every star rating qualifies. We’ll check any review before publishing it." : "We’ll review your feedback. You chose not to receive a discount email."}</p><Link to="/">Back to Santa Radio</Link></>:status==='ready'?<><p>Leave a review for 20% off the £6.50 bespoke package.</p>
    <form onSubmit={submit}><fieldset><legend>Your rating</legend><div className="santa-review__stars">{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name="rating" value={n} checked={rating===n} onChange={()=>setRating(n)} required /><span aria-hidden="true">{n<=rating?'★':'☆'}</span><span className="santa-review__sr">{n} {n===1?'star':'stars'}</span></label>)}</div></fieldset>
    <label htmlFor="review-body">Your review</label><textarea id="review-body" rows={5} maxLength={200} value={body} onChange={e=>setBody(e.target.value)} aria-describedby="review-count" required placeholder="Tell us what you and your little one thought…" />
    <p id="review-count" aria-live="polite">{count<50?`${50-count} more characters needed`: `${count} / 200 characters`}</p>
    <label htmlFor="review-name">Your first name (adult, optional)</label><input id="review-name" maxLength={60} value={displayName} onChange={e=>setName(e.target.value)} autoComplete="given-name" />
    <label className="santa-review__check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />You may feature my review, rating and first name on Santa Radio.</label>
    <label className="santa-review__check"><input type="checkbox" checked={rewardEmail} onChange={e=>setRewardEmail(e.target.checked)} />Email my discount to the address I verified for my free message.</label>
    <p className="santa-review__note">All star ratings qualify. Your discount email is requested when you submit. Reviews are checked separately before publication. Please leave out children’s names and private details. <Link to="/privacy-policy">Privacy policy</Link></p>
    <button className="btn-red" disabled={busy||count<50||count>200||!rating}>{busy?'Sending…':'Submit review'}</button></form></>:<Link to="/free-santa-message">Return to your free message</Link>}
    {error&&<p role="alert">{error}</p>}
  </main>;
}
