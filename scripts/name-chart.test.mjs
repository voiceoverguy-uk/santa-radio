import test from 'node:test';
import assert from 'node:assert/strict';
import { createNameChartHandler, readNameChart, CHART_TTL } from '../server/name-chart.js';
function response() { return { headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body ? JSON.parse(body) : null;} }; }
test('all-time downloads only, normalized names and minimal public response', async () => {
 let sql; const names=await readNameChart({query:async q=>{sql=q;return {rows:[{name:'mary-jane',downloads:2}]};}});
 assert.match(sql,/sum\(download_clicks\)/);assert.match(sql,/GROUP BY lower\(trim\(name\)\)/);assert.match(sql,/downloads DESC/);assert.match(sql,/LIMIT 25/);assert.doesNotMatch(sql,/day >=/);assert.deepEqual(names,[{rank:1,name:'Mary-Jane'}]);
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
