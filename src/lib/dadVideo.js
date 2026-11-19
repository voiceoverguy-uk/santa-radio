import {drawStudioVideoFrames,studioTimelineArguments} from './studioVideoTimeline.js';
import {createSantaVideo} from './createSantaVideo.js';
export const DAD_ARTWORK=[{id:'armchair',label:'King of the remote',src:'/images/dad-armchair-framed-v1.png'},{id:'diy',label:'Some assembly required',src:'/images/dad-diy-framed-v1.png'},{id:'dinner',label:'The Christmas food coma',src:'/images/dad-dinner-framed-v1.png'},{id:'chef',label:'Chef’s special',src:'/images/dad-chef-framed-v1.png'},{id:'dancer',label:'Dad’s greatest hits',src:'/images/dad-dancer-framed-v1.png'}];
export const dadVideoFilename = result => `dad-message-from-santa-to-${result.writtenName.trim().replace(/[\x00-\x1f\x7f/\\:*?"<>|]/g, '').replace(/\s+/g, '-')}.mp4`;
export function dadTimeline(result){
 const s=result.clipStarts,e=result.clipEnds;
 return [{id:'intro',text:'Santa message for ',start:0},
 {id:'name',text:result.writtenName,start:0},
 {id:'age',text:` aged ${result.age}`,start:s.age,end:s.secondName+8},
 {id:'habit',text:`Especially good at ${result.habit}`,start:e.habit,end:s.viewing},
 {id:'viewing',text:`Then it's ${result.viewing}`,start:e.viewing,end:s.treat},
 {id:'treat',text:`Thank you for leaving ${result.treat}`,start:s.treat+1,end:s.secondName-1},
 {id:'approved',text:'Nice List Approved… just!',start:s.secondName,end:s.secondName+8},
 {id:'christmas',text:'Merry Christmas!',start:s.secondName+8}];
}
function frames(image,result){
 const {base,layers}=drawStudioVideoFrames(image,result,dadTimeline(result));
 // Burn the recipient into every frame: sharing apps usually use the first
 // video frame, and do not receive the separate browser poster image.
 for(const layer of layers.filter(l=>['intro','name'].includes(l.id)))base.getContext('2d').drawImage(layer.canvas,0,layer.y);
 return {base,layers:layers.filter(l=>!['intro','name'].includes(l.id))};
}
export async function dadPoster(result){const image=new Image();image.src=result.artwork;await image.decode();const {base,layers}=frames(image,result);for(const layer of layers.filter(l=>['intro','name'].includes(l.id)))base.getContext('2d').drawImage(layer.canvas,0,layer.y);return base.toDataURL('image/png');}
export function createDadVideo(result,options){return createSantaVideo({...options,onStatus:message=>options?.onStatus?.(message.startsWith('Adding Santa’s voice')?'Hang on! So much to do! Nearly there...':message),audio:result.audioBlob,name:result.writtenName,artwork:result.artwork,prepareFrames:async(image,duration)=>{
 const {base,layers}=frames(image,result),included=layers.filter(l=>l.start<duration&&(!l.end||l.end>l.start));
 const png=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not draw captions')),'image/png'));
 const files=[{name:'image.png',blob:await png(base)}];for(const layer of included)files.push({name:`${layer.id}.png`,blob:await png(layer.canvas)});
 return {files,args:studioTimelineArguments(included,duration)};
}});}
