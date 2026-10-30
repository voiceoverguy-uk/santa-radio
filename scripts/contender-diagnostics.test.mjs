import test from 'node:test';
import assert from 'node:assert/strict';
import { contenderFailureDiagnostic } from '../server/contender-diagnostics.js';
import { createContendersHandler } from '../server/christmas-contenders.js';
import { competitionState } from '../server/contenders-store.js';

const failure = code => Object.assign(new Error('DO_NOT_LOG_RAW_MESSAGE_OR_DATA'), {
  code, stack:'DO_NOT_LOG_STACK', detail:'DO_NOT_LOG_DETAIL',
});
const response = () => ({
  statusCode:200, body:null,
  set(){return this;}, status(value){this.statusCode=value;return this;},
  json(value){this.body=value;return this;},
});
const request = {method:'GET',headers:{'x-forwarded-for':'DO_NOT_LOG_SOURCE'},query:{}};

test('categories and stages contain only fixed literals, including unknown failures', () => {
  const cases = [
    ['CONTENDERS_SIGNING_UNAVAILABLE','signing_configuration'],
    ['CONTENDERS_SETTINGS_MISSING','competition_settings'],
    ['42P01','missing_schema'], ['42703','missing_schema'], ['3F000','missing_schema'],
    ['42501','permissions'], ['ECONNREFUSED','db_connectivity'],
    ['28P01','db_connectivity'], ['08006','db_connectivity'],
    ['SELF_SIGNED_CERT_IN_CHAIN','db_connectivity'],
    ['DO_NOT_LOG_UNKNOWN_CODE','unclassified'],
  ];
  for (const [code,category] of cases) {
    const event = contenderFailureDiagnostic(failure(code),'competition_state');
    assert.deepEqual(event, {event:'christmas_contenders_unavailable',stage:'competition_state',category});
    assert.ok(!JSON.stringify(event).includes('DO_NOT_LOG'));
  }
  assert.equal(contenderFailureDiagnostic(failure(),'request_signing').category,'signing_configuration');
  assert.equal(contenderFailureDiagnostic(failure(),'DO_NOT_LOG_STAGE').stage,'request_setup');
});

test('GET failures log the exact fixed stage/category and preserve the unavailable catalogue response', async () => {
  const cases = [
    {stage:'request_signing',category:'signing_configuration',digest:()=>{throw failure();}},
    {stage:'rate_limit_storage',category:'db_connectivity',limit:async()=>{throw failure('ENOTFOUND');}},
    {stage:'rate_limit_storage',category:'missing_schema',limit:async()=>{throw failure('42P01');}},
    {stage:'competition_state',category:'permissions',read:async()=>{throw failure('42501');}},
    {stage:'competition_state',category:'competition_settings',
      read:()=>competitionState({query:async()=>({rows:[]})})},
  ];
  for (const {stage,category,...overrides} of cases) {
    const events = [];
    const handler = createContendersHandler({
      digest:()=> 'a'.repeat(64), limit:async()=>{},
      read:async()=>{throw failure('DO_NOT_LOG_UNKNOWN_CODE');},
      ...overrides, logDiagnostic:event=>events.push(event),
    });
    const res = response();
    await handler(request,res);
    assert.deepEqual(events,[{event:'christmas_contenders_unavailable',stage,category}]);
    assert.equal(res.statusCode,503);
    assert.equal(res.body.ready,false);
    assert.equal(res.body.realVotingEnabled,false);
    assert.equal(res.body.entries.length,9);
    assert.ok(res.body.entries.every(entry=>entry.total === null));
    assert.equal(res.body.entries.filter(entry=>entry.mode === 'demo').length,1);
    assert.ok(!JSON.stringify(res.body).includes('DO_NOT_LOG'));
    assert.equal(res.body.category,undefined);
    assert.equal(res.body.stage,undefined);
  }
});

test('healthy responses are unchanged and produce no diagnostic event', async () => {
  const events = [];
  const data = {ready:true,realVotingEnabled:false,entries:[]};
  const handler = createContendersHandler({digest:()=> 'a'.repeat(64),limit:async()=>{},
    read:async()=>data,logDiagnostic:event=>events.push(event)});
  const res = response();
  await handler(request,res);
  assert.equal(res.statusCode,200);
  assert.strictEqual(res.body,data);
  assert.deepEqual(events,[]);
});

test('a logging failure cannot replace the existing unavailable response', async () => {
  const handler = createContendersHandler({digest:()=>{throw failure();},
    logDiagnostic:()=>{throw new Error('logger failed');}});
  const res = response();
  await handler(request,res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.ready,false);
});
