import test from 'node:test';
import assert from 'node:assert/strict';
import { createLittleHelpersHandler } from '../api/little-helpers.js';
import { clipPath, changeClip, TRASH_HOURS } from '../server/little-helpers.js';
const id='12345678-1234-4234-8234-123456789abc';
test('only scoped clip paths are accepted',()=>{
 assert.equal(TRASH_HOURS,48);
 assert.ok(clipPath(`little-helpers/test/${id}.m4a`));
 for(const path of ['names/example.mp3','https://evil.example/audio',`little-helpers/test/../${id}.m4a`,`little-helpers/test/${id}.json`])assert.equal(clipPath(path),false);
});
test('invalid mutations never reach storage; restore is bounded by 48 hours',async()=>{
 const calls=[];const pool={query:async(...args)=>{calls.push(args);return {rowCount:1};}};
 await assert.rejects(changeClip({action:'erase-all'},pool));assert.equal(calls.length,0);
 await assert.rejects(changeClip({action:'expiry',enabled:true},pool));assert.equal(calls.length,0);
 await changeClip({action:'restore',id},pool);assert.match(calls[0][0],/48 hours/);assert.match(calls[0][0],/kept=true/);
 await changeClip({action:'unkeep',id},pool);assert.match(calls[1][0],/kept=false/);
 await changeClip({action:'expiry',enabled:'false'},pool);assert.equal(calls[2][1][0],false);
});
test('API requires owner auth, rejects cross-site mutation and streams audio privately',async()=>{
 process.env.STUDIO_OWNER_TOKEN='x'.repeat(48);
 let changed=0;
 const app=createLittleHelpersHandler({sync:async()=>{},maintain:async()=>{},report:async()=>({clips:[],automaticExpiry:false}),change:async()=>{changed++;},audio:async(id)=>id==='missing'?null:{pathname:`little-helpers/test/${id}.m4a`,stream:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close();}})}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const headers={Authorization:'Bearer studio-owner.'+'x'.repeat(48),'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(base)).status,401);
  assert.equal((await fetch(base,{method:'PATCH',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);assert.equal(changed,0);
  assert.equal((await fetch(base,{method:'DELETE',headers})).status,405);
  const result=await fetch(base,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal((await result.json()).automaticExpiry,false);
  assert.equal((await fetch(base,{method:'PATCH',headers:{...headers,Origin:'https://www.santaradio.co.uk'},body:JSON.stringify({action:'trash',id})})).status,200);assert.equal(changed,1);
  const clip=await fetch(base+'?audio='+id,{headers});assert.equal(clip.status,200);assert.equal(clip.headers.get('content-type'),'audio/mp4');assert.deepEqual([...new Uint8Array(await clip.arrayBuffer())],[1,2,3]);
  assert.equal((await fetch(base+'?audio=missing',{headers})).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));delete process.env.STUDIO_OWNER_TOKEN;}
});
