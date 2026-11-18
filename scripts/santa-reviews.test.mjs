import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSantaReview } from '../src/lib/santaReviewValidation.js';
import { createReviewsHandler, emailReviewReward, reviewRewardEmail } from '../server/santa-reviews.js';
import { sealContact } from '../server/name-request-contact.js';
process.env.SESSION_SECRET='review-test-secret-only-not-production-123456789';
const valid={rating:1,body:'A useful review describing the experience in enough detail.',rewardEmail:true};
test('all ratings qualify and trimmed fifty-character boundary is enforced',()=>{
 for(let rating=1;rating<=5;rating++)assert.equal(validateSantaReview({...valid,rating}).rating,rating);
 assert.ok(validateSantaReview({...valid,body:' '.repeat(20)+'x'.repeat(49)+'  '}).error);
 assert.equal(validateSantaReview({...valid,body:'x'.repeat(50)}).body.length,50);
 for(const rating of [0,6,1.5,'5'])assert.ok(validateSantaReview({...valid,rating}).error);
 assert.ok(validateSantaReview({...valid,body:'x'.repeat(2001)}).error);
 assert.ok(validateSantaReview({...valid,consent:true}).error);
 assert.equal(validateSantaReview({...valid,rewardEmail:false}).rewardEmail,false);
});
function deliveryPool(){let state='not_sent';return{get state(){return state},query:async(sql,args)=>{if(sql.includes('NOT reward_email_requested'))return{rowCount:0,rows:[]};if(sql.includes('RETURNING contact')){if(!['not_sent','failed'].includes(state))return{rowCount:0,rows:[]};state='sending';return{rowCount:1,rows:[{contact:sealContact({email:'test@example.test'})}]};}state=args[1];return{rowCount:1,rows:[]};}};}
test('parallel approval and repeat clicks send only one reward',async()=>{const pool=deliveryPool();let sends=0;const fetcher=async()=>{sends++;return{ok:true}};await Promise.all([emailReviewReward('id',{pool,fetcher,apiKey:'test'}),emailReviewReward('id',{pool,fetcher,apiKey:'test'})]);await emailReviewReward('id',{pool,fetcher,apiKey:'test'});assert.equal(sends,1);assert.equal(pool.state,'sent');});
test('uncertain delivery is held rather than retried',async()=>{const pool=deliveryPool();let sends=0;const fetcher=async()=>{sends++;throw Error('timeout')};await emailReviewReward('id',{pool,fetcher,apiKey:'test'});await emailReviewReward('id',{pool,fetcher,apiKey:'test'});assert.equal(pool.state,'uncertain');assert.equal(sends,1);});
test('definitive rejection allows a deliberate retry',async()=>{const pool=deliveryPool();await emailReviewReward('id',{pool,fetcher:async()=>({ok:false,status:429}),apiKey:'test'});assert.equal(pool.state,'failed');await emailReviewReward('id',{pool,fetcher:async()=>({ok:true}),apiKey:'test'});assert.equal(pool.state,'sent');});
test('approval email explains Stripe code and unchanged reward for all ratings',()=>{const content=reviewRewardEmail();assert.match(content.text,/REVIEW20/);assert.match(content.text,/Stripe Checkout/);assert.match(content.text,/regardless of your star rating/);});
test('public API refuses owner actions and invalid reviews before saving',async()=>{
 let writes=0;const app=createReviewsHandler({owner:()=>false,contact:async()=>({identity:'test',email:'test@example.test'}),limit:async()=>{},receipt:()=> 'receipt',send:async()=>({ok:true}),pool:()=>({query:async()=>{writes++;return{rows:[{id:"test-id"}],rowCount:1}}})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await fetch(url+'?view=admin')).status,401);const headers={'Content-Type':'application/json',Origin:url};assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify({id:'a'.repeat(36),action:'approve'})})).status,401);assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({...valid,body:'short'})})).status,400);assert.equal(writes,0);assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://other.example'},body:JSON.stringify(valid)})).status,403);assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(valid)})).status,200);assert.equal(writes,1);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test("opted-out reviews approve without Brevo or an API key",async()=>{let sends=0;const result=await emailReviewReward("id",{pool:{query:async(sql)=>{assert.match(sql,/NOT reward_email_requested/);return{rowCount:1,rows:[{id:"id"}]}}},fetcher:async()=>{sends++;},apiKey:""});assert.equal(sends,0);assert.match(result.message,/No discount email requested/);});
test('featured cards rotate in groups of three and wrap without duplicates',async()=>{
 const reviews=Array.from({length:5},(_,i)=>({id:String(i),displayName:`Adult ${i}`,rating:4,body:'An approved review.'}));
 const app=createReviewsHandler({pool:()=>({query:async(sql,args=[])=>{
  assert.match(sql,/featured AND consent AND state='approved'/);
  if(sql.includes('count(*)'))return{rows:[{total:reviews.length}]};
  if(sql.includes('OFFSET'))return{rows:reviews.slice(args[0],args[0]+3)};
  return{rows:reviews.slice(0,args[0])};
 }})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const url=`http://127.0.0.1:${server.address().port}?view=featured`;
 const first=await(await fetch(url)).json();assert.deepEqual(first.reviews.map(r=>r.id),['0','1','2']);assert.equal(first.nextOffset,3);
 const next=await(await fetch(url+'&offset=3')).json();assert.deepEqual(next.reviews.map(r=>r.id),['3','4','0']);assert.equal(next.nextOffset,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('submission sends only requested rewards; publication approval never sends',async()=>{
 let sends=0;const queries=[];
 const app=createReviewsHandler({owner:()=>true,contact:async()=>({identity:'test',email:'test@example.test'}),limit:async()=>{},receipt:()=> 'receipt',send:async()=>{sends++;return{ok:true}},pool:()=>({query:async(sql,args)=>{queries.push({sql,args});return{rows:[{id:'11111111-1111-1111-1111-111111111111'}],rowCount:1}}})});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;const headers={'Content-Type':'application/json',Origin:url};
 try{
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(valid)})).status,200);assert.equal(sends,1);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({...valid,rewardEmail:false})})).status,200);assert.equal(sends,1);assert.equal(queries.at(-1).args[2],null);
  assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify({id:'11111111-1111-1111-1111-111111111111',action:'approve'})})).status,200);assert.equal(sends,1);assert.match(queries.at(-1).sql,/AND consent/);assert.match(queries.at(-1).sql,/featured=true/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('real session lookup preserves Express headers and refuses unverified visitors',async()=>{
 const app=createReviewsHandler({pool:()=>{throw Error('must not access database')}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}`);assert.equal(response.status,401);assert.match((await response.json()).error,/verify your adult email/);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
