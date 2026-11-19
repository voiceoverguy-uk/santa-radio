import {useEffect,useRef,useState} from 'react';
import './FoldingVideoPlayer.css';
export default function FoldingVideoPlayer({label,onPlay,onPause,onEnded,onError,...media}){
 const video=useRef(null),timer=useRef(null),raf=useRef(null);const [visible,setVisible]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[muted,setMuted]=useState(false),[error,setError]=useState('');
 const hideLater=()=>{clearTimeout(timer.current);if(video.current?.paused)timer.current=setTimeout(()=>setVisible(false),3000);};
 useEffect(()=>()=>{clearTimeout(timer.current);cancelAnimationFrame(raf.current);},[]);
 const tick=()=>{if(!video.current)return;setPosition(video.current.currentTime);if(!video.current.paused)raf.current=requestAnimationFrame(tick);};
 const toggle=async()=>{if(!video.current)return;if(!video.current.paused){video.current.pause();return;}try{setError('');await video.current.play();}catch{setError('Please try playing the example again.');}};
 const clock=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
 return <div className={`folding-video${visible?' is-visible':''}${playing?' is-playing':''}`} onPointerDown={hideLater} onKeyDown={hideLater}>
  <div className="folding-video__reveal" aria-hidden={!visible}><div className="folding-video__inner"><video {...media} ref={video} playsInline aria-label={label} onLoadedMetadata={()=>setDuration(Number.isFinite(video.current.duration)?video.current.duration:0)} onTimeUpdate={()=>setPosition(video.current.currentTime)} onPlay={e=>{clearTimeout(timer.current);setVisible(true);setPlaying(true);cancelAnimationFrame(raf.current);tick();onPlay?.(e);}} onPause={e=>{setPlaying(false);cancelAnimationFrame(raf.current);hideLater();onPause?.(e);}} onEnded={e=>{setPlaying(false);hideLater();onEnded?.(e);}} onError={e=>{setPlaying(false);setError('This example could not play.');onError?.(e);}} /></div></div>
  <div className="folding-video__bar"><img src="/images/kids-player-play-v2.png" alt=""/><img className="folding-video__pause" src="/images/kids-player-pause-v2.png" alt=""/>
  <button className="folding-video__play" onClick={toggle} aria-label={`${playing?'Pause':'Play'} ${label.replace(/^Play /,'')}`}/>
  <div className="folding-video__seek"><span className="folding-video__sparkles" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></span><img src="/images/kids-player-knob-v1.png" alt="" style={{left:`${duration?position/duration*100:0}%`}}/><input type="range" aria-label="Seek example video" min="0" max={duration||1} step=".1" value={position} disabled={!duration} onChange={e=>{const t=Number(e.target.value);video.current.currentTime=t;setPosition(t);hideLater();}}/></div>
  <button className="folding-video__mute" aria-label={muted?'Unmute example':'Mute example'} aria-pressed={muted} onClick={()=>{video.current.muted=!muted;setMuted(!muted);}}>{muted?'╱':''}</button></div>
  <div className="folding-video__time">{clock(position)} / {clock(duration)}</div>{error&&<p role="status">{error}</p>}
 </div>;
}
