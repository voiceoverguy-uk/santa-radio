import test from 'node:test';
import assert from 'node:assert/strict';
import {studioVideoTimeline, studioCaptionOpacity, studioTimelineArguments, studioAge} from '../src/lib/studioVideoTimeline.js';
const result={writtenName:'Harry',gift:{details:{age:'7 years old',talent:'Football',activity:'Teamwork',achievement:'Helping at home',treats:'mince pies',destination:'Yorkshire, England'}}};
test('paid captions use the saved selections and requested cue times',()=>{
 const lines=studioVideoTimeline(result);
 assert.deepEqual(lines.map(({id,start,end})=>({id,start,end})),[
 {id:'name',start:10,end:undefined},{id:'age',start:18,end:94},{id:'strengths',start:38,end:50},{id:'treat',start:57,end:61},{id:'destination',start:70,end:76},{id:'approved',start:85,end:94},{id:'christmas',start:94,end:undefined}]);
 assert.equal(lines[2].text,'Great at Football and Helping at home');
 assert.equal(lines[3].text,'Thank you for leaving out mince pies');
 assert.equal(lines[4].text,'Santa on the way to Yorkshire, England');
 assert.equal(studioVideoTimeline({gift:{details:{age:'6 months old',activity:'Teamwork',achievement:'Reading'}}})[2].text,'Great at Teamwork and Reading');
 assert.equal(studioAge({gift:{details:{age:'6 months old'}}}),'6 months');
});
test('lower lines never overlap and the name/age remain above the changing captions',()=>{
 const lines=studioVideoTimeline(result);
 assert.equal(studioCaptionOpacity(lines[0],9.9),0);assert.equal(studioCaptionOpacity(lines[0],11),1);
 for(let t=0;t<100;t+=.05)assert.ok(lines.slice(2).filter(c=>studioCaptionOpacity(c,t)>0).length<=1);
 assert.equal(studioCaptionOpacity(lines[1],17.9),0);assert.equal(studioCaptionOpacity(lines[1],19),1);assert.equal(studioCaptionOpacity(lines[1],90),1);
 for(const t of [50,51,56.9,61,62,69.9,76,84.9])assert.equal(lines.slice(2).filter(c=>studioCaptionOpacity(c,t)>0).length,0);
 assert.equal(studioCaptionOpacity(lines[5],86),1);
});
test('export bounds bitrate, preserves audio, and stops at recording duration',()=>{
 const args=studioTimelineArguments(studioVideoTimeline(result).map(c=>({...c,y:540})),90);
 assert.ok(args.includes('128k'));assert.ok(args.includes('350k'));assert.equal(args[args.indexOf('-t')+1],'90');
 const filter=args[args.indexOf('-filter_complex')+1];assert.match(filter,/fade=t=in:st=18/);assert.match(filter,/fade=t=out:st=49.25/);assert.match(filter,/overlay=0:540/);
});

test('treat and country captions follow each rendered clip, including longer choices', () => {
 for (const [treat, place] of [[45.25, 59.75], [68.125, 91.5]]) {
  const lines = studioVideoTimeline({...result, clipStarts: {treat, place}});
  const get = id => lines.find(line => line.id === id);
  assert.equal(get('treat').start, treat + 1);
  assert.equal(get('destination').start, place + 1);
  assert.equal(get('approved').start, place + 16);
  assert.equal(get('approved').end - get('approved').start, 9);
  for (let t = 0; t < 120; t += .05) assert.ok(lines.slice(2).filter(c => studioCaptionOpacity(c,t)>0).length <= 1);
 }
});

test('selected sport or funny choice, activity and achievement appear at their own clip ends', () => {
 for (const talent of ['Tennis', 'Stealing the remote control', '']) {
  for (const shift of [0, 20]) {
   const measured = {...result, gift: {details: {...result.gift.details, talent}},
    clipStarts: {treat: 56 + shift, place: 69 + shift},
    clipEnds: {talent: 28 + shift, activity: 36 + shift, achievement: 43 + shift}};
   const lines = studioVideoTimeline(measured);
   assert.equal(lines.find(c => c.id === 'activity').start, 36 + shift);
   assert.equal(lines.find(c => c.id === 'activity').text, talent ? 'And… trying hard at Teamwork' : 'Trying hard at Teamwork');
   assert.equal(lines.find(c => c.id === 'achievement').start, 43 + shift);
   assert.equal(lines.find(c => c.id === 'achievement').text, 'Helping at home');
   assert.equal(lines.some(c => c.id === 'talent'), Boolean(talent));
   if (talent) assert.equal(lines.find(c => c.id === 'talent').start, 28 + shift);
   for (let t = 0; t < 120; t += .05) assert.ok(lines.slice(2).filter(c => studioCaptionOpacity(c,t)>0).length <= 1);
  }
 }
});

test('Nice List follows the second name clip and lasts nine seconds before Merry Christmas', () => {
 for (const secondName of [74.25, 103.75]) {
  const lines = studioVideoTimeline({...result, clipStarts: {treat:50,place:70,secondName}});
  const approved = lines.find(c => c.id === 'approved');
  assert.equal(approved.start, secondName);
  assert.equal(approved.end, secondName + 9);
  assert.ok(lines.find(c => c.id === 'destination').end <= approved.start);
  const age = lines.find(c => c.id === 'age'), christmas = lines.find(c => c.id === 'christmas');
  assert.equal(age.end, approved.end);
  assert.equal(christmas.start, approved.end);
  assert.equal(studioCaptionOpacity(age, christmas.start), 0);
  assert.equal(studioCaptionOpacity(approved, christmas.start), 0);
  assert.equal(studioCaptionOpacity(christmas, christmas.start + 1), 1);
  assert.equal(studioCaptionOpacity(lines.find(c => c.id === 'name'), christmas.start + 1), 1);
 }
});
