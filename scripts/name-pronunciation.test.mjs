import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalisePronunciationNote } from '../src/lib/santaNameRequests.js';
import { createNameRequestHandler } from '../server/name-requests.js';
import { saveNameRequest, listNameRequests, recordNameRequest } from '../server/name-request-store.js';
import { studioTestDatabase } from './helpers/studio-live-postgres.mjs';
test('pronunciation notes are optional and limited to 120 characters on the server',async()=>{
  assert.equal(normalisePronunciationNote(undefined),'');
  assert.equal(normalisePronunciationNote('  ZAH-ruh\n'),'ZAH-ruh');
  for(const value of ['x'.repeat(121),{},'bad\0note']) assert.equal(normalisePronunciationNote(value),null);
  let saved;
  const handler=createNameRequestHandler({limit:async()=>{},identify:()=>({visitorKey:'v',bucketKey:'b'}),
    contactFor:async()=>null,save:async value=>{saved=value;return{};}});
  const res=()=>({set(){return this;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}});
  const invalid=res();await handler({method:'POST',headers:{},body:{name:'Zara',pronunciation:'x'.repeat(121)}},invalid);
  assert.equal(invalid.statusCode,400);assert.equal(saved,undefined);
  const valid=res();await handler({method:'POST',headers:{},body:{name:'Zara',pronunciation:'ZAH-ruh'}},valid);
  assert.equal(valid.body.saved,true);assert.equal(saved.pronunciation,'ZAH-ruh');
});
test('notes persist through review, retries, recording and completed history',async()=>{
  let database,pool;
  if(process.env.PGLITE_TEST_MODULE){
    const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();
    pool={query:async(sql,args)=>{const r=args?await db.query(sql,args):await db.exec(sql);if(Array.isArray(r))return r;return{...r,rowCount:r.affectedRows??r.rows.length};},connect:async()=>({query:pool.query,release(){}})};
    database={close:()=>db.close()};
  } else {database=await studioTestDatabase({loadSchema:false});pool=database.pool;}
  try{
    await pool.query(await readFile(new URL('../database/santa-name-requests.sql',import.meta.url),'utf8'));
    const request={name:'Zara',key:'zara',pronunciation:'ZAH-ruh',submissionKey:'test-id'};
    assert.equal((await saveNameRequest(request,'visitor','bucket',new Date(),pool)).duplicate,false);
    assert.equal((await saveNameRequest(request,'visitor','bucket',new Date(),pool)).duplicate,true);
    const pending=(await listNameRequests(1,'','outstanding',false,pool)).requests[0];
    assert.deepEqual(pending.pronunciationNotes,['ZAH-ruh']);assert.equal(pending.count,1);
    await recordNameRequest('zara',new Date(),pool);
    const completed=(await listNameRequests(1,'','completed',false,pool)).requests[0];
    assert.deepEqual(completed.pronunciationNotes,['ZAH-ruh']);
  } finally{await database.close();}
});
