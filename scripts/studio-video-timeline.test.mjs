import test from 'node:test';
import assert from 'node:assert/strict';
import {studioVideoTimeline, studioCaptionOpacity, studioTimelineArguments, studioAge} from '../src/lib/studioVideoTimeline.js';
const result={writtenName:'Harry',gift:{details:{age:'7 years old',talent:'Football',activity:'Teamwork',achievement:'Helping at home',treats:'mince pies',destination:'Yorkshire, England'}}};
test('paid captions use the saved selections and requested cue times',()=>{
 const lines=studioVideoTimeline(result);
 assert.deepEqual(lines.map(({id,start,end})=>({id,start,end})),[
 {id:'age',start:18,end:undefined},{id:'strengths',start:30,end:50},{id:'treat',start:50,end:61},{id:'destination',start:65,end:76},{id:'approved',start:80,end:undefined}]);
 assert.equal(lines[1].text,'Great at Football and Helping at home');
 assert.equal(lines[2].text,'Thank you for leaving out mince pies');
 assert.equal(lines[3].text,'Santa on the way to Yorkshire, England');
 assert.equal(studioVideoTimeline({gift:{details:{age:'6 months old',activity:'Teamwork',achievement:'Reading'}}})[1].text,'Great at Teamwork and Reading');
 assert.equal(studioAge({gift:{details:{age:'6 months old'}}}),'6 months');
});
test('lower lines never overlap and the name/age remain above the changing captions',()=>{
 const lines=studioVideoTimeline(result);
 for(let t=0;t<100;t+=.05)assert.ok(lines.slice(1).filter(c=>studioCaptionOpacity(c,t)>0).length<=1);
 assert.equal(studioCaptionOpacity(lines[0],17.9),0);assert.equal(studioCaptionOpacity(lines[0],19),1);assert.equal(studioCaptionOpacity(lines[0],90),1);
 for(const t of [61,62,64.9,76,79.9])assert.equal(lines.slice(1).filter(c=>studioCaptionOpacity(c,t)>0).length,0);
 assert.equal(studioCaptionOpacity(lines[4],81),1);
});
test('export bounds bitrate, preserves audio, and stops at recording duration',()=>{
 const args=studioTimelineArguments(studioVideoTimeline(result).map(c=>({...c,y:540})),90);
 assert.ok(args.includes('128k'));assert.ok(args.includes('350k'));assert.equal(args[args.indexOf('-t')+1],'90');
 const filter=args[args.indexOf('-filter_complex')+1];assert.match(filter,/fade=t=in:st=18/);assert.match(filter,/fade=t=out:st=49.25/);assert.match(filter,/overlay=0:540/);
});
