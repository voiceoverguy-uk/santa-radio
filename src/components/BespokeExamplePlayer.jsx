import {useEffect,useRef,useState} from 'react';
import './BespokeMessageOffers.css';
const time = value => `${Math.floor((value || 0)/60)}:${String(Math.floor((value || 0)%60)).padStart(2,'0')}`;
const kidsExamples = ['01', '02'].map((id, index) => ({
  src: `/videos/examples/santa-bespoke-message-example-${id}.mp4`,
  label: `Kids’ example ${index + 1}`,
}));

export default function BespokeExamplePlayer({ kind }) {
  const [selected, setSelected] = useState(0);
  if (kind === 'dad') return <ExampleVideo kind="dad" src="/videos/examples/dad-simon-v3.mp4" label="Watch an example message for Dad" />;

  const example = kidsExamples[selected];
  return <div className="bespoke-kids-examples">
    <div className="bespoke-kids-examples__choices" role="group" aria-label="Choose a Kids’ sample video">
      {kidsExamples.map(({ src }, index) => <button key={src} type="button" aria-pressed={index === selected}
        onClick={() => setSelected(index)}>Example {index + 1}</button>)}
    </div>
    <ExampleVideo key={example.src} kind="kids" {...example} />
  </div>;
}

function ExampleVideo({ kind, src, label }) {
 const ref=useRef(null),[open,setOpen]=useState(false),[playing,setPlaying]=useState(false),[muted,setMuted]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
 useEffect(()=>{if(!open||playing)return;const timer=setTimeout(()=>setOpen(false),3000);return()=>clearTimeout(timer);},[open,playing,position]);
 const cue=kind==='dad' && [10,23,42,60,80,103].some(start=>position>=start&&position<start+4);
 async function toggle(){const video=ref.current;if(!video)return;if(!video.paused){video.pause();return;}setOpen(true);setError('');document.querySelectorAll('video,audio').forEach(other=>{if(other!==video)other.pause();});try{await video.play();}catch{setError('Please tap Play to try again.');}}
 return <div className={`bespoke-player ${kind}${open?' is-open':''}`}>
  <div className="bespoke-player__reveal" aria-hidden={!open} inert={open?undefined:""}><div><div className="bespoke-player__stage"><video ref={ref} src={src} poster={src.replace('.mp4','.jpg')} preload="metadata" playsInline muted={muted} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} aria-label={label}/><button type="button" className="bespoke-player__expand" aria-label="Expand example video" onClick={()=>{const v=ref.current;const fn=v.requestFullscreen||v.webkitEnterFullscreen;fn?.call(v);}}>⤢</button></div></div></div>
  {kind==='dad' && <div className={`bespoke-player__hint${cue?" is-cue":""}`} aria-hidden={!cue}>✦ Personalisation Moment. ✦</div>}<div className="bespoke-player__skin"><img src={`/images/${kind}-player-${playing?'pause':'play'}-v2.webp`} alt=""/><button type="button" className="bespoke-player__play" aria-label={kind==='dad'?(playing?'Pause example video':'Play example video'):`${playing?'Pause':'Play'} ${label}`} onClick={toggle}/><div className="bespoke-player__seek"><img src={`/images/${kind}-player-knob-v1.webp`} alt="" style={{left:`${duration?position/duration*100:0}%`}}/><input aria-label="Seek example video" type="range" min="0" max={duration||1} step="0.1" value={position} onChange={e=>{ref.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}/></div><button type="button" className="bespoke-player__mute" aria-label={muted?'Unmute example video':'Mute example video'} onClick={()=>setMuted(!muted)}>{muted?'×':''}</button></div>
  <div className="bespoke-player__caption"><span>{label}</span><span>{time(position)} / {time(duration)}</span></div>{error&&<p role="alert">{error}</p>}
 </div>;
}
