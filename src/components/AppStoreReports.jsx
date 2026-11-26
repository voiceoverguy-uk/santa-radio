import { useId, useRef, useState } from 'react';
import AppleAppDownloads from './AppleAppDownloads.jsx';
import AndroidAppInstalls from './AndroidAppInstalls.jsx';
import './AppStoreReports.css';
function StoreIcon({store}) {
  return store==='apple'?<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.1 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.5-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8-.6 0-1.6-.8-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.2 1 8.3.7 1 1.4 2 2.5 2 .9 0 1.3-.6 2.6-.6s1.7.6 2.8.6 1.7-1 2.4-2c.8-1.2 1.2-2.4 1.2-2.5-.1 0-1.9-.7-1.9-3zM15 6.4c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 4 2 3m10-3-2 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path fill="currentColor" d="M4 13a8 8 0 0 1 16 0v6H4z"/><circle cx="8" cy="11" r="1" fill="#0d2d23"/><circle cx="16" cy="11" r="1" fill="#0d2d23"/></svg>;
}
export default function AppStoreReports({appleReport,androidSource}) {
  const [selected,setSelected]=useState('apple'),[androidOpened,setAndroidOpened]=useState(false);
  const id=useId(),buttons=useRef({});
  function select(store){setSelected(store);if(store==='android')setAndroidOpened(true);}
  function onKeyDown(event,store){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?'apple':event.key==='End'?'android':store==='apple'?'android':'apple';
    select(next);buttons.current[next]?.focus();
  }
  return <section id="app-store-reports" className="apple-app-downloads app-store-reports" aria-labelledby={`${id}-title`}>
    <div className="apple-app-downloads__montage" aria-hidden="true">{(appleReport?.apps??[]).map(app=><img key={app.id} src={app.icon} alt="" />)}</div>
    <div className="apple-app-downloads__content">
      <p className="apple-app-downloads__eyebrow">YOUR CHRISTMAS APP COLLECTION</p>
      <h2 id={`${id}-title`}>App store downloads</h2>
      <div className="app-store-reports__tabs" role="tablist" aria-label="App store">
        {['apple','android'].map(store=><button type="button" role="tab" key={store} ref={el=>{buttons.current[store]=el;}} id={`${id}-${store}-tab`} aria-controls={`${id}-${store}-panel`} aria-selected={selected===store} tabIndex={selected===store?0:-1} onClick={()=>select(store)} onKeyDown={event=>onKeyDown(event,store)}><StoreIcon store={store}/><span>{store==='apple'?'Apple':'Android'}</span></button>)}
      </div>
      <div role="tabpanel" id={`${id}-apple-panel`} aria-labelledby={`${id}-apple-tab`} hidden={selected!=='apple'} tabIndex={0}><AppleAppDownloads report={appleReport}/></div>
      <div role="tabpanel" id={`${id}-android-panel`} aria-labelledby={`${id}-android-tab`} hidden={selected!=='android'} tabIndex={0}>{androidOpened&&<AndroidAppInstalls source={androidSource}/>}</div>
    </div>
  </section>;
}
