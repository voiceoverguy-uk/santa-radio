import {useEffect,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import './MySantaMessagesPreview.css';
export default function MySantaMessages(){
 const [Page,setPage]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;import('./MySantaMessagesBrowser.jsx').then(m=>{if(active)setPage(()=>m.default)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[]);
 return <><Helmet><title>My Santa Messages | Santa Radio</title><meta name="robots" content="noindex,nofollow"/></Helmet>{Page?<Page/>:<main className="my-santa-preview"><h1>My Santa Messages</h1><p role="status">{error?'Sign-in could not load. Please reload the page.':'Opening secure sign-in…'}</p></main>}</>;
}
