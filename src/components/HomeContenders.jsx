import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRadio } from './RadioProvider.jsx';
import { sourceApprovedContenders } from '../lib/contenders.js';
import { createContenderOrdering } from '../lib/contender-order.js';
import './HomeContenders.css';

export default function HomeContenders() {
  const [songs,setSongs]=useState(sourceApprovedContenders);
  const [voting,setVoting]=useState(false);
  const [playing,setPlaying]=useState(null);
  const [error,setError]=useState('');
  const player=useRef(null);
  const radio=useRadio();
  const radioRef=useRef(radio);
  radioRef.current=radio;

  useEffect(()=>{
    const controller=new AbortController();
    const audio=player.current;
    async function load() {
      try {
        const response=await fetch('/api/christmas-contenders',{credentials:'omit',signal:controller.signal});
        const data=await response.json();
        if(Array.isArray(data.entries) && !controller.signal.aborted) {
          setSongs(createContenderOrdering()(data.entries.filter(song=>song.mode==='live' && song.approved && song.audio)));
          setVoting(data.status==='open' && data.realVotingEnabled===true);
        }
      } catch { /* The approved catalogue remains playable offline from the voting service. */ }
    }
    load();
    return ()=>{controller.abort();radioRef.current?.releaseContender(audio);};
  },[]);

  function toggle(song) {
    const audio=player.current;
    setError('');
    if(audio.dataset.song===song.id && !audio.paused) {audio.pause();return;}
    if(audio.dataset.song!==song.id) {
      audio.dataset.song=song.id;
      audio.src=song.audio;
    }
    radio?.claimContender(audio);
    audio.play().catch(reason=>{
      if(reason.name!=='AbortError' && audio.dataset.song===song.id) setError('This track could not play. Try another song.');
    });
  }

  return <section className="home-contenders" aria-labelledby="home-contenders-title">
    <header className="christmas-pairs__heading home-contenders__heading">
      <p className="christmas-pairs__eyebrow">The Future Stars of Santa Radio</p>
      <div className="christmas-pairs__title-wrap">
        <span className="christmas-pairs__title-star" aria-hidden="true"><Star size={17} fill="currentColor" /></span>
        <h2 id="home-contenders-title">The Christmas Contenders</h2>
      </div>
      <p className="christmas-pairs__intro">Have your say to the music we play</p>
    </header>
    <div className="home-contenders__brand">
      <img src="/contenders/christmas-contenders-logo.webp" alt="Santa Radio Christmas Contenders" width="760" height="422"/>
      <Link to="/christmas-contenders">{voting?'Vote for your favourite':'Visit Christmas Contenders'} <ArrowRight size={17}/></Link>
    </div>
    <div className="home-contenders__music">
      <h3>Listen to the contenders</h3>
      <ul aria-label="Contender songs" tabIndex={0}>{songs.map(song=><li key={song.id}>
        <button type="button" aria-label={`${playing===song.id?'Pause':'Play'} ${song.title} by ${song.artist}`} onClick={()=>toggle(song)}>
          <img src={song.artwork} width="50" height="50" alt="" loading="lazy"/>
          <span><strong>{song.title}</strong><small>{song.artist}</small></span>
          <i aria-hidden="true">{playing===song.id?<Pause size={15}/>:<Play size={15}/>}</i>
        </button>
      </li>)}</ul>
      {!songs.length && <p>New contenders will appear here.</p>}
      {error && <p role="status">{error}</p>}
      <audio ref={player} preload="none" onPlaying={e=>setPlaying(e.currentTarget.dataset.song)}
        onPause={()=>setPlaying(null)} onError={()=>{setPlaying(null);setError('This track could not play. Try another song.');}} />
    </div>
  </section>;
}
