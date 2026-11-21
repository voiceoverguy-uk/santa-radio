import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
let owned=true,completed=true,linked=true,inserts=0;
const operation='00000000-0000-4000-8000-000000000001';
const db={query:async(sql,args)=>{
 if(sql.includes('FROM santa_dad_live_purchases'))return {rowCount:owned?1:0};
 if(sql.includes('SELECT 1 FROM santa_message_accounts'))return {rowCount:linked?1:0};
 if(sql.startsWith('INSERT INTO santa_saved_messages')){inserts++;return{rows:[{id:operation,purchase_id:'dad-purchase',expires_at:'2027-02-01'}]};}
 return {rows:[],rowCount:1};
}};
mock.module('@clerk/express',{namedExports:{clerkMiddleware:()=> (req,res,next)=>next(),getAuth:()=>({userId:'user-A'})}});
mock.module('@clerk/backend',{namedExports:{createClerkClient:()=>({users:{getUser:async()=>({primaryEmailAddressId:'email',emailAddresses:[{id:'email',emailAddress:'owner@example.com',verification:{status:'verified'}}]})}})}});
mock.module('../server/contenders-database.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/name-request-store.js',{namedExports:{databasePool:()=>db}});
mock.module('../server/studio-live-config.js',{namedExports:{liveStudioConfig:()=>({origin:'https://www.santaradio.co.uk'})}});
mock.module('../server/studio-live-store.js',{namedExports:{emailDigest:()=> 'digest',transaction:async(db,fn)=>fn(db)}});
mock.module('../server/dad-live-config.js',{namedExports:{liveStudioConfig:()=>({secret:'test'})}});
mock.module('../server/dad-live-store.js',{namedExports:{emailDigest:()=> 'digest'}});
mock.module('../server/dad-live-access.js',{namedExports:{livePaidPurchaseId:async()=> 'dad-purchase',livePaidSummary:async()=>({remaining:0}),issueLiveAccess:async()=>()=>{}}});
mock.module('../server/studio-live-access.js',{namedExports:{livePaidPurchaseId:async()=>false,livePaidSummary:async()=>({remaining:0}),issueLiveAccess:async()=>()=>{}}});
mock.module('../server/message-account-store.js',{namedExports:{expiryFor:()=>new Date('2027-02-01'),accountEnabled:()=>true,kinds:{video:'video/mp4'},assetPath:()=> 'private/video.mp4',committed:async()=>completed,acceptAsset:async()=>{}}});
const {default:app}=await import('../server/message-account.js');
test('Dad saving requires signed-in purchase owner and completed operation; does not reset retention',async()=>{
 const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/?action=dad-save`;
 const save=(body={operation,name:'Simon'},auth=true)=>fetch(base,{method:'POST',headers:{...(auth?{authorization:'Bearer test'}:{}),origin:'https://www.santaradio.co.uk','content-type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await save(undefined,false)).status,401);
  owned=false;assert.equal((await save()).status,403);assert.equal(inserts,0);
  owned=true;completed=false;assert.equal((await save()).status,403);assert.equal(inserts,0);
  completed=true;linked=false;assert.equal((await save()).status,503);assert.equal(inserts,0);
  linked=true;assert.equal((await save({operation:'bad',name:'Simon'})).status,400);
  const result=await save();assert.equal(result.status,200);assert.deepEqual(await result.json(),{id:operation,expiresAt:'2027-02-01'});assert.equal(inserts,1);
 }finally{await new Promise(r=>server.close(r));}
});
