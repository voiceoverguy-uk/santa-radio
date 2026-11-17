import test from 'node:test';
import assert from 'node:assert/strict';
import { createNameChartHandler, readNameChart, CHART_TTL } from '../server/name-chart.js';
function response() { return { headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body ? JSON.parse(body) : null;} }; }
test('ranks recordings over matching current and previous 30-day windows', async () => {
 let sql; const names=await readNameChart({query:async q=>{sql=q;return {rows:[{name:'olivia',rank:'1',previous_rank:'3',comparison_available:true}]};}});
 assert.match(sql,/sum\(creations\)/);assert.match(sql,/day >= today-29/);assert.match(sql,/day >= today-36 AND day <= today-7/);assert.doesNotMatch(sql,/download_clicks/);
 assert.deepEqual(names,[{rank:1,name:'Olivia',previousRank:3,change:2,movement:'up'}]);
});
test('movement distinguishes up, down, unchanged, new and insufficient history', async () => {
 const rows=[
  {name:'up',rank:1,previous_rank:27,comparison_available:true},
  {name:'down',rank:2,previous_rank:1,comparison_available:true},
  {name:'same',rank:3,previous_rank:3,comparison_available:true},
  {name:'new',rank:4,previous_rank:null,comparison_available:true},
  {name:'pending',rank:5,previous_rank:null,comparison_available:false},
 ];
 const result=await readNameChart({query:async()=>({rows})});
 assert.deepEqual(result.map(({movement,change})=>[movement,change]),[['up',26],['down',-1],['same',0],['new',null],['pending',null]]);
});
test('twelve-hour cache, concurrent requests and expiry', async () => {
 let now=0,calls=0;const handler=createNameChartHandler({clock:()=>now,read:async()=>{calls++;return [];}});
 await Promise.all([handler({method:'GET'},response()),handler({method:'GET'},response())]);assert.equal(calls,1);
 now=CHART_TTL-1000;const res=response();await handler({method:'GET'},res);assert.equal(calls,1);assert.match(res.headers['Cache-Control'],/s-maxage=1,/);
 now=CHART_TTL;await handler({method:'GET'},response());assert.equal(calls,2);
});
test('failed reads are uncached, retryable and hide internal errors; mutations rejected', async () => {
 let calls=0;const handler=createNameChartHandler({read:async()=>{if(!calls++)throw Error('secret database detail');return [];}});
 const res=response();await handler({method:'GET'},res);assert.equal(res.statusCode,503);assert.equal(res.headers['Cache-Control'],'no-store');assert.doesNotMatch(JSON.stringify(res.body),/secret/);
 const next=response();await handler({method:'GET'},next);assert.deepEqual(next.body.names,[]);
 const post=response();await handler({method:'POST'},post);assert.equal(post.statusCode,405);assert.equal(calls,2);
});
