import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAppleSales,reportDays,summariseAppleDays} from '../server/apple-download-statistics.js';
const header='Apple Identifier\tProduct Type Identifier\tUnits\n';
test('exact app, separate new downloads, redownloads, updates and refunds',()=>{
 assert.deepEqual(parseAppleSales(header+'1021183593\t1\t10\n1021183593\t1F\t-1\n1021183593\t3\t4\n1021183593\t7\t8\n1021183593\tIA1\t100\n999\t1\t99'),{downloads:9,redownloads:4,updates:8});
});
test('malformed reports fail instead of inventing zero',()=>{
 assert.throws(()=>parseAppleSales('Oops'));
 assert.throws(()=>parseAppleSales(header+'1021183593\t1\tno'));
});
test('periods use Pacific date and exclude today',()=>{
 assert.equal(reportDays(new Date('2026-11-17T01:00:00Z'))[0],'2026-11-15');
});
test('incomplete coverage never becomes a zero or partial total',()=>{
 const now=new Date('2026-11-17T16:00:00Z');const days=reportDays(now);
 const rows=days.map(day=>({day,downloads:2,redownloads:1,updates:3}));
 const full=summariseAppleDays(rows,now); assert.equal(full.last30Days,60);assert.equal(full.last7Days,14);
 const missing=summariseAppleDays(rows.filter((_,i)=>i!==3),now);assert.equal(missing.last30Days,null);assert.equal(missing.last7Days,null);assert.equal(missing.latest.day,days[0]);
 assert.equal(summariseAppleDays([],now).latest,null);
});
test('delayed publication shifts the complete rolling window to latest report',()=>{
 const now=new Date('2026-11-17T16:00:00Z');
 const rows=reportDays(now,32).slice(1).map(day=>({day,downloads:2,redownloads:1,updates:3}));
 const report=summariseAppleDays(rows,now);
 assert.equal(report.endDate,'2026-11-15');assert.equal(report.last30Days,60);assert.equal(report.last7Days,14);
});
test('cron endpoint rejects unauthenticated requests before importing',async()=>{
 const {default:handler}=await import('../api/apple-download-sync.js');
 const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};
 await handler({headers:{},method:'GET'},res);assert.equal(res.code,401);
});

test('ranking shares a reporting period, preserves Mac identity and separates pending apps',async()=>{
 const {rankAppleApps}=await import('../server/apple-download-statistics.js');
 const {releaseStatus}=await import('../server/apple-tracked-apps.js');
 const now=new Date('2026-11-17T16:00:00Z');
 const rows=reportDays(now).flatMap(day=>[
  {appId:'1021183593',day,downloads:2,redownloads:0,updates:0},
  {appId:'1025312198',day,downloads:3,redownloads:0,updates:0},
  {appId:'6830570614',day,downloads:0,redownloads:0,updates:0}]);
 const apps=rankAppleApps(rows,[{appId:'1021183593',status:'released'},{appId:'1025312198',status:'released'},{appId:'6830570614',status:'pending'}],now);
 assert.equal(apps.length,12);assert.equal(apps[0].id,'1025312198');assert.equal(apps[0].rank,1);assert.equal(apps[1].last30Days,60);
 assert.equal(apps.find(a=>a.id==='6830570614').rank,null);
 assert.equal(apps.find(a=>a.id==='1196349863').last30Days,null);
 assert.equal(releaseStatus([{attributes:{appStoreState:'WAITING_FOR_REVIEW'}},{attributes:{appStoreState:'READY_FOR_SALE'}}]),'released');
 assert.equal(releaseStatus([{attributes:{appStoreState:'WAITING_FOR_REVIEW'}}]),'pending');
});
