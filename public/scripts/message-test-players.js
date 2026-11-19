// Cue times belong to the current Charlotte v2 and Simon v1 demo exports.
const personalisationCues={Kids:[10,18,30.5,40,46,58,68.5,84.75],Dad:[7.69,20.75,43.5,64,78.75,102.25]};
const players=[...document.querySelectorAll('[data-demo-player]')];
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`;
players.forEach(player=>{
 const video=player.querySelector('video'),play=player.querySelector('[data-play]'),mute=player.querySelector('[data-mute]'),seek=player.querySelector('input'),knob=player.querySelector('.seek-knob'),clock=player.querySelector('[data-time]'),status=player.querySelector('[data-status]'),name=player.dataset.demoPlayer;
 const hint=player.querySelector('.personalisation-hint'),cues=personalisationCues[name]||[];
 const reveal=player.querySelector('.video-reveal'),expand=player.querySelector('.video-expand'),offer=player.closest('.offer');
 let frame=0,scrubbing=false,hideTimer;
 const setExpanded=value=>{offer.classList.toggle('expanded',value);expand.setAttribute('aria-expanded',String(value));expand.setAttribute('aria-label',`${value?'Reduce':'Enlarge'} ${name} video`);expand.textContent=value?'⤡':'⤢';};
 const show=()=>{clearTimeout(hideTimer);player.classList.add('video-visible');reveal.inert=false;reveal.setAttribute('aria-hidden','false');};
 const scheduleHide=()=>{clearTimeout(hideTimer);if(video.paused&&player.classList.contains('video-visible'))hideTimer=setTimeout(()=>{if(!video.paused)return;if(reveal.contains(document.activeElement))play.focus({preventScroll:true});setExpanded(false);player.classList.remove('video-visible');reveal.inert=true;reveal.setAttribute('aria-hidden','true');},10000);};
 ['pointerdown','keydown','input'].forEach(event=>player.addEventListener(event,scheduleHide));
 expand.addEventListener('click',()=>{setExpanded(!offer.classList.contains('expanded'));scheduleHide();});
 video.addEventListener('play',show);video.addEventListener('pause',scheduleHide);video.addEventListener('ended',scheduleHide);

 const paintHint=position=>{const start=cues.find(t=>position>=t&&position<t+3.5);const opacity=start===undefined?0:position-start<=3?1:1-(position-start-3)/.5;hint.style.opacity=String(Math.max(0,opacity));hint.setAttribute('aria-hidden',String(opacity===0));};
 mute.setAttribute('aria-label',`Mute ${name} example`);
 const duration=()=>Number.isFinite(video.duration)?video.duration:0;
 const paint=(position=video.currentTime)=>{paintHint(position);const total=duration();seek.disabled=!total;seek.max=String(total||1);if(!scrubbing)seek.value=String(position);knob.style.left=`${total?Math.max(0,Math.min(100,position/total*100)):0}%`;clock.textContent=`${time(position)} / ${time(total)}`;seek.setAttribute('aria-valuetext',`${time(position)} of ${time(total)}`);};
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
