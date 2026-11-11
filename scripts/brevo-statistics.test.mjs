import test from 'node:test';
import assert from 'node:assert/strict';
import { brevoStatistics } from '../server/brevo-statistics.js';
const run = body => brevoStatistics({env:{BREVO_API_KEY:'fixture'},fetchImpl:async()=>({ok:true,json:async()=>body})});
test('partial Brevo aggregates preserve known figures and do not invent missing counts',async()=>{
 assert.deepEqual(await run({range:'2026-10-13|2026-11-11',requests:12,delivered:10}),{range:'2026-10-13|2026-11-11',requests:12,delivered:10,hardBounces:null,softBounces:null,blocked:null,spamReports:null});
});
test('provider failures and malformed reports remain explicit',async()=>{
 assert.deepEqual(await brevoStatistics({env:{}}),{error:'not_configured'});
 assert.deepEqual(await run({error:'bad'}),{error:'invalid_response'});
 assert.deepEqual(await run({range:'dates',requests:-1}),{error:'invalid_response'});
 for(const [status,error] of [[401,'access_denied'],[403,'access_denied'],[429,'rate_limited'],[503,'service_unavailable']]) {
 assert.deepEqual(await brevoStatistics({env:{BREVO_API_KEY:'fixture'},fetchImpl:async()=>({ok:false,status})}),{error});
 }
});
