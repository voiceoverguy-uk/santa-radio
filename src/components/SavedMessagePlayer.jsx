import {useEffect,useRef,useState} from 'react';
import {useRadio} from './RadioProvider.jsx';
export default function SavedMessagePlayer({message,getToken,onPlay}) {
 const radio=useRadio(),audioRef=useRef(null),resumeRef=useRef(null);
 const finish=()=>{const resume=resumeRef.current;resumeRef.current=null;resume?.();};
 const [url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const resource=useRef({url:'',controller:null,active:true});
 useEffect(()=>{const state=resource.current;state.active=true;return()=>{state.active=false;state.controller?.abort();if(state.url)URL.revokeObjectURL(state.url);};},[]);
 useEffect(()=>{const audio=audioRef.current;return()=>{audio?.pause();finish();};},[url]);
 async function listen(){
  if(loading)return;
  const state=resource.current,controller=new AbortController();state.controller=controller;setLoading(true);setError('');
  try{
   const token=await getToken();
   if(controller.signal.aborted)return;
   const response=await fetch(`/api/my-santa-messages?action=file&id=${encodeURIComponent(message.id)}&kind=audio`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
   if(!response.ok)throw Error('This recording could not load. Refresh your collection and try again.');
   const blob=await response.blob();if(!state.active||controller.signal.aborted)return;
   if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);setUrl(state.url);
  }catch(e){if(state.active&&!controller.signal.aborted)setError(e.name==='TimeoutError'?'Loading took too long. Please try again.':e.message);}
  finally{if(state.active&&!controller.signal.aborted)setLoading(false);}
 }
 return <div className="my-santa-audio-player">
  <p className="my-santa-player-label">Listen to your message</p>
  {url?<audio ref={audioRef} controls autoPlay preload="metadata" src={url} aria-label={`Play Santa’s message for ${message.name}`} onPlay={e=>{onPlay(e.currentTarget);resumeRef.current=radio?.pauseForMessage?.()||null;}} onPause={finish} onEnded={finish} onError={()=>{finish();setError('Playback is unavailable. You can still try downloading the audio below.');}} />:<button type="button" className="my-santa-listen" disabled={loading} onClick={listen} aria-label={`Listen to Santa’s message for ${message.name}`}>{loading?'Loading your recording…':'▶ Listen to your message'}</button>}
  {loading&&<p role="status" className="my-santa-player-status">Getting your saved recording ready…</p>}
  {error&&<p role="alert" className="my-santa-player-error">{error}</p>}
 </div>;
}
