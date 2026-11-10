import test from 'node:test';
import assert from 'node:assert/strict';
import { startLiveCheckout } from '../server/studio-live-checkout.js';
import { digest } from '../server/studio-live-store.js';
const claim = 'fixture-claim', hash = digest(claim);
const config = { origin: 'https://www.santaradio.co.uk', offer: 'fixture', priceId: 'price_fixture', productId: 'prod_fixture', publishableKey: 'pk_live_fixture' };
function fixture(existing) {
  const calls = [];
  const pool = {connect:async()=>({release(){},query:async(sql,args)=>{
    calls.push({sql,args});
    if(sql.includes('SELECT enabled')) return {rows:[{enabled:true}]};
    if(sql.includes('SELECT checkout_session_id')) return {rows:[{checkout_session_id:existing?.id,generation:0}]};
    return {rows:[]};
  }})};
  const stripe = {prices:{retrieve:async()=>({id:config.priceId,livemode:true,active:true,type:'one_time',currency:'gbp',unit_amount:650,
    product:{id:config.productId,livemode:true,active:true}})},checkout:{sessions:{retrieve:async()=>existing,create:async(params,options)=>{
      calls.push({params,options});return {id:'cs_live_fixture',livemode:true,metadata:params.metadata,ui_mode:params.ui_mode,client_secret:'cs_live_fixture_secret_fixture',url:params.ui_mode?null:'https://checkout.stripe.com/c/pay/fixture'};
    }}}};
  return {pool,stripe,calls};
}
test('embedded checkout pins the offer, uses secure return and never creates hosted redirect URLs',async()=>{
 const {pool,stripe,calls}=fixture();
 const result=await startLiveCheckout({claim,config,pool,stripe});
 assert.deepEqual(result,{sessionId:'cs_live_fixture',clientSecret:'cs_live_fixture_secret_fixture'});
 const {params,options}=calls.find(c=>c.params);
 assert.equal(params.ui_mode,'embedded');
 assert.equal(params.return_url,`${config.origin}/bespoke-personalised-message-from-santa?checkout=return`);
 assert.equal(params.success_url,undefined); assert.equal(params.cancel_url,undefined);
 assert.equal(params.allow_promotion_codes,true);
 assert.deepEqual(params.line_items,[{price:config.priceId,quantity:1}]);
 assert.equal(params.metadata.access_claim_sha256,hash);
 assert.equal(options.idempotencyKey,`studio-live:${hash}:0`);
});
test('refresh reuses an open embedded checkout without making another session',async()=>{
 const existing={id:'cs_live_existing',status:'open',livemode:true,metadata:{offer:config.offer,access_claim_sha256:hash},ui_mode:'embedded',client_secret:'cs_live_existing_secret_fixture'};
 const {pool,stripe,calls}=fixture(existing);
 const result=await startLiveCheckout({claim,config,pool,stripe});
 assert.equal(result.clientSecret,existing.client_secret);assert(!calls.some(c=>c.params));
});
test('completed checkout returns to server verification rather than collecting payment again',async()=>{
 const {pool,stripe,calls}=fixture({id:'cs_live_existing',status:'complete',livemode:true,metadata:{offer:config.offer,access_claim_sha256:hash}});
 assert.deepEqual(await startLiveCheckout({claim,config,pool,stripe}),{sessionId:'cs_live_existing',pending:true});
 assert(!calls.some(c=>c.params));
});
test('existing hosted checkout is resumed without expiring an in-flight payment',async()=>{
 const {pool,stripe,calls}=fixture({id:'cs_live_existing',status:'open',livemode:true,metadata:{offer:config.offer,access_claim_sha256:hash},url:'https://checkout.stripe.com/c/pay/existing'});
 assert.equal((await startLiveCheckout({claim,config,pool,stripe})).url,'https://checkout.stripe.com/c/pay/existing');
 assert(!calls.some(c=>c.params));
});
test('without a publishable key new checkout remains hosted',async()=>{
 const {pool,stripe,calls}=fixture();
 const result=await startLiveCheckout({claim,config:{...config,publishableKey:null},pool,stripe});
 assert(result.url.startsWith('https://checkout.stripe.com/'));
 const {params}=calls.find(c=>c.params);assert.equal(params.ui_mode,undefined);assert(params.success_url);assert(params.cancel_url);
});
