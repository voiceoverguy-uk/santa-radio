import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteEmailStatistics } from '../server/website-email-statistics.js';
test('website email totals combine acknowledged sends only',async()=>{
 const queries=[];
 const result=await websiteEmailStatistics({pool:()=>({query:async sql=>{queries.push(sql);return {rows:[{count:sql.includes('studio_live_email')?7:3}]}}})});
 assert.deepEqual(result,{days:30,studioAccess:7,nameUpdates:3,total:10});
 assert.ok(queries.every(q=>q.includes("sent_at >= now()-interval '30 days'")));
 assert.match(queries[1],/state='sent'/);
});
test('failed source is unavailable rather than zero or a misleading total',async()=>{
 const result=await websiteEmailStatistics({pool:()=>({query:async sql=>{if(sql.includes('studio_live_email'))throw Error('unavailable');return {rows:[{count:0}]}}})});
 assert.deepEqual(result,{days:30,studioAccess:null,nameUpdates:0,total:null});
});
