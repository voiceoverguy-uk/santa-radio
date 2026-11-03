import test from 'node:test';
import assert from 'node:assert/strict';
import { studioServiceFailure } from '../server/studio-service-events.js';
import { createStudioMessageHandler } from '../server/santa-studio-message.js';
import { EventEmitter } from 'node:events';

test('private failure events identify the storage binding and stage without credentials or personal data', () => {
  const lines = [];
  const env = { VERCEL: '1', DATABASE_URL: 'postgres://PRIVATE-USER:PRIVATE-PASSWORD@db.example:5433/studio?application_name=PRIVATE-QUERY' };
  const error = Object.assign(new Error('PRIVATE-ERROR'), { code: '42P01', choices: 'PRIVATE-CHOICES' });
  studioServiceFailure(error, 'status', { env, log: line => lines.push(line) });
  const event = JSON.parse(lines[0]);
  assert.deepEqual(event, { event: 'studio_service_unavailable', stage: 'status',
    reason: 'missing_schema', runtime: 'vercel', database: { host: 'db.example', name: 'studio', port: 5433 } });
  assert.ok(!lines[0].includes('PRIVATE'));
  studioServiceFailure(error, 'unknown-secret-stage', { env, log: line => lines.push(line) });
  assert.equal(lines.length, 1);
  assert.doesNotThrow(() => studioServiceFailure(error, 'status', { env, log() { throw new Error(); } }));
});

test('status storage failures fail closed before any source access or stitching and report the exact failing stage', async () => {
  let renders = 0, source = 0;
  const events = [];
  const handler = createStudioMessageHandler({
    authorize: async () => true, limit: async () => {}, accessKey: () => 'fixture',
    generations: { status: async () => { throw Object.assign(new Error('PRIVATE'), { code: '42P01' }); } },
    library: { resolve: async () => { source++; } },
    render: async () => { renders++; },
    reportFailure: (error, stage) => events.push([error.code, stage]),
  });
  const req = Object.assign(new EventEmitter(), { method: 'GET', headers: {}, url: '/' });
  let status, body;
  const res = Object.assign(new EventEmitter(), {
    setHeader() {}, writeHead(s) { status = s; }, end(b) { body = b; },
  });
  await handler(req, res);
  assert.equal(status, 503);
  assert.equal(renders, 0); assert.equal(source, 0);
  assert.deepEqual(events, [['42P01', 'status']]);
  assert.ok(!body.includes('PRIVATE'));
  assert.ok(!body.includes('db.example'));
});

test('recovery does not turn a cross-origin GET into an authenticated render request', async () => {
  const handler = createStudioMessageHandler({
    authorize: async () => true, accessKey: () => 'fixture',
    limit: async () => assert.fail('Rejected recovery must not reach storage'),
  });
  for (const extra of [{ origin: 'https://attacker.example' }, { 'sec-fetch-site': 'same-site' }]) {
    const req = Object.assign(new EventEmitter(), { method: 'GET', url: '/?audio=1',
      headers: { host: 'studio.test', ...extra }, socket: { encrypted: true } });
    let status;
    const res = Object.assign(new EventEmitter(), {
      setHeader() {}, writeHead(s) { status = s; }, end() {},
    });
    await handler(req, res);
    assert.equal(status, 403);
  }
});
