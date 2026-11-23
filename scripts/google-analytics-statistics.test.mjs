import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createVisitorReport } from '../server/google-analytics-statistics.js';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength:2048, privateKeyEncoding:{ type:'pkcs8', format:'pem' }, publicKeyEncoding:{ type:'spki',format:'pem' } });
const env={ GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'test@example.com',private_key:privateKey}) };
test('fills missing dates, filters site hosts and caches concurrent reports',async()=>{
 let calls=0, body;
 const get=createVisitorReport({env,now:()=>Date.parse('2026-11-23T01:00:00Z'),fetcher:async(url,opts)=>{
 calls++;
 if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'test'})};
 body=JSON.parse(opts.body);return {ok:true,json:async()=>({metadata:{timeZone:'America/Los_Angeles'},rows:[{dimensionValues:[{value:'20261121'}],metricValues:[{value:'123'},{value:'456'}]}]})};
 }});
 const [a,b]=await Promise.all([get(),get()]);assert.equal(a,b);assert.equal(calls,5);assert.equal(a.days.length,30);assert.equal(a.days.at(-1).date,'2026-11-21');assert.equal(a.days.at(-1).visitors,123);assert.equal(a.days[0].visitors,0);assert.equal(await get(),a);assert.equal(calls,5);
 assert.deepEqual(body.dimensionFilter.filter.inListFilter.values,['santaradio.co.uk','www.santaradio.co.uk']);
 assert.equal(body.dateRanges[0].endDate,'2026-11-21');assert.equal(JSON.stringify(a).includes('private_key'),false);
});
test('does not turn API failure into zero visitors or cache failure',async()=>{
 let calls=0; const get=createVisitorReport({env,fetcher:async()=>{calls++;return {ok:false};}});
 await assert.rejects(get(),/authentication/);await assert.rejects(get(),/authentication/);assert.equal(calls,2);
});
test('missing credentials do not make a request',async()=>{
 const get=createVisitorReport({env:{},fetcher:()=>assert.fail('unexpected fetch')});await assert.rejects(get(),/not configured/);
});
test('keeps the daily chart when a breakdown fails and maps successful reports',async()=>{
 const get=createVisitorReport({env,fetcher:async(url,opts)=>{
   if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'test'})};
   const query=JSON.parse(opts.body),dimension=query.dimensions[0].name;
   if(dimension==='sessionDefaultChannelGroup')return {ok:false};
   if(dimension==='date')return {ok:true,json:async()=>({rows:[]})};
   return {ok:true,json:async()=>({rows:[{dimensionValues:[{value:dimension==='country'?'United Kingdom':'/'}],metricValues:[{value:'42'}]}]})};
 }});
 const result=await get();assert.equal(result.days.length,30);assert.equal(result.breakdowns.sources,null);assert.deepEqual(result.breakdowns.countries,[{label:'United Kingdom',value:42}]);assert.deepEqual(result.breakdowns.pages,[{label:'/',value:42}]);
});
