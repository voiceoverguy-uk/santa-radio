import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recordCreation,recordDownload,receiptToken,verifyReceipt,statisticsReport} from '../server/message-statistics-store.js';
import {createStatisticsHandler} from '../server/message-statistics.js';
process.env.SESSION_SECRET='test-only-statistics-secret-abcdefghijklmnopqrstuvwxyz';
test('signed receipts reject tampering and expiry',()=>{
 const id='11111111-1111-4111-8111-111111111111',now=Date.now(),token=receiptToken(id,now);
 assert.equal(verifyReceipt(token,now),id);assert.equal(verifyReceipt(token+'x',now),null);
 assert.equal(verifyReceipt(token,now+8*86400000),null);
});
test('dashboard rejects unauthenticated access before reading data',async()=>{
 let read=false;const response={set(){return this},status(s){this.code=s;return this},json(v){this.body=v;return this}};
 await createStatisticsHandler({allowed:()=>false,report:()=>{read=true}})({method:'GET',headers:{}},response);
 assert.equal(response.code,401);assert.equal(read,false);
});
test('daily counts use UK dates, downloads deduplicate and reports contain only aggregates',{skip:!process.env.PGLITE_TEST_MODULE},async()=>{
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();
 const pool={query:async(sql,args)=>{const r=await db.query(sql,args);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length}}};
 await db.exec(await readFile(new URL('../database/christmas-contenders.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../database/message-statistics.sql',import.meta.url),'utf8'));
 const instant=new Date('2026-07-01T23:30:00Z');const token=await recordCreation('Freya',pool,instant);const id=verifyReceipt(token,instant.getTime());
 assert.ok(id);await recordDownload(id,pool,new Date('2026-07-02T01:00:00Z'));await recordDownload(id,pool,new Date('2026-07-02T01:01:00Z'));
 const rows=(await db.query('SELECT day::text,creations::integer,download_clicks::integer FROM santa_message_daily')).rows;
 assert.deepEqual(rows,[{day:'2026-07-02',creations:1,download_clicks:1}]);
 const report=await statisticsReport(pool);assert.equal(report.allTime.creations,1);assert.equal(report.allTime.downloads,1);assert.equal(report.since,"2026-07-02");assert.ok(Array.isArray(report.votes));assert.equal('email' in report,false);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM santa_message_receipts')).rows[0].n,0);
 await db.close();
});

test('native completion uses the authenticated existing route and normalizes the requested name',async()=>{
 let completed;const response={set(){return this},status(s){this.code=s;return this},json(v){this.body=v;return this}};
 const req={method:'PATCH',headers:{origin:'https://www.santaradio.co.uk',host:'www.santaradio.co.uk'},body:{action:'recorded',name:'Elodie'}};
 await createStatisticsHandler({allowed:()=>true,complete:async key=>{completed=key}})(req,response);
 assert.equal(completed,'elodie');assert.deepEqual(response.body,{ok:true});
});
test('completion rejects unauthorized and cross-site requests before mutating names',async()=>{
 for(const [allowed,site,expected] of [[false,'same-origin',401],[true,'cross-site',403]]) {
 let changed=false;const response={set(){return this},status(s){this.code=s;return this},json(v){this.body=v;return this}};
 await createStatisticsHandler({allowed:()=>allowed,complete:async()=>{changed=true}})({method:'PATCH',headers:{origin:'https://www.santaradio.co.uk',host:'www.santaradio.co.uk','sec-fetch-site':site},body:{action:'recorded',name:'Elodie'}},response);
 assert.equal(response.code,expected);assert.equal(changed,false);
 }
});

test('engagement actions count independently and duplicate retries count once', {skip:!process.env.PGLITE_TEST_MODULE}, async()=>{
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();
 const {recordEngagement}=await import('../server/message-statistics-store.js');
 const pool={query:async(sql,args)=>{const r=await db.query(sql,args);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length}}};
 try {
 await db.exec(await readFile(new URL('../database/message-statistics.sql',import.meta.url),'utf8'));
 const now=new Date(); const id=verifyReceipt(await recordCreation('Test',pool,now),now.getTime());
 for(const action of ['listen','download','mp4-download','share']) {
   assert.equal(await recordEngagement(id,action,pool,now),true);
   assert.equal(await recordEngagement(id,action,pool,now),false);
 }
 assert.deepEqual((await db.query('SELECT listens::int,shares::int,download_clicks::int,mp4_download_clicks::int FROM santa_message_daily')).rows,[{listens:1,shares:1,download_clicks:1,mp4_download_clicks:1}]);
 await assert.rejects(recordEngagement(id,'bogus',pool,now));
 } finally {await db.close();}
});

 test('MP4 download route accepts a signed receipt and rejects invalid receipts', async()=>{
   const token=receiptToken('11111111-1111-4111-8111-111111111111');
   for(const [receipt,expected] of [[token,200],['invalid',400]]) {
     let recorded; const response={code:200,set(){return this},status(s){this.code=s;return this},json(v){this.body=v;return this}};
     await createStatisticsHandler({engagement:async(id,action)=>{recorded=action}})({method:'POST',headers:{origin:'https://www.santaradio.co.uk',host:'www.santaradio.co.uk'},body:{receipt,action:'mp4-download'}},response);
     assert.equal(response.code,expected); assert.equal(recorded,expected===200?'mp4-download':undefined);
   }
 });
