import test from 'node:test';
import assert from 'node:assert/strict';
import {startJump,advanceJump,nextItem,nextGap,RUN_SPEED} from '../src/lib/studioMiniDashPhysics.js';
function jump(hold, hz=60) { const body={height:0,velocity:0,held:true,time:1,tripUntil:0};startJump(body);let peak=0,landed=0;for(let i=0;i<hz*3;i++){body.held=i/hz<hold;advanceJump(body,1/hz);peak=Math.max(peak,body.height);if(i>0&&body.height===0){landed=i/hz;break;}}return {peak,landed}; }
test('holding jumps higher and farther than tapping; all jumps land',()=>{const tap=jump(.08),held=jump(2);assert(held.peak>tap.peak*1.8);assert(held.landed>tap.landed);assert(held.landed<1.2);assert(held.peak+68<240);assert(nextGap(()=>0)/RUN_SPEED>held.landed);});
test('jump height is consistent across frame rates',()=>{assert(Math.abs(jump(2,30).peak-jump(2,120).peak)<2);});
test('cannot double jump or jump while tripped',()=>{assert.equal(startJump({height:30,velocity:0,time:1,tripUntil:0}),false);assert.equal(startJump({height:0,velocity:0,time:1,tripUntil:500}),false);});
test('random choices cover every type and avoid repeating the same obstacle',()=>{const kinds=new Set(Array.from({length:100},(_,i)=>nextItem('pie',()=>i/100)));assert.deepEqual([...kinds].sort(),['gary','pie','snowman','tree']);for(const kind of ['tree','snowman','gary'])for(let i=0;i<100;i++)assert.notEqual(nextItem(kind,()=>i/100),kind);assert(nextGap(()=>0)<nextGap(()=>.99));});
