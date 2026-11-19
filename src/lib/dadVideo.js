import {drawStudioVideoFrames,studioTimelineArguments} from './studioVideoTimeline.js';
import {createSantaVideo} from './createSantaVideo.js';
export const DAD_ARTWORK=[{id:'armchair',label:'King of the remote',src:'/images/dad-armchair.png'},{id:'diy',label:'Some assembly required',src:'/images/dad-diy.png'},{id:'dinner',label:'The Christmas food coma',src:'/images/dad-dinner.png'},{id:'chef',label:'Chef’s special',src:'/images/dad-chef.png'},{id:'dancer',label:'Dad’s greatest hits',src:'/images/dad-dancer.png'}];
export function dadTimeline(result){
 const s=result.clipStarts,e=result.clipEnds;
 return [{id:'intro',text:'A message from Santa to ',start:0},
 {id:'name',text:result.writtenName,start:s.name},
 {id:'age',text:` aged ${result.age}`,start:s.age,end:s.secondName+8},
 {id:'habit',text:`Especially good at ${result.habit}`,start:e.habit,end:s.viewing},
 {id:'viewing',text:`Then it's ${result.viewing}`,start:e.viewing,end:s.treat},
 {id:'treat',text:`Thank you for leaving ${result.treat}`,start:s.treat+1,end:s.secondName-1},
 {id:'approved',text:'Nice List Approved… just!',start:s.secondName,end:s.secondName+8},
 {id:'christmas',text:'Merry Christmas!',start:s.secondName+8}];
}
function frames(image,result){return drawStudioVideoFrames(image,result,dadTimeline(result));}
export async function dadPoster(result){const image=new Image();image.src=result.artwork;await image.decode();const {base,layers}=frames(image,result);for(const layer of layers.filter(l=>['intro','name'].includes(l.id)))base.getContext('2d').drawImage(layer.canvas,0,layer.y);return base.toDataURL('image/png');}
export function createDadVideo(result,options){return createSantaVideo({...options,audio:result.audioBlob,name:result.writtenName,artwork:result.artwork,prepareFrames:async(image,duration)=>{
 const {base,layers}=frames(image,result),included=layers.filter(l=>l.start<duration&&(!l.end||l.end>l.start));
 const png=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not draw captions')),'image/png'));
 const files=[{name:'image.png',blob:await png(base)}];for(const layer of included)files.push({name:`${layer.id}.png`,blob:await png(layer.canvas)});
 return {files,args:studioTimelineArguments(included,duration)};
}});}
