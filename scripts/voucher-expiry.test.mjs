import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleExpiry } from '../src/lib/scheduleExpiry.js';
test('a 30-day voucher remains open until its actual expiry', () => {
 let now=0, next, delay, expired=0;
 const cancel=scheduleExpiry(30*86400000,()=>expired++,{now:()=>now,setTimer:(fn,ms)=>{next=fn;delay=ms;return 1},clearTimer:()=>{}});
 assert.equal(delay,2147483647);assert.equal(expired,0);
 now+=delay;next();assert.equal(expired,0);assert.equal(delay,30*86400000-now);
 now+=delay;next();assert.equal(expired,1);cancel();
});
test('short expiry and cancellation preserve normal behavior',()=>{
 let now=0,next,expired=0,cleared;
 const cancel=scheduleExpiry(100,()=>expired++,{now:()=>now,setTimer:(fn,ms)=>{next=fn;assert.equal(ms,100);return 2},clearTimer:id=>{cleared=id}});
 cancel();now=101;next();assert.equal(expired,0);assert.equal(cleared,2);
 scheduleExpiry(100,()=>expired++,{now:()=>now});assert.equal(expired,1);
});
