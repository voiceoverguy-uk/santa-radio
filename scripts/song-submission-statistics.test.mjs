import test from 'node:test';
import assert from 'node:assert/strict';
import {songSubmissionStatistics} from '../server/song-submission-statistics.js';
import {createStatisticsHandler} from '../server/message-statistics.js';
const response=()=>({code:200,headers:{},set(k,v){this.headers[k]=v;return this},status(s){this.code=s;return this},json(v){this.body=v;return this}});
test('songs require owner access before provider reads',async()=>{
 let calls=0;const res=response();
 await createStatisticsHandler({allowed:()=>false,songs:async()=>{calls++}})({method:'GET',query:{view:'songs'},headers:{}},res);
 assert.equal(res.code,401);assert.equal(calls,0);assert.equal(res.headers['Cache-Control'],'private, no-store');
});
test('songs use a separate paginated request without loading other reports',async()=>{
 let offset;const res=response();
 await createStatisticsHandler({allowed:()=>true,songs:async options=>{offset=options.offset;return {count:0,contacts:[],nextOffset:null}},report:()=>{throw Error('unrelated')}})({method:'GET',query:{view:'songs',offset:'50'},headers:{}},res);
 assert.equal(offset,50);assert.equal(res.code,200);assert.deepEqual(res.body.contacts,[]);
});
test('bad offsets cannot reach the provider',async()=>{
 for(const offset of ['-1','abc','1&limit=500',[], '10000000']) {
 const res=response();await createStatisticsHandler({allowed:()=>true,songs:async()=>{throw Error('must not call')}})({method:'GET',query:{view:'songs',offset},headers:{}},res);
 assert.equal(res.code,400);
 }
});
test('maps verified list fields and omits contact email and unrelated attributes',async()=>{
 const result=await songSubmissionStatistics({env:{BREVO_API_KEY:'test-only'},offset:50,fetchImpl:async(url,options)=>{
 assert.match(url,/lists\/10\/contacts\?limit=50&offset=50&sort=desc$/);assert.equal(options.headers['api-key'],'test-only');
 return {ok:true,json:async()=>({count:52,contacts:[{id:1,email:'private@example.com',attributes:{FIRSTNAME:'A',LASTNAME:'Singer',SONG_REQUEST:'My song',SMS:'private'},createdAt:'date',modifiedAt:'date'}]})};
 }});
 assert.deepEqual(result,{count:52,offset:50,nextOffset:51,contacts:[{id:1,name:'A Singer',message:'My song',createdAt:'date',modifiedAt:'date'}]});
});
test('empty list is distinct from denied access and malformed responses',async()=>{
 assert.deepEqual(await songSubmissionStatistics({env:{}}),{error:'not_configured'});
 for(const status of [401,403,429,503]) {
 const result=await songSubmissionStatistics({env:{BREVO_API_KEY:'test'},fetchImpl:async()=>({ok:false,status})});assert.ok(result.error);
 }
 const run=body=>songSubmissionStatistics({env:{BREVO_API_KEY:'test'},fetchImpl:async()=>({ok:true,json:async()=>body})});
 assert.deepEqual(await run({count:0,contacts:[]}),{count:0,offset:0,nextOffset:null,contacts:[]});
 assert.deepEqual(await run({count:1,contacts:[{id:'invalid'}]}),{error:'invalid_response'});
 assert.deepEqual(await run({contacts:[]}),{error:'invalid_response'});
});
