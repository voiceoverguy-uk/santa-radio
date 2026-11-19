const players=[...document.querySelectorAll('[data-demo-player]')];
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
players.forEach(player=>{
 const video=player.querySelector('video'),play=player.querySelector('[data-play]'),mute=player.querySelector('[data-mute]'),seek=player.querySelector('input'),knob=player.querySelector('.seek-knob'),clock=player.querySelector('[data-time]'),status=player.querySelector('[data-status]'),name=player.dataset.demoPlayer;
 let frame=0,scrubbing=false;
 mute.setAttribute('aria-label',`Mute ${name} example`);
 const duration=()=>Number.isFinite(video.duration)?video.duration:0;
 const paint=(position=video.currentTime)=>{const total=duration();seek.disabled=!total;seek.max=String(total||1);if(!scrubbing)seek.value=String(position);knob.style.left=`${total?Math.max(0,Math.min(100,position/total*100)):0}%`;clock.textContent=`${time(position)} / ${time(total)}`;seek.setAttribute('aria-valuetext',`${time(position)} of ${time(total)}`);};
 const tick=()=>{if(!scrubbing)paint();if(!video.paused&&!video.ended)frame=requestAnimationFrame(tick);};
 const state=()=>{play.setAttribute('aria-label',`${video.paused?'Play':'Pause'} ${name} example`);play.setAttribute('aria-pressed',String(!video.paused));player.classList.toggle('playing',!video.paused);cancelAnimationFrame(frame);if(!video.paused)frame=requestAnimationFrame(tick);else if(!scrubbing)paint();};
 play.addEventListener('click',async()=>{if(!video.paused){video.pause();return;}players.forEach(p=>{if(p!==player)p.querySelector('video').pause();});try{status.textContent='';await video.play();}catch{status.textContent='Unable to play. Please try again.';}});
 mute.addEventListener('click',()=>{video.muted=!video.muted;mute.setAttribute('aria-label',`${video.muted?'Unmute':'Mute'} ${name} example`);mute.setAttribute('aria-pressed',String(video.muted));player.classList.toggle('muted',video.muted);});
 seek.addEventListener('pointerdown',()=>{scrubbing=true;});
 const finish=()=>{if(scrubbing){scrubbing=false;paint();}};
 window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);seek.addEventListener('blur',finish);
 seek.addEventListener('input',()=>{if(duration()){const target=Number(seek.value);video.currentTime=target;paint(target);}});
 ['loadedmetadata','durationchange','timeupdate','seeked'].forEach(e=>video.addEventListener(e,()=>{if(!scrubbing)paint();}));['play','pause','ended'].forEach(e=>video.addEventListener(e,state));
 video.addEventListener('error',()=>{status.textContent='This example is temporarily unavailable.';seek.disabled=true;});paint();state();
});
