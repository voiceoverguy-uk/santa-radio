import useVideoDemo from '../hooks/useVideoDemo.js';
import {useEffect,useRef,useState} from 'react';
const time = value => `${Math.floor((value || 0)/60)}:${String(Math.floor((value || 0)%60)).padStart(2,'0')}`;
export default function BespokeExamplePlayer({kind}) {
 const {example, choose}=useVideoDemo(kind==='dad'?'dads':'kids');
 return example ? <BespokeVideo key={example.id} kind={kind} example={example} onEnded={choose} /> : null;
}
function BespokeVideo({kind,example,onEnded}) {
 const ref=useRef(null),[open,setOpen]=useState(false),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
 useEffect(()=>{if(!open||playing)return;const timer=setTimeout(()=>setOpen(false),3000);return()=>clearTimeout(timer);},[open,playing,position]);
 const cue=example.cues?.some(start=>position>=start&&position<start+4);
 async function toggle(){const video=ref.current;if(!video)return;if(!video.paused){video.pause();return;}setOpen(true);setError('');document.querySelectorAll('video,audio').forEach(other=>{if(other!==video)other.pause();});try{await video.play();}catch{setError('Please tap Play to try again.');}}
 return <div className={`bespoke-player ${kind}${open?' is-open':''}`}>
  <div className="bespoke-player__reveal" aria-hidden={!open} inert={open?undefined:""}><div><div className="bespoke-player__stage"><video ref={ref} src={example.src} poster={example.poster} preload="metadata" playsInline muted={muted} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);onEnded();}} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} aria-label={example.name + " example video"}/><button type="button" className="bespoke-player__expand" aria-label="Expand example video" onClick={()=>{const v=ref.current;const fn=v.requestFullscreen||v.webkitEnterFullscreen;fn?.call(v);}}>⤢</button></div></div></div>
  <div className={`bespoke-player__hint${cue?" is-cue":""}`} aria-hidden={!cue}>✦ Personalisation Moment. ✦</div><div className="bespoke-player__skin"><img src={`/images/${kind}-player-${playing?'pause':'play'}-v2.webp`} alt=""/><button type="button" className="bespoke-player__play" aria-label={playing?'Pause example video':'Play example video'} onClick={toggle}/><div className="bespoke-player__seek"><img src={`/images/${kind}-player-knob-v1.webp`} alt="" style={{left:`${duration?position/duration*100:0}%`}}/><input aria-label="Seek example video" type="range" min="0" max={duration||1} step="0.1" value={position} onChange={e=>{ref.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}/></div><button type="button" className="bespoke-player__mute" aria-label={muted?'Unmute example video':'Mute example video'} onClick={()=>setMuted(!muted)}>{muted?'×':''}</button></div>
  <div className="bespoke-player__caption"><span>{example.recipient ? 'Watch an example message for ' + example.recipient : example.name}</span><span>{time(position)} / {time(duration)}</span></div>{error&&<p role="alert">{error}</p>}
 </div>;
}
