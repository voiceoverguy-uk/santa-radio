import StudioOfferBenefits from './StudioOfferBenefits.jsx';
import {useEffect,useRef,useState} from 'react';
import {DAD_LAUNCH_AT} from '../lib/dadLaunch.js';
import DadEarlyAccess from './DadEarlyAccess.jsx';
import StudioReturnAccess from './StudioReturnAccess.jsx';
import StudioPurchaseButton from './StudioPurchaseButton.jsx';
import {StudioGiftPreview} from './SantaStudioGifts.jsx';
import {STUDIO_GIFT_PICTURE} from '../lib/santaPictureLayout.js';
import DadCertificate from './DadCertificate.jsx';
import BespokeExamplePlayer from './BespokeExamplePlayer.jsx';
import { Share } from 'lucide-react';
import { ORIGIN } from '../seo/catalogue.js';
import { kidsOffer, dadOffer, messageOfferPath } from '../lib/messageMakerOffers.js';
import SantaMessageShare from './SantaMessageShare.jsx';
import './BespokeMessageOffers.css';


function OfferShare({ offer }) {
  return (
    <div className="bespoke-offer__share">
      <SantaMessageShare data={{ title: offer.title, url: `${ORIGIN}${messageOfferPath(offer)}` }} label={`Share ${offer.title}`}>
        <Share size={17} aria-hidden="true" /> Share
      </SantaMessageShare>
    </div>
  );
}

const names=['Harry','Arabella','Charlotte','Layla','Freya','Jack','Bob'];
const launch=DAD_LAUNCH_AT;
function DadLaunch(){
 const [now,setNow]=useState(null);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const seconds=now===null?null:Math.max(0,Math.floor((launch-now)/1000));
 return <div className="bespoke-launch"><strong>Available 9am Saturday 21/11/2026</strong>{seconds!==null&&seconds>0?<p aria-label="Time until Dad messages open">{Math.floor(seconds/86400)} {Math.floor(seconds/86400)===1?'day':'days'} · {Math.floor(seconds/3600)%24} hours · {Math.floor(seconds/60)%60} minutes · {seconds%60} seconds</p>:seconds===0?<p>Dad’s messages are now available.</p>:null}</div>;
}
export default function BespokeMessageOffers({previewName}) {
 const [sample,setSample]=useState('Harry'),[stored,setStored]=useState('');
 const dadDialog=useRef(null),returnDialog=useRef(null);
 const [returnOpen,setReturnOpen]=useState(false);
 useEffect(() => {
   const dialog = returnDialog.current;
   if (returnOpen && dialog && !dialog.open) dialog.showModal();
 }, [returnOpen]);
 useEffect(()=>{setSample(names[Math.floor(Math.random()*names.length)]);try{const value=JSON.parse(sessionStorage.getItem('santa-preview-recipient')||'null');if(value?.name&&Date.now()-value.at<86400000)setStored(value.name);}catch{}},[]);
 const name=previewName||stored||sample;
 return <div className="bespoke-offers">
 <article id={kidsOffer.id} className="bespoke-offer kids"><div className="bespoke-offer__art"><img src="/images/kids-message-logo-v1.webp" srcSet="/images/kids-message-logo-v1-640.webp 640w, /images/kids-message-logo-v1.webp 1200w" sizes="(max-width: 680px) calc(100vw - 80px), (max-width: 1200px) 45vw, 550px" width="1200" height="668" alt="Kids’ Message from Santa"/></div><BespokeExamplePlayer kind="kids"/>
 <div className="bespoke-offer__body"><div className="bespoke-offer__details"><p className="bespoke-offer__eyebrow">The premium Christmas experience</p><h3>Make their Christmas magical.</h3><p className="bespoke-offer__description">Their name. Their little achievements. A video message from Santa that feels like it was made just for them... because, let’s face it, it was.</p><StudioOfferBenefits /></div><div className="bespoke-offer__buy"><div className="bespoke-offer__price">£6.50 <small>Includes free digital gifts</small><StudioGiftPreview example={{name,picture:STUDIO_GIFT_PICTURE,reducedMotion:true}} variant="offer-popup"/></div><StudioPurchaseButton explore label="Explore the Kids’ Message →" onReturnRequest={()=>setReturnOpen(true)}/></div>
 <OfferShare offer={kidsOffer} />
 </div></article>
 <article id={dadOffer.id} className="bespoke-offer dad"><div className="bespoke-offer__art"><img src="/images/dad-message-logo-v4.webp" srcSet="/images/dad-message-logo-v4-640.webp 640w, /images/dad-message-logo-v4.webp 1200w" sizes="(max-width: 680px) calc(100vw - 80px), (max-width: 1200px) 45vw, 550px" width="1200" height="668" alt="Dad’s Message from Santa"/></div><BespokeExamplePlayer kind="dad"/>
 <div className="bespoke-offer__body"><div className="bespoke-offer__details"><p className="bespoke-offer__eyebrow">He’s not getting away with it.</p><h3>Santa’s got Dad’s number.</h3><p className="bespoke-offer__description">The bad habits. The TV choices. Whatever he left out for Santa. Give Dad a unique Christmas message from Santa the whole family can smile at.</p><ul><li>His name, age and wonderfully questionable habits</li><li>Personalised with his viewing choices &amp; Santa’s treat</li><li>Choose from six funny Christmas scenes</li><li>One personalised video and certificate to download and share</li></ul></div><div className="bespoke-offer__buy"><div className="bespoke-offer__price">£5 <small>one message creation</small><button type="button" onClick={()=>dadDialog.current.showModal()}>Preview Dad’s certificate ↗</button></div><div className="bespoke-offer__checkout"><DadEarlyAccess launchAt={launch}><DadLaunch/></DadEarlyAccess><DadLaunch/></div></div>
 <OfferShare offer={dadOffer} />
 </div></article>
 <dialog className="bespoke-return-dialog" ref={returnDialog} aria-label="Request your Studio return link" onClose={()=>setReturnOpen(false)}><button className="bespoke-return-close" type="button" onClick={()=>returnDialog.current.close()}>Close ×</button>{returnOpen&&<StudioReturnAccess/>}</dialog>
 <dialog className="bespoke-certificate-dialog" ref={dadDialog} aria-label="Dad certificate preview"><button type="button" onClick={()=>dadDialog.current.close()}>Close preview ×</button><DadCertificate name="Dad"/></dialog>
 </div>;
}
