import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { databasePool } from '../server/name-request-store.js';
import { createStudioGenerationStore, studioIdentity, studioGenerationKey } from '../server/santa-studio-generation.js';
import { createStudioMessageHandler } from '../server/santa-studio-message.js';
import { issueWorkshopToken, workshopSession, WORKSHOP_COOKIE } from '../server/santa-workshop-access.js';

const pool = databasePool();
const keys = [];
const newKey = () => {
  const key = createHash('sha256').update(randomUUID()).digest('hex');
  keys.push(key);
  return key;
};
const id = n => `c-${String(n).repeat(64)}`;
const choices = { name: `f-${'a'.repeat(64)}`, age: id(1), activity: id(2), achievement: id(3),
  treat: id(4), place: id(5), region: id(6), talent: { skip: true } };
const identity = studioIdentity(choices, 'countries');
test.before(async () => {
  // This suite is explicitly development-only, never a production migration.
  if (process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1') throw new Error('Development database tests only.');
  await pool.query(await readFile(new URL('../database/santa-studio-generation.sql', import.meta.url), 'utf8'));
});
test.after(async () => {
  await pool.query('DELETE FROM public.santa_studio_generation_results WHERE access_key=ANY($1::text[])', [keys]);
  await pool.query('DELETE FROM public.santa_studio_generation_access WHERE access_key=ANY($1::text[])', [keys]);
  await pool.end();
});

test('durable two-success allowance, exact identity lock, idempotency and isolation', async () => {
  const key = newKey(), other = newKey();
  const store = createStudioGenerationStore(pool);
  const operation = randomUUID();
  const first = await store.reserve(key, operation, choices, identity);
  assert.equal((await store.status(key)).successes, 0);
  assert.equal((await store.status(key)).pending, true);
  await store.succeed(key, first.reservation, choices, identity, Buffer.from('first'));
  const restarted = createStudioGenerationStore(pool);
  assert.equal((await restarted.status(key)).remaining, 1);
  assert.deepEqual((await restarted.status(key)).locked, identity);
  assert.equal((await restarted.audio(key)).toString(), 'first');
  assert.equal((await restarted.reserve(key, operation, choices, identity)).audio.toString(), 'first');
  await assert.rejects(restarted.reserve(key, operation, { ...choices, age: id(9) }, identity), { status: 409 });
  for (const changed of [
    { ...identity, name: `f-${'b'.repeat(64)}` }, { ...identity, category: 'fantasy' },
    { ...identity, place: id(7) }, { ...identity, region: '' }, { ...identity, region: id(8) },
  ]) await assert.rejects(restarted.reserve(key, randomUUID(), choices, changed), { status: 409 });
  const correction = { ...choices, age: id(9), talent: { category: 'sports', id: id(8) } };
  const second = await restarted.reserve(key, randomUUID(), correction, identity);
  // Previous download remains available while correcting.
  assert.equal((await restarted.audio(key)).toString(), 'first');
  await restarted.succeed(key, second.reservation, correction, identity, Buffer.from('second'));
  assert.equal((await store.status(key)).remaining, 0);
  assert.equal((await store.audio(key)).toString(), 'second');
  await assert.rejects(store.reserve(key, randomUUID(), choices, identity), { status: 409 });
  assert.equal((await store.status(other)).remaining, 2);
});

test('concurrent instances serialize reservations; failures release; expired leases are fenced', async () => {
  const key = newKey();
  const a = createStudioGenerationStore(pool), b = createStudioGenerationStore(pool);
  const results = await Promise.allSettled([
    a.reserve(key, randomUUID(), choices, identity),
    b.reserve(key, randomUUID(), choices, { ...identity, name: 'another-variant' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const reservation = results.find(result => result.status === 'fulfilled').value.reservation;
  await a.release(key, reservation);
  assert.equal((await a.status(key)).remaining, 2);
  assert.equal((await a.status(key)).locked, null);
  const abandoned = await a.reserve(key, randomUUID(), choices, identity);
  await pool.query(`UPDATE public.santa_studio_generation_access
    SET reserved_until=clock_timestamp()-interval '1 second' WHERE access_key=$1`, [key]);
  const replacement = await b.reserve(key, randomUUID(), choices, identity);
  await assert.rejects(a.succeed(key, abandoned.reservation, choices, identity, Buffer.from('stale')), { status: 409 });
  await a.release(key, abandoned.reservation);
  assert.equal((await a.status(key)).pending, true);
  await b.succeed(key, replacement.reservation, choices, identity, Buffer.from('valid'));
  const last = await Promise.allSettled(Array.from({ length: 8 }, () => a.reserve(key, randomUUID(), choices, identity)));
  assert.equal(last.filter(result => result.status === 'fulfilled').length, 1);
  const winner = last.find(result => result.status === 'fulfilled').value;
  await b.succeed(key, winner.reservation, choices, identity, Buffer.from('final'));
  assert.equal((await a.status(key)).successes, 2);
});

test('tester tokens and sandbox claims are opaque per-access identities, not shared code counters', () => {
  const config = { codes: [{ id: '1', code: randomUUID() }], signingSecret: randomUUID(),
    expiresAt: Date.now() + 86400000 };
  const request = token => ({ headers: { cookie: `${WORKSHOP_COOKIE}=${token}` } });
  const one = request(issueWorkshopToken(config)), two = request(issueWorkshopToken(config));
  assert.notEqual(workshopSession(one, config).generationKey, workshopSession(two, config).generationKey);
  assert.equal(workshopSession(one, config).generationKey, workshopSession(one, config).generationKey);
  const sandbox = { headers: { cookie: `santa-studio-sandbox=cs_test_fixture.${'a'.repeat(43)}` } };
  const different = { headers: { cookie: `santa-studio-sandbox=cs_test_fixture.${'b'.repeat(43)}` } };
  assert.match(studioGenerationKey(sandbox), /^[a-f0-9]{64}$/);
  assert.notEqual(studioGenerationKey(sandbox), studioGenerationKey(different));
});

async function call(handler, data, operation = randomUUID(), method = 'POST', url = '/') {
  const req = Object.assign(new EventEmitter(), { body: data, method, url,
    headers: { host: 'studio.test', origin: 'https://studio.test', 'content-type': 'application/json',
      'idempotency-key': operation }, socket: { encrypted: true } });
  const result = { headers: {} };
  const res = Object.assign(new EventEmitter(), {
    setHeader: (name, value) => { result.headers[name] = value; },
    writeHead: (status, headers) => { result.status = status; Object.assign(result.headers, headers); },
    end: bytes => { result.body = bytes; },
  });
  await handler(req, res);
  return result;
}
test('handler integrates failure release, locked regional/variant validation, refresh recovery and exactly two successes', async () => {
  const key = newKey();
  let fail = true, renders = 0;
  const inventory = { categories: Object.fromEntries(['age', 'activity', 'achievement', 'treat', 'place']
    .map(category => [category, [{ id: choices[category], file: `${category}.wav` },
      { id: id(9), file: 'other.wav' }]])),
    regionalGroups: { fixture: { parentId: choices.place, records: [{ id: choices.region, file: 'region.wav' }] } } };
  const options = {
    accessKey: () => key, authorize: async () => true, limit: async () => {},
    generations: createStudioGenerationStore(pool), catalogue: async () => inventory,
    library: { resolve: async id => ({ id, name: 'Example', variant: 'Recording 2', source: 'hosted' }),
      download: async (_record, target) => writeFile(target, 'fixture') },
    download: async (_url, target) => writeFile(target, 'fixture'),
    render: async () => { renders++; if (fail) throw new Error('test preparation failure'); return { audio: Buffer.from('mp3') }; },
  };
  const handler = createStudioMessageHandler(options);
  const operation = randomUUID();
  assert.equal((await call(handler, choices, operation)).status, 503);
  assert.equal((await options.generations.status(key)).remaining, 2);
  fail = false;
  assert.equal((await call(handler, choices, operation)).status, 200);
  assert.equal((await call(handler, choices, operation)).status, 200);
  assert.equal(renders, 2);
  for (const changed of [
    { ...choices, name: 'another-variant' }, { ...choices, place: id(9), region: undefined },
    { ...choices, region: undefined },
  ]) {
    const data = JSON.parse(JSON.stringify(changed));
    assert.equal((await call(handler, data)).status, 409);
  }
  const restart = createStudioMessageHandler(options);
  const status = await call(restart, undefined, undefined, 'GET');
  assert.equal(status.status, 200);
  const json = JSON.parse(status.body);
  assert.equal(json.successes, 1);
  assert.equal(json.record.variant, 'Recording 2');
  assert.equal(JSON.stringify(json).includes('source'), false);
  assert.equal((await call(restart, undefined, undefined, 'GET', '/?audio=1')).body.toString(), 'mp3');
  assert.equal((await call(restart, { ...choices, age: id(9) })).status, 200);
  assert.equal((await call(restart, choices)).status, 409);
  assert.equal((await options.generations.status(key)).successes, 2);
  assert.equal(renders, 3);
});

test('aborting preparation releases its real database reservation without locking or spending a success', async () => {
  const key = newKey();
  const generations = createStudioGenerationStore(pool);
  let entered;
  const rendering = new Promise(resolve => { entered = resolve; });
  const handler = createStudioMessageHandler({
    accessKey: () => key, authorize: async () => true, limit: async () => {}, generations,
    catalogue: async () => ({ categories: Object.fromEntries(['age', 'activity', 'achievement', 'treat', 'place']
      .map(category => [category, [{ id: choices[category], file: `${category}.wav` }]])) }),
    library: { resolve: async id => ({ id, source: 'hosted' }),
      download: async (_record, target) => writeFile(target, 'fixture') },
    download: async (_url, target) => writeFile(target, 'fixture'),
    render: async ({ signal }) => {
      entered();
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    },
  });
  const data = { ...choices };
  delete data.region;
  const req = Object.assign(new EventEmitter(), { method: 'POST', body: data,
    socket: { encrypted: true }, headers: { host: 'studio.test', origin: 'https://studio.test',
      'content-type': 'application/json', 'idempotency-key': randomUUID() } });
  const res = Object.assign(new EventEmitter(), { setHeader() {}, writeHead() {}, end() {} });
  const pending = handler(req, res);
  await rendering;
  assert.equal((await generations.status(key)).pending, true);
  res.destroyed = true;
  res.emit('close');
  await pending;
  assert.deepEqual(await generations.status(key), {
    successes: 0, remaining: 2, locked: null, choices: null, pending: false,
  });
});
