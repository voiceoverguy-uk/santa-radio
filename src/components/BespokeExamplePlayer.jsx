import useMessageDemos from '../hooks/useMessageDemos.js';
import {useEffect,useRef,useState} from 'react';
import './BespokeMessageOffers.css';
const time = value => `${Math.floor((value || 0)/60)}:${String(Math.floor((value || 0)%60)).padStart(2,'0')}`;
export default function BespokeExamplePlayer({ kind }) {
  const demos = useMessageDemos(kind === 'dad' ? 'dads' : 'kids');
  const [sample] = useState(Math.random);
  const example = demos[Math.floor(sample * demos.length)];
  if (!example) return null;
  return <div className="bespoke-kids-examples">
    <ExampleVideo key={example.id} kind={kind} src={example.src} poster={example.poster}
      cues={example.cues} label={example.label || example.name} />
  </div>;
}

function ExampleVideo({ kind, src, label, poster, cues }) {
 const ref=useRef(null),[open,setOpen]=useState(false),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
 useEffect(()=>{if(!open||playing)return;const timer=setTimeout(()=>setOpen(false),3000);return()=>clearTimeout(timer);},[open,playing,position]);
 const cue=cues?.some(start=>position>=start&&position<start+4);
 async function toggle(){const video=ref.current;if(!video)return;if(!video.paused){video.pause();return;}setOpen(true);setError('');document.querySelectorAll('video,audio').forEach(other=>{if(other!==video)other.pause();});try{await video.play();}catch{setError('Please tap Play to try again.');}}
 return <div className={`bespoke-player ${kind}${open?' is-open':''}`}>
  <div className="bespoke-player__reveal" aria-hidden={!open} inert={open?undefined:""}><div><div className="bespoke-player__stage"><video ref={ref} src={src} poster={poster} preload="metadata" playsInline muted={muted} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} aria-label={label}/> {kind==='dad' && <div className={`bespoke-player__hint${cue?" is-cue":""}`} aria-hidden={!cue}>✦ Personalisation Moment. ✦</div>}<button type="button" className="bespoke-player__expand" aria-label="Expand example video" onClick={()=>{const v=ref.current;const fn=v.requestFullscreen||v.webkitEnterFullscreen;fn?.call(v);}}>⤢</button></div></div></div>
  <div className="bespoke-player__skin"><img src={`/images/${kind}-player-${playing?'pause':'play'}-v2.webp`} alt=""/><button type="button" className="bespoke-player__play" aria-label={kind==='dad'?(playing?'Pause example video':'Play example video'):`${playing?'Pause':'Play'} ${label}`} onClick={toggle}/><div className="bespoke-player__seek"><img src={`/images/${kind}-player-knob-v1.webp`} alt="" style={{left:`${duration?position/duration*100:0}%`}}/><input aria-label="Seek example video" type="range" min="0" max={duration||1} step="0.1" value={position} onChange={e=>{ref.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}/></div><button type="button" className="bespoke-player__mute" aria-label={muted?'Unmute example video':'Mute example video'} onClick={()=>setMuted(!muted)}>{muted?'×':''}</button></div>
  <div className="bespoke-player__caption"><span>{kind === "kids" ? "Watch an example message for Kids" : label}</span><span>{time(position)} / {time(duration)}</span></div>{error&&<p role="alert">{error}</p>}
 </div>;
}
