import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
let fileDeletes=0,fileReads=0,grants=0,owner='user-A',expired=false;
const id='00000000-0000-4000-8000-000000000001';
const db={query:async(sql,args)=>{
 if(sql.includes('UPDATE santa_saved_messages'))return {rows:args[1]===owner?[{id}]:[]};
 if(sql.includes('SELECT m.*'))return {rows:args[1]===owner&&!expired?[{id,purchase_id:'paid-A',operation_id:id,assets:{audio:'private'}}]:[]};
 if(sql.includes('SELECT purchase_id'))return {rows:args[1]===owner&&args[0]==='paid-A'?[{purchase_id:'paid-A'}]:[]};
 throw new Error('Unexpected database query');
}};
mock.module('@clerk/express',{namedExports:{clerkMiddleware:()=> (req,res,next)=>next(),getAuth:()=>({userId:'user-A'})}});
mock.module('@clerk/backend',{namedExports:{createClerkClient:()=>({users:{getUser:async()=>({primaryEmailAddressId:'email',emailAddresses:[{id:'email',emailAddress:'owner@example.com',verification:{status:'verified'}}]})}})}});
mock.module('../server/contenders-database.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/name-request-store.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/studio-live-config.js',{namedExports:{liveStudioConfig:()=>({origin:'https://www.santaradio.co.uk'})}});
mock.module('../server/studio-live-store.js',{namedExports:{emailDigest:()=> 'digest',transaction:async(db,fn)=>fn(db)}});
mock.module('../server/studio-live-access.js',{namedExports:{livePaidPurchaseId:async()=> 'paid-A',livePaidSummary:async()=>({remaining:1}),issueLiveAccess:async()=>{grants++;return()=>{}}}});
mock.module('../server/message-account-store.js',{namedExports:{accountEnabled:()=>true,kinds:{audio:'audio/mpeg'},assetPath:()=> 'private/audio.mp3',committed:async()=>true,acceptAsset:async()=>{}}});
mock.module('@vercel/blob',{namedExports:{get:async()=>{fileReads++;return{statusCode:200,stream:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close()}})}},del:async()=>{fileDeletes++},issueSignedToken:async()=>{}}});
const {default:app}=await import('../server/message-account.js');
test('file retrieval and resume enforce purchase owner and expiry',async()=>{
 const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 const file=()=>fetch(`${base}?action=file&id=${id}&kind=audio`,{headers:{authorization:'Bearer test'}});
 const remove=(confirmed=true,origin='https://www.santaradio.co.uk')=>fetch(`${base}?action=delete`,{method:'POST',headers:{authorization:'Bearer test',origin,'content-type':'application/json'},body:JSON.stringify({id,confirmed})});
 const resume=()=>fetch(`${base}?action=resume`,{method:'POST',headers:{authorization:'Bearer test',origin:'https://www.santaradio.co.uk','content-type':'application/json'},body:JSON.stringify({purchaseId:'paid-A'})});
 try{
 owner='user-B';assert.equal((await remove()).status,404);assert.equal(fileDeletes,0);assert.equal((await file()).status,404);assert.equal(fileReads,0);assert.equal((await resume()).status,404);assert.equal(grants,0);
 owner='user-A';expired=true;assert.equal((await file()).status,404);assert.equal(fileReads,0);
 expired=false;const r=await file();assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);assert.equal(fileReads,1);
 assert.equal((await resume()).status,200);assert.equal(grants,1);
 assert.equal((await remove(false)).status,400);assert.equal((await remove(true,'https://untrusted.example')).status,403);assert.equal(fileDeletes,0);
 assert.equal((await remove()).status,200);assert.equal(fileDeletes,1);assert.equal(grants,1);
 }finally{await new Promise(r=>server.close(r))}
});
