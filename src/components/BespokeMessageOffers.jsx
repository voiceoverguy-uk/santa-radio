import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import StudioReturnAccess from './StudioReturnAccess.jsx';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import {StudioGiftPreview} from './SantaStudioGifts.jsx';
import DadCertificate from './DadCertificate.jsx';
import BespokeExamplePlayer from './BespokeExamplePlayer.jsx';
import './BespokeMessageOffers.css';
const names=['Harry','Arabella','Charlotte','Layla','Freya','Jack','Bob'];
const launch=Date.parse('2026-11-21T09:00:00Z');
function DadLaunch(){
 const [now,setNow]=useState(null);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const seconds=now===null?null:Math.max(0,Math.floor((launch-now)/1000));
 return <div className="bespoke-launch"><strong>Available 9am Saturday 21st November</strong>{seconds!==null&&seconds>0?<p aria-label="Time until Dad messages open">{Math.floor(seconds/86400)} {Math.floor(seconds/86400)===1?'day':'days'} · {Math.floor(seconds/3600)%24} hours · {Math.floor(seconds/60)%60} minutes · {seconds%60} seconds</p>:seconds===0?<p>It’s opening time — explore Dad’s Studio for availability.</p>:null}</div>;
}
export default function BespokeMessageOffers({previewName}) {
 const [sample,setSample]=useState('Harry'),[stored,setStored]=useState(''),[gifts,setGifts]=useState(false);
 const dadDialog=useRef(null),returnDialog=useRef(null);
 const [returnOpen,setReturnOpen]=useState(false);
 useEffect(()=>{setSample(names[Math.floor(Math.random()*names.length)]);try{const value=JSON.parse(sessionStorage.getItem('santa-preview-recipient')||'null');if(value?.name&&Date.now()-value.at<86400000)setStored(value.name);}catch{}},[]);
 const name=previewName||stored||sample;
 return <div className="bespoke-offers">
 <article className="bespoke-offer kids"><div className="bespoke-offer__art"><img src="/images/kids-message-logo-v1.png" alt="Kids’ Message from Santa"/></div><BespokeExamplePlayer kind="kids"/>
 <div className="bespoke-offer__body"><p className="bespoke-offer__eyebrow">The premium Christmas experience</p><h3>Make their Christmas magical.</h3><p className="bespoke-offer__description">Their name. Their little achievements. A video message from Santa that feels like it was made just for them... because, let’s face it, it was.</p><ul><li>Personalised with their name, age, achievements and more</li><li>A Christmas message to watch, download and share</li><li>Personalised letter, Nice List certificate &amp; Santa picture</li><li><strong className="bespoke-two">TWO</strong> message creations included</li></ul><div className="bespoke-offer__buy"><div className="bespoke-offer__price">£6.50 <small>Includes free digital gifts</small><button type="button" onClick={()=>setGifts(!gifts)} aria-expanded={gifts}>Preview the gifts ↗</button></div><StudioPurchaseButton label="Create their Santa magic →" onReturnRequest={()=>{setReturnOpen(true);returnDialog.current.showModal();}}/></div></div></article>
 <article className="bespoke-offer dad"><div className="bespoke-offer__art"><img src="/images/dad-message-logo-v4.png" alt="Dad’s Message from Santa"/></div><BespokeExamplePlayer kind="dad"/>
 <div className="bespoke-offer__body"><p className="bespoke-offer__eyebrow">He’s not getting away with it.</p><h3>Santa’s got Dad’s number.</h3><p className="bespoke-offer__description">The bad habits. The TV choices. Whatever he left out for Santa. Give Dad a unique Christmas message from Santa the whole family can smile at.</p><ul><li>His name, age and wonderfully questionable habits</li><li>Personalised with his viewing choices &amp; Santa’s treat</li><li>Choose from six funny Christmas scenes</li><li>One personalised video and certificate to download and share</li></ul><div className="bespoke-offer__buy"><div className="bespoke-offer__price">£5 <small>one message creation</small><button type="button" onClick={()=>dadDialog.current.showModal()}>Preview Dad’s certificate ↗</button></div><div className="bespoke-offer__checkout"><Link className="bespoke-offer__cta" to="/dad-message-maker">Explore Dad’s message →</Link><DadLaunch/></div></div></div></article>
 {gifts&&<div className="bespoke-gift-preview"><h3>Personalised digital gifts for {name}</h3><p>Tap a gift to see it in full.</p><StudioGiftPreview example={{name,picture:'/images/santa-nice-list.jpg',reducedMotion:true,activeAudio:false,onNext:()=>{}}} variant="promotion"/><button type="button" onClick={()=>setGifts(false)}>Close gifts</button></div>}
 <dialog className="bespoke-return-dialog" ref={returnDialog} aria-label="Request your Studio return link" onClose={()=>setReturnOpen(false)}><button className="bespoke-return-close" type="button" onClick={()=>returnDialog.current.close()}>Close ×</button>{returnOpen&&<StudioReturnAccess/>}</dialog>
 <dialog className="bespoke-certificate-dialog" ref={dadDialog} aria-label="Dad certificate preview"><button type="button" onClick={()=>dadDialog.current.close()}>Close preview ×</button><DadCertificate name="Dad"/></dialog>
 </div>;
}
