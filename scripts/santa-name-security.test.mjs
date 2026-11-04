import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';
import { createSantaNamesHandler } from '../server/santa-names.js';
import { createSantaNamePreviewHandler } from '../server/santa-name-preview.js';
import { createSantaMessageHandler } from '../server/santa-message.js';
import { createSantaGreetingHandler } from '../server/santa-greeting.js';
import { createNameLibrary } from '../server/santa-name-library.js';
import { consumeNameAccess, issueNameToken, verifyNameToken } from '../server/santa-name-security.js';
import { BLOCKED_NAME_NOTE } from '../src/lib/nameLanguage.js';

const key = 'controlled-test-only-signing-key-32-characters';
const token = (id, scope) => issueNameToken(id, scope, Date.now(), key);
const verify = (value, scope) => verifyNameToken(value, scope, Date.now(), key);
const noLimit = async () => {};
let searched = 0, base, server;
const names = createSantaNamesHandler({
  search: async query => {
    searched++;
    assert.equal(query, 'Er');
    return { records: Array.from({ length: 20 }, (_, index) => ({
      id: `f-${String(index).padStart(64, '0')}`, name: `Erin ${index}`,
      file: 'secret-origin-file.mp3', previewUrl: 'https://origin.invalid/private.mp3',
      variant: 'secret-origin-file.mp3', downloadName: 'greeting.mp3',
    })), hostedCount: 9774 };
  },
  catalogue: () => assert.fail('Public routes must not call catalogue'),
}, { limit: noLimit, token });
const previewBytes = await readFile('server/santa-audio/sleighbells.mp3');
const preview = createSantaNamePreviewHandler({
  resolve: async id => ({ id, file: 'secret-origin-file.mp3', source: 'hosted' }),
  sourceBytes: async () => previewBytes,
}, { limit: noLimit, verify });
const local = createNameLibrary({ fetcher: async () => new Response(JSON.stringify({ version: 1, names: [] })) });
const message = createSantaMessageHandler(local, {
  prepare: async () => null, publish: async () => assert.fail('Tests never publish audio'),
  singleFlight: (_, work) => work(),
}, { limit: noLimit, verify, authorize: () => ({ subject: 'fixture' }),
  reserve: async () => ({}), finish: async () => {} });
const greeting = createSantaGreetingHandler();
const limited = createSantaNamesHandler({}, {
  limit: async () => { throw Object.assign(new Error('Too many requests.'), { status: 429, retryAfter: 30 }); },
});
const unavailable = createSantaNamesHandler({}, { limit: async () => { throw new Error('Storage unavailable'); } });

before(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://test').pathname;
    return ({ '/names': names, '/preview': preview, '/message': message, '/greeting': greeting,
      '/limited': limited, '/unavailable': unavailable })[path](req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const post = (path, data) => fetch(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

test('all inventory modes, empty searches, wildcard requests and URL queries are blocked', async () => {
  for (const path of ['/names?inventory=hosted', '/names?inventory=all', '/names?inventory=',
    '/names?q=Er', '/names?export=json', '/names?limit=999999', '/names?inventory=hosted&inventory=other']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).records, undefined);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  }
  assert.equal((await fetch(`${base}/names`)).status, 405);
  for (const query of ['', ' ', 'E', '*', '%', 'Er*', 'Er?', '[a-z]', 'Er\nin', 'a'.repeat(81)]) {
    assert.equal((await post('/names', { query })).status, 400, JSON.stringify(query));
  }
  assert.equal((await post('/names', { query: 'Er', inventory: 'hosted' })).status, 400);
  assert.equal(searched, 0);
});

test('search is capped, scoped, count-free and never exposes origin paths', async () => {
  const response = await post('/names', { query: 'Er' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.records.length, 10);
  assert.equal(result.hostedCount, undefined);
  assert.doesNotMatch(JSON.stringify(result), /9774|origin\.invalid|secret-origin-file/);
  const record = result.records[0];
  assert.equal(verify(record.selectionToken, 'message'), record.id);
  const previewToken = new URL(record.previewUrl, 'http://test').searchParams.get('token');
  assert.equal(verify(previewToken, 'preview'), record.id);
  assert.equal(verify(previewToken, 'message'), null);
});

test('abusive searches consume limits but never access the catalogue or issue capabilities', async () => {
  let limits = 0;
  const handler = createSantaNamesHandler({
    search: () => assert.fail('Blocked input must not search the private catalogue'),
  }, {
    limit: async (_req, scope) => { assert.equal(scope, 'search'); limits++; },
    token: () => assert.fail('Blocked input must not issue capabilities'),
  });
  const queries = ['fuck', 'SHIT', 'cunt', 'wanker', 'bitch', 'bollocks', 'ＦＵＣＫ',
    'fúçk', 'f.u.c.k', 'f u c k', 's-h-i-t', 'sh1t', 'fu\u200bck', 'fυсk', 'fuck you'];
  for (const query of queries) {
    const headers = {};
    let status, body;
    await handler({ method: 'POST', url: '/names', headers: { 'content-type': 'application/json' }, body: { query } }, {
      setHeader: (key, value) => { headers[key] = value; },
      writeHead: code => { status = code; }, end: value => { body = JSON.parse(value); },
    });
    assert.equal(status, 400, query);
    assert.deepEqual(body, { error: BLOCKED_NAME_NOTE });
    assert.match(headers['Cache-Control'], /private.*no-store/);
    assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  }
  assert.equal(limits, queries.length);
  assert.equal((await post('/limited', { query: 'fuck' })).status, 429);
});

test('innocent coincidental sequences and unmatched names still reach normal private search', async () => {
  for (const query of ['Scunthorpe', 'Fuchsia', 'Dick', 'Fanny', 'Cassian', 'Shital', 'UnknownName', 'Élodie', 'Anne-Marie']) {
    let searchedQuery, status, body;
    const handler = createSantaNamesHandler({
      search: async value => { searchedQuery = value; return { records: [] }; },
    }, { limit: noLimit, token: () => assert.fail('No capabilities for missing names') });
    await handler({ method: 'POST', url: '/names', headers: { 'content-type': 'application/json' }, body: { query } }, {
      setHeader() {}, writeHead: code => { status = code; }, end: value => { body = JSON.parse(value); },
    });
    assert.equal(status, 200, query);
    assert.equal(searchedQuery, query);
    assert.deepEqual(body.records, []);
  }
});

test('signed previews reject tampering, expiry, wrong scopes and arbitrary source URLs', async () => {
  for (const value of ['invalid', token('erin', 'message'),
    issueNameToken('erin', 'preview', Date.now() - 301000, key)]) {
    assert.equal((await fetch(`${base}/preview?token=${encodeURIComponent(value)}`)).status, 403);
  }
  const valid = token('erin', 'preview');
  assert.equal((await fetch(`${base}/preview?url=https://origin.invalid/private.mp3`)).status, 403);
  assert.equal((await fetch(`${base}/preview?token=${valid}&token=${valid}`)).status, 403);
  const response = await fetch(`${base}/preview?token=${valid}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), previewBytes);
});

test('rate limits report Retry-After and unavailable shared storage fails closed', async () => {
  const blocked = await post('/limited', { query: 'Er' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '30');
  assert.equal((await post('/unavailable', { query: 'Er' })).status, 503);
});

test('old public greeting descriptors cannot expose permanent cache audio URLs', async () => {
  const response = await fetch(`${base}/greeting?name=arabella&outro=1`);
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { available: false });
});

test('message creation requires a scoped current selection and still returns a playable MP3', { timeout: 40000 }, async () => {
  for (const selectionToken of [undefined, token('erin', 'preview'), token('olivia', 'message')]) {
    assert.equal((await post('/message', { name: 'erin', outro: 1, selectionToken })).status, 403);
  }
  const response = await post('/message', { name: 'erin', outro: 1, selectionToken: token('erin', 'message') });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /santa-recorded-message-for-Erin\.mp3/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 100000);
  const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-f', 'null', '-'], { input: bytes, timeout: 20000 });
  assert.equal(decoded.status, 0, decoded.stderr?.toString());
});

test('shared limiter uses atomic storage, disjoint scopes and trusted address identification', async () => {
  const buckets = new Map(), recorded = [];
  let commands = 0;
  const pool = {
    async query(sql, params) {
      commands++;
      assert.match(sql, /SELECT santa_consume_name_access/);
      const [global, address, globalMax, addressMax, expiry] = params;
      const pairs = [[global, globalMax], [address, addressMax]];
      for (const [bucket, maximum] of pairs) {
        recorded.push({ bucket, expiry });
        if ((buckets.get(bucket) || 0) >= maximum) {
          throw Object.assign(new Error('NAME_ACCESS_LIMIT'), { code: 'P0001' });
        }
      }
      for (const [bucket] of pairs) buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      return { rows: [{ catalogue: null }] };
    },
  };
  const options = { now: 120000, key, pool };
  for (let index = 0; index < 40; index++) {
    await consumeNameAccess({ headers: { 'x-forwarded-for': `spoof-${index}` }, socket: { remoteAddress: 'test-address' } }, 'search', options);
  }
  await assert.rejects(() => consumeNameAccess({ headers: {}, socket: { remoteAddress: 'test-address' } }, 'search', options),
    error => error.status === 429 && error.retryAfter === 60);
  await consumeNameAccess({ headers: {}, socket: { remoteAddress: 'test-address' } }, 'preview', options);
  assert.equal(commands, 42, 'one database command per request');
  assert.ok(recorded.every(record => !/test-address|spoof/.test(record.bucket)));
  assert.ok(recorded.every(record => record.expiry.getTime() === 180000));
});
