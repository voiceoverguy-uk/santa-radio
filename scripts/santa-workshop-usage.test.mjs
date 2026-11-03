import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import usageApp, { createWorkshopUsageHandler } from '../server/santa-workshop-usage.js';
import { buildWorkshopUsageReport, recordWorkshopUsage, workshopUsageReport } from '../server/santa-workshop-usage-store.js';
import { workshopSettings } from '../server/santa-workshop-settings.js';
import { databasePool } from '../server/name-request-store.js';

async function serve(app, run) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('usage report requires approved staff, not an anonymous visitor, ordinary user or voucher holder', async () => {
  await serve(usageApp, async url => {
    for (const cookie of ['', 'santa-workshop-preview=not-a-staff-session']) {
      const response = await fetch(url, { headers: { Cookie: cookie } });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal((await response.json()).entries, undefined);
    }
  });
  for (const status of [401, 403, 200]) {
    const app = express();
    let reads = 0;
    app.use(createWorkshopUsageHandler({ checkAdmin: async () => status, read: async () => {
      reads++;
      return { vouchers: [{ slot: 6, code: 'EPHEMERAL-DUMMY-CODE' }], entries: 3, messages: 2, corrections: 1 };
    } }));
    await serve(app, async url => {
      const response = await fetch(url);
      assert.equal(response.status, status);
      assert.equal(reads, status === 200 ? 1 : 0);
      assert.match(response.headers.get('cache-control'), /private, no-store/);
      const result = await response.json();
      if (status === 200) assert.equal(result.vouchers[0].code, 'EPHEMERAL-DUMMY-CODE');
      else assert.equal(result.vouchers, undefined);
      assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    });
  }
});

test('report errors are explicit and never expose internal database errors', async () => {
  const app = express();
  app.use(createWorkshopUsageHandler({ checkAdmin: async () => 200,
    read: async () => { throw new Error('PRIVATE INTERNAL DETAILS'); } }));
  await serve(app, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Voucher usage is temporarily unavailable. Please try again.' });
  });
});

test('only approved staff receive the configured code field for the private report', async () => {
  const app = express();
  app.use(createWorkshopUsageHandler({ checkAdmin: async () => 200,
    read: async () => ({ vouchers: [{ slot: 6, code: 'EPHEMERAL-DUMMY-CODE',
      name: 'School tester voucher', entries: 0, messages: 0, corrections: 0,
      totalRecordings: 0, startedAnother: 0, firstEntryAt: null }],
      entries: 0, messages: 0, corrections: 0, totalRecordings: 0, startedAnother: 0, firstEntryAt: null }) }));
  await serve(app, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      vouchers: [{ slot: 6, code: 'EPHEMERAL-DUMMY-CODE', name: 'School tester voucher', entries: 0, messages: 0,
        corrections: 0, totalRecordings: 0, startedAnother: 0, firstEntryAt: null }],
      entries: 0, messages: 0, corrections: 0, totalRecordings: 0, startedAnother: 0, firstEntryAt: null,
    });
  });
});

test('only school sessions are recorded, with fixed event kinds and no private payload', async () => {
  const queries = [];
  const pool = { query: async (...args) => { queries.push(args); } };
  await recordWorkshopUsage({ codeId: '1', generationKey: randomBytes(32).toString('hex') }, 'entry', pool);
  const generationKey = randomBytes(32).toString('hex');
  await recordWorkshopUsage({ codeId: '6', generationKey }, 'entry', pool);
  assert.deepEqual(queries.map(query => query[1].slice(1)), [[1, 'entry'], [6, 'entry']]);
  assert.equal(queries[0][1][0].length, 64);
  await assert.rejects(recordWorkshopUsage({ codeId: '6', generationKey }, 'download', pool));
  await assert.rejects(recordWorkshopUsage({ codeId: '6', generationKey: 'bad' }, 'entry', pool));
});

test('report includes all six active voucher codes, gives each separate totals, and never invents inactive entries', () => {
  const env = Object.fromEntries(Array.from({ length: 6 }, (_, index) =>
    [`SANTA_STUDIO_TEST_CODE_${index + 1}`, `DUMMY-CODE-${index + 1}`]));
  const config = workshopSettings({ ...env, SESSION_SECRET: 'a'.repeat(48),
    SANTA_STUDIO_TEST_EXPIRES_AT: '2026-11-30T23:59:59Z' });
  const report = buildWorkshopUsageReport(config, [
    { slot: 1, entries: 2, startedAnother: 0, firstEntryAt: new Date('2026-11-03T10:00:00Z'),
      messages: 1, corrections: 1, totalRecordings: 2 },
    { slot: 6, entries: 1, startedAnother: 1, firstEntryAt: new Date('2026-11-03T11:00:00Z'),
      messages: 1, corrections: 0, totalRecordings: 1 },
  ]);
  assert.equal(report.vouchers.length, 6);
  assert.deepEqual(report.vouchers.map(voucher => voucher.slot), [1, 2, 3, 4, 5, 6]);
  assert.equal(report.vouchers[0].code, 'DUMMY-CODE-1');
  assert.equal(report.vouchers[5].code, 'DUMMY-CODE-6');
  assert.equal(report.vouchers[0].name, 'Voucher 1');
  assert.equal(report.vouchers[5].name, 'School tester voucher');
  assert.deepEqual(report.vouchers[3], {
    slot: 4, name: 'Voucher 4', code: 'DUMMY-CODE-4', entries: 0, startedAnother: 0,
    firstEntryAt: null, messages: 0, corrections: 0, totalRecordings: 0,
  });
  assert.deepEqual([report.entries, report.messages, report.corrections, report.totalRecordings,
    report.startedAnother], [3, 2, 1, 3, 1]);
  assert.equal(report.firstEntryAt.toISOString(), '2026-11-03T10:00:00.000Z');
  assert.ok(!JSON.stringify(report).includes('SESSION_SECRET'));
});

test('persistent school totals distinguish entries, repeat tests, first recordings and corrections without counting replays or failures',
  { skip: !process.env.DATABASE_URL }, async () => {
    const pool = databasePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await workshopUsageReport(client);
      const keys = Array.from({ length: 3 }, () => randomBytes(32).toString('hex'));
      for (let index = 0; index < keys.length; index++) {
        const session = { codeId: index === 2 ? '1' : '6', generationKey: keys[index] };
        await recordWorkshopUsage(session, index === 2 ? 'another' : 'entry', client);
        await recordWorkshopUsage(session, index === 2 ? 'another' : 'entry', client);
        await client.query('INSERT INTO public.santa_studio_generation_access(access_key) VALUES($1)', [keys[index]]);
      }
      // Two parents share the voucher, but only one has generated anything.
      for (const [key, sequence] of [[keys[0], 1], [keys[0], 2], [keys[2], 1]]) {
        await client.query(`INSERT INTO public.santa_studio_generation_results
          (access_key,operation,request_hash,sequence,audio,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp())`,
        [key, randomUUID(), randomBytes(32).toString('hex'), sequence, Buffer.from('test-audio')]);
      }
      const after = await workshopUsageReport(client);
      const voucher6 = after.vouchers.find(voucher => voucher.slot === 6);
      const voucher1 = after.vouchers.find(voucher => voucher.slot === 1);
      const previous6 = before.vouchers.find(voucher => voucher.slot === 6);
      const previous1 = before.vouchers.find(voucher => voucher.slot === 1);
      assert.equal(voucher6.entries - previous6.entries, 2);
      assert.equal(voucher6.startedAnother - previous6.startedAnother, 0);
      assert.equal(voucher6.messages - previous6.messages, 1);
      assert.equal(voucher6.corrections - previous6.corrections, 1);
      assert.equal(voucher6.totalRecordings - previous6.totalRecordings, 2);
      assert.equal(voucher1.entries - previous1.entries, 0);
      assert.equal(voucher1.startedAnother - previous1.startedAnother, 1);
      assert.equal(voucher1.messages - previous1.messages, 1);
      assert.equal(after.entries - before.entries, 2);
      assert.equal(after.startedAnother - before.startedAnother, 1);
      assert.equal(after.messages - before.messages, 2);
      assert.equal(after.corrections - before.corrections, 1);
      assert.equal(after.totalRecordings - before.totalRecordings, 3);
      assert.equal(JSON.stringify(after).includes(keys[0]), false);
      assert.deepEqual(await workshopUsageReport(client), after);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
