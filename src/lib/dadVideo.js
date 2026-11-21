import {dadTreatWording} from './dadChoiceWording.js';
import {drawVideoCaption, studioTimelineArguments} from './studioVideoTimeline.js';
import {createSantaVideo} from './createSantaVideo.js';
export const DAD_ARTWORK=[{id:'armchair',label:'King of the remote',src:'/images/dad-armchair-framed-v2.png'},{id:'diy',label:'Assembly required',src:'/images/dad-diy-framed-v2.png'},{id:'dinner',label:'Christmas food coma',src:'/images/dad-dinner-framed-v2.png'},{id:'chef',label:'Chef’s special',src:'/images/dad-chef-framed-v2.png'},{id:'dancer',label:'Dad’s greatest hits',src:'/images/dad-dancer-framed-v2.png'},{id:'lights',label:'All tangled up',src:'/images/dad-lights-framed-v2.png'}];
export const dadVideoFilename = result => `dad-message-from-santa-to-${result.writtenName.trim().replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '').replace(/\s+/g, '-')}.mp4`;
export function dadViewingCaption(value){
 const summaries={
 'an auction programme where you guess what everything’s worth':'Auction programmes where you always guess the price',
 'a repeat of a quiz show where you remember all the answers':'Quiz repeats where you know every answer',
 'a panel of four blokes arguing about a penalty':'Four blokes arguing about a penalty',
 'a detective drama you’ve already seen twice':'Detective dramas you’ve already seen twice',
 'a gangster film you can quote word for word':'Gangster films you know word for word',
 'a video of somebody reversing a caravan':'Watching someone reverse a caravan',
 'a bloke on YouTube pressure-washing a patio':'Watching someone pressure-wash a patio',
 'the weather in a place you’re going to next month':'Next month’s holiday weather',
 'the exact same programme, but from the beginning':'The same programme, from the beginning',
 'an old penalty shoot-out you’re still annoyed about':'That penalty shoot-out you’re still annoyed about'
 };
 return `Your TV choices are questionable!\n${(summaries[value]||value.replace(/^./u,c=>c.toUpperCase())).replace(/[.!?]+$/u,'')}?`;
}
export function dadTreatCaption(value){
 const treat=dadTreatWording(value);
 if(/^a note saying, /i.test(treat))return `You left Santa a note:\n${treat.replace(/^a note saying, /i,'')}`;
 if(/^a note asking me to /i.test(treat))return `You left Santa a note\nasking him to ${treat.replace(/^a note asking me to /i,'')}`;
 return `Thanks for leaving Santa\n${treat}… NOT!`;
}
export function dadTimeline(result){
 const s=result.clipStarts;
 const christmasStart=(result.clipEnds?.secondName ?? s.secondName+1.2)+1.5;
 return [{id:'incoming',text:'Incoming message from Santa',start:0,end:5,blink:true},
 {id:'name',text:result.writtenName,start:s.name,end:s.age},
 {id:'age',text:`${result.writtenName}\nAged ${result.age}`,start:s.age,end:s.habit},
 {id:'habit',text:`You’re especially good at ${result.habit}`,start:s.habit,end:s.viewing},
 {id:'viewing',text:dadViewingCaption(result.viewing),start:s.viewing,end:s.treat},
 {id:'treat',text:dadTreatCaption(result.treat),start:s.treat,end:s.secondName-1},
 {id:'approved',text:'Nice List Approved… just!',start:s.secondName,end:christmasStart},
 {id:'christmas',text:'Merry Christmas!',start:christmasStart,end:christmasStart+4},
 {id:'christmas-extra',text:'Merry Christmas! and all that!',start:christmasStart+4}];
}
function frames(image,result){
 const width=1280,height=720;
 const canvas=(h)=>{const c=document.createElement('canvas');c.width=width;c.height=h;return c;};
 const base=canvas(height),ctx=base.getContext('2d');ctx.drawImage(image,0,0,width,height);
 // Name first appears in the caption panel, then moves above it for the jokes.
 const badge=canvas(86),badgeCtx=badge.getContext('2d');
 let titleSize=42;badgeCtx.font=`bold ${titleSize}px Georgia, serif`;
 while(badgeCtx.measureText(result.writtenName).width>700&&titleSize>24){titleSize--;badgeCtx.font=`bold ${titleSize}px Georgia, serif`;}
 const x=65,w=badgeCtx.measureText(result.writtenName).width+100;
 const green=badgeCtx.createLinearGradient(0,5,0,76);green.addColorStop(0,'#31523a');green.addColorStop(.5,'#123d29');green.addColorStop(1,'#071e16');
 badgeCtx.fillStyle=green;badgeCtx.beginPath();badgeCtx.roundRect(x,5,w,70,12);badgeCtx.fill();
 badgeCtx.strokeStyle='#d9b85f';badgeCtx.lineWidth=3;badgeCtx.stroke();
 badgeCtx.strokeStyle='#8f702d';badgeCtx.lineWidth=1;badgeCtx.strokeRect(x+10,14,w-20,52);
 // Holly leaves and berries frame the name without relying on emoji fonts.
 for(const cx of [x+22,x+w-22]){
  badgeCtx.fillStyle='#4a793c';
  for(const direction of [-1,1]){badgeCtx.beginPath();badgeCtx.ellipse(cx+direction*5,33,5,13,direction*.6,0,Math.PI*2);badgeCtx.fill();}
  badgeCtx.fillStyle='#b21b2c';for(const [dx,dy]of [[-4,43],[4,43],[0,49]]){badgeCtx.beginPath();badgeCtx.arc(cx+dx,dy,4,0,Math.PI*2);badgeCtx.fill();}
 }
 badgeCtx.fillStyle='#fff2c9';badgeCtx.textAlign='center';badgeCtx.textBaseline='middle';badgeCtx.shadowColor='#000';badgeCtx.shadowBlur=3;badgeCtx.fillText(result.writtenName,x+w/2,41);
 const recipientLayers=[{id:'name-badge',text:result.writtenName,start:result.clipStarts.habit,canvas:badge,y:430}];
 const layers=dadTimeline(result).map(caption=>drawVideoCaption(caption.id.startsWith('christmas')?{...caption,layoutText:'Merry Christmas! and all that!'}:caption,{maxLines:caption.id.startsWith('christmas')?1:2}));
 return {base,layers:[...recipientLayers,...layers]};
}
export async function dadPoster(result){
 const image=new Image();image.src=result.artwork;await image.decode();
 const base=frames(image,result).base;
 const name=String(result.writtenName||'Dad');
 const text=`Santa message for Dad (${name})${result.age ? `\nAged ${result.age}` : ''}`;
 const caption=drawVideoCaption({id:'poster-recipient',text,start:0});
 base.getContext('2d').drawImage(caption.canvas,0,caption.y);
 return base.toDataURL('image/png');
}
function createDadVideoVariant(result,options,shareCover=false){return createSantaVideo({...options,onStatus:message=>options?.onStatus?.(message.startsWith('Adding Santa’s voice')?'Hang on! So much to do! Nearly there...':message),audio:result.audioBlob,name:result.writtenName,artwork:result.artwork,prepareFrames:async(image,duration)=>{
 const {base,layers}=frames(image,result),included=layers.filter(l=>l.start<duration&&(!l.end||l.end>l.start));
 const png=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not draw captions')),'image/png'));
 const files=[{name:'image.png',blob:await png(base)}];for(const layer of included)files.push({name:`${layer.id}.png`,blob:await png(layer.canvas)});
 return {files,args:studioTimelineArguments(included,duration)};
}});}

export const createDadVideo=(result,options)=>createDadVideoVariant(result,options);
export const createDadShareVideo=(result,options)=>createDadVideoVariant(result,options,true);
