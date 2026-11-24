import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {parseInstallReport,summariseInstalls,createAndroidInstallReport} from '../server/android-install-statistics.js';
const csv='Date,Package Name,Country,Daily Device Installs,Daily Device Uninstalls\r\n2026-11-20,com.guy.santaradio,"United States",3,1\r\n2026-11-20,com.guy.santaradio,"Country, with comma",2,0\r\n';
test('UTF16 country rows aggregate once; malformed and duplicate data fail closed',()=>{
 const rows=parseInstallReport(Buffer.from('\uFEFF'+csv,'utf16le'),'com.guy.santaradio');assert.deepEqual(rows,[{day:'2026-11-20',installs:5,uninstalls:1}]);
 assert.throws(()=>parseInstallReport(Buffer.from(csv+csv.split('\r\n')[1]+'\n'),'com.guy.santaradio'));
 assert.throws(()=>parseInstallReport(Buffer.from(csv.replace(',3,1',',,1')),'com.guy.santaradio'));
 assert.throws(()=>parseInstallReport(Buffer.from(csv),'wrong.package'));
});
test('missing dates stay unavailable; rolling sums cross month boundaries',()=>{
 const rows=Array.from({length:30},(_,i)=>({day:new Date(Date.UTC(2026,10,20)-i*86400000).toISOString().slice(0,10),installs:2,uninstalls:1}));
 const full=summariseInstalls(rows,'2026-11-20');assert.equal(full.last30Days,60);assert.equal(full.last7Days,14);assert.equal(full.uninstalls30Days,30);
 const missing=summariseInstalls(rows.slice(0,29),'2026-11-20');assert.equal(missing.last30Days,null);assert.equal(missing.last7Days,14);
});
test('read-only API uses one dimension, caches and does not fabricate missing app installs',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 let calls=0;
 const report=createAndroidInstallReport({env:{GOOGLE_PLAY_REPORTS_BUCKET:'pubsite_prod_rev_123',GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'test@example.test',private_key:privateKey})},now:()=>new Date('2026-11-24T12:00:00Z'),fetcher:async(url,options)=>{
 calls++;if(url.includes('oauth2')) {const payload=JSON.parse(Buffer.from(options.body.get('assertion').split('.')[1],'base64url'));assert.equal(payload.scope,'https://www.googleapis.com/auth/devstorage.read_only');return Response.json({access_token:'fake'});}
 assert.match(url,/_country.csv/);assert.equal(options.headers.Authorization,'Bearer fake');
 return url.includes('installs_com.guy.santaradio_202611')?new Response(csv):new Response('',{status:404});
 }});
 const result=await report();assert.equal(result.apps.find(a=>a.id==='com.guy.santaradio').latest.installs,5);assert.equal(result.apps.find(a=>a.id==='uk.co.santaradio.santatracker').last30Days,null);assert.equal(calls,13);assert.equal(await report(),result);assert.equal(calls,13);
});
test('Android reports require existing owner authentication and fail without leaking provider errors',async()=>{
 const {createStatisticsHandler}=await import('../server/message-statistics.js');
 for(const allowed of [false,true]){
 let calls=0;const res={code:200,set(){return this;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};
 await createStatisticsHandler({allowed:()=>allowed,androidInstalls:async()=>{calls++;throw new Error('private-provider-response');}})({method:'GET',headers:{},query:{view:'android-installs'}},res);
 assert.equal(calls,allowed?1:0);assert.equal(res.code,allowed?503:401);assert.ok(!JSON.stringify(res.body).includes('private-provider-response'));
 }
});
