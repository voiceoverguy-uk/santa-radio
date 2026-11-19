const players=[...document.querySelectorAll('[data-demo-player]')];
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
players.forEach(player=>{
 const audio=player.querySelector('audio'),play=player.querySelector('[data-play]'),mute=player.querySelector('[data-mute]'),seek=player.querySelector('input'),clock=player.querySelector('[data-time]'),status=player.querySelector('[data-status]'),name=player.dataset.demoPlayer;
 mute.setAttribute('aria-label',`Mute ${name} example`);
 const update=()=>{const duration=Number.isFinite(audio.duration)?audio.duration:0;seek.max=String(duration||1);seek.value=String(audio.currentTime);clock.textContent=`${time(audio.currentTime)} / ${time(duration)}`;seek.setAttribute('aria-valuetext',`${time(audio.currentTime)} of ${time(duration)}`);};
 const state=()=>{play.setAttribute('aria-label',`${audio.paused?'Play':'Pause'} ${name} example`);play.setAttribute('aria-pressed',String(!audio.paused));player.classList.toggle('playing',!audio.paused);};
 play.addEventListener('click',async()=>{if(!audio.paused){audio.pause();return;}players.forEach(p=>{if(p!==player)p.querySelector('audio').pause();});try{status.textContent='';await audio.play();}catch{status.textContent='Unable to play. Please try again.';}});
 mute.addEventListener('click',()=>{audio.muted=!audio.muted;mute.setAttribute('aria-label',`${audio.muted?'Unmute':'Mute'} ${name} example`);mute.setAttribute('aria-pressed',String(audio.muted));player.classList.toggle('muted',audio.muted);});
 seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value);update();});
 ['loadedmetadata','durationchange','timeupdate'].forEach(e=>audio.addEventListener(e,update));['play','pause','ended'].forEach(e=>audio.addEventListener(e,state));audio.addEventListener('error',()=>{status.textContent='This example is temporarily unavailable.';});update();state();
});
