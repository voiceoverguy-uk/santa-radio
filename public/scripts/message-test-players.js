const players=[...document.querySelectorAll('[data-demo-player]')];
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
players.forEach(player=>{
 const audio=player.querySelector('audio'),play=player.querySelector('[data-play]'),mute=player.querySelector('[data-mute]'),seek=player.querySelector('input'),knob=player.querySelector('.seek-knob'),clock=player.querySelector('[data-time]'),status=player.querySelector('[data-status]'),name=player.dataset.demoPlayer;
 let frame=0,scrubbing=false;
 mute.setAttribute('aria-label',`Mute ${name} example`);
 const duration=()=>Number.isFinite(audio.duration)?audio.duration:0;
 const paint=(position=audio.currentTime)=>{const total=duration();seek.disabled=!total;seek.max=String(total||1);if(!scrubbing)seek.value=String(position);knob.style.left=`${total?Math.max(0,Math.min(100,position/total*100)):0}%`;clock.textContent=`${time(position)} / ${time(total)}`;seek.setAttribute('aria-valuetext',`${time(position)} of ${time(total)}`);};
 const tick=()=>{if(!scrubbing)paint();if(!audio.paused&&!audio.ended)frame=requestAnimationFrame(tick);};
 const state=()=>{play.setAttribute('aria-label',`${audio.paused?'Play':'Pause'} ${name} example`);play.setAttribute('aria-pressed',String(!audio.paused));player.classList.toggle('playing',!audio.paused);cancelAnimationFrame(frame);if(!audio.paused)frame=requestAnimationFrame(tick);else if(!scrubbing)paint();};
 play.addEventListener('click',async()=>{if(!audio.paused){audio.pause();return;}players.forEach(p=>{if(p!==player)p.querySelector('audio').pause();});try{status.textContent='';await audio.play();}catch{status.textContent='Unable to play. Please try again.';}});
 mute.addEventListener('click',()=>{audio.muted=!audio.muted;mute.setAttribute('aria-label',`${audio.muted?'Unmute':'Mute'} ${name} example`);mute.setAttribute('aria-pressed',String(audio.muted));player.classList.toggle('muted',audio.muted);});
 seek.addEventListener('pointerdown',()=>{scrubbing=true;});
 const finish=()=>{if(scrubbing){scrubbing=false;paint();}};
 window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);seek.addEventListener('blur',finish);
 seek.addEventListener('input',()=>{if(duration()){const target=Number(seek.value);audio.currentTime=target;paint(target);}});
 ['loadedmetadata','durationchange','timeupdate','seeked'].forEach(e=>audio.addEventListener(e,()=>{if(!scrubbing)paint();}));['play','pause','ended'].forEach(e=>audio.addEventListener(e,state));
 audio.addEventListener('error',()=>{status.textContent='This example is temporarily unavailable.';seek.disabled=true;});paint();state();
});
