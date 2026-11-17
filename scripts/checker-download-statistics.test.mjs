import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatisticsHandler } from '../server/message-statistics.js';
import { trackCheckerDownload } from '../src/lib/checkerDownloadStatistics.js';
const eventId = '11111111-1111-4111-8111-111111111111';
const headers = { origin:'https://www.santaradio.co.uk',host:'www.santaradio.co.uk' };
const response = () => ({code:200,set(){return this},status(code){this.code=code;return this},json(body){this.body=body;return this}});
test('download endpoint accepts anonymous event only after rate limit', async()=>{
  const calls=[]; const res=response();
  await createStatisticsHandler({checkerLimit:async(_req,scope)=>calls.push(scope),checkerDownload:async id=>calls.push(id)})
    ({method:'POST',headers,body:{action:'checker-pdf-download',eventId}},res);
  assert.equal(res.code,200);assert.deepEqual(calls,['checkerDownload',eventId]);
});
test('invalid, cross-origin and personal-data-bearing events never count',async()=>{
  for(const [body,requestHeaders] of [
    [{action:'checker-pdf-download',eventId:'invalid'},headers],
    [{action:'checker-pdf-download',eventId,name:'Child'},headers],
    [{action:'checker-pdf-download',eventId,result:'nice'},headers],
    [{action:'checker-pdf-download',eventId},{...headers,origin:'https://other.example'}],
  ]) {
    const res=response();let calls=0;
    await createStatisticsHandler({checkerLimit:async()=>calls++,checkerDownload:async()=>calls++})({method:'POST',headers:requestHeaders,body},res);
    assert.ok([400,403].includes(res.code));assert.equal(calls,0);
  }
});
test('rate limiting prevents increments and database failures do not acknowledge measurement',async()=>{
  for(const limitFailure of [true,false]) {
    let writes=0;const res=response();
    await createStatisticsHandler({checkerLimit:async()=>{if(limitFailure)throw Error('limited')},checkerDownload:async()=>{writes++;throw Error('offline')}})
      ({method:'POST',headers,body:{action:'checker-pdf-download',eventId}},res);
    assert.equal(res.code,503);assert.equal(writes,limitFailure?0:1);
  }
});
test('client sends no name, result, cookies or answers and ignores offline failure',async()=>{
  const original=globalThis.fetch;const bodies=[];
  try {
    globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/message-statistics');assert.equal(options.credentials,'omit');bodies.push(JSON.parse(options.body));throw Error('offline')};
    trackCheckerDownload();trackCheckerDownload();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(bodies.length,2);assert.deepEqual(Object.keys(bodies[0]),['action','eventId']);
    assert.notEqual(bodies[0].eventId,bodies[1].eventId);
  }finally{globalThis.fetch=original;}
});
test('database deduplicates retries, counts separate downloads and uses UK dates', {skip:!process.env.PGLITE_TEST_MODULE},async()=>{
  const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);
  const {readFile}=await import('node:fs/promises');
  const {recordCheckerDownload,checkerDownloadReport}=await import('../server/checker-download-statistics.js');
  const db=new PGlite();
  try {
    await db.exec(await readFile(new URL('../database/message-statistics.sql',import.meta.url),'utf8'));
    const pool={query:(sql,args)=>db.query(sql,args)};
    await recordCheckerDownload(eventId,pool);await recordCheckerDownload(eventId,pool);
    await recordCheckerDownload('22222222-2222-4222-8222-222222222222',pool);
    let report=await checkerDownloadReport(pool);
    assert.equal(report.allTime,2);assert.equal(report.today,2);assert.equal(report.last30Days,2);
    await db.query("UPDATE santa_checker_downloads SET day=(now() AT TIME ZONE 'Europe/London')::date-31 WHERE id=$1",[eventId]);
    report=await checkerDownloadReport(pool);
    assert.equal(report.allTime,2);assert.equal(report.today,1);assert.equal(report.last30Days,1);
    const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='santa_checker_downloads' ORDER BY column_name")).rows;
    assert.deepEqual(columns.map(c=>c.column_name),['day','id']);
    const summer=(await db.query("SELECT ('2026-07-01T23:30:00Z'::timestamptz AT TIME ZONE 'Europe/London')::date::text AS day")).rows[0].day;
    assert.equal(summer,'2026-07-02');
  }finally{await db.close();}
});
