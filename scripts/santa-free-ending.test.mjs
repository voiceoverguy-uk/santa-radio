import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { resolveFreeEnding } from '../server/santa-free-ending.js';
import { createSantaMessageHandler } from '../server/santa-message.js';
import { createSavedGreetingCache, validManifest } from '../server/santa-saved-cache.js';
import { santaAudioRecipeVersion } from './santa-audio-recipe.mjs';
import { renderArgs } from './santa-audio-filters.mjs';

test('UK calendar boundaries recur annually and preserve both public choices outside November', () => {
  for (const year of [2026, 2027, 2028]) {
    for (const [date, seasonal] of [
      [`${year}-10-31T23:59:59.999Z`, false],
      [`${year}-11-01T00:00:00.000Z`, true],
      [`${year}-11-30T23:59:59.999Z`, true],
      [`${year}-12-01T00:00:00.000Z`, false],
      [`${year}-06-30T23:30:00.000Z`, false],
      [`${year}-01-01T00:00:00.000Z`, false],
    ]) {
      for (const requested of [1, 2]) {
        assert.equal(resolveFreeEnding(requested, new Date(date)), seasonal ? 'nov' : requested, date);
      }
    }
  }
  for (const invalid of [0, 3, 'nov', '1', null, undefined]) {
    assert.throws(() => resolveFreeEnding(invalid), RangeError);
  }
});

test('seasonal saved recipes cannot accept either ordinary manifest or manual approval', async () => {
  const record = { id: 'arabella', file: 'arabella.mp3', source: 'hosted' };
  const library = { sourceBytes: async () => Buffer.from('controlled-name-revision') };
  const cache = createSavedGreetingCache({
    fetcher: async () => Response.json({}), log: () => {},
    publisher: async () => assert.fail('No external publishing'),
  });
  const variants = await Promise.all([1, 2, 'nov'].map(outro => cache.prepare(record, library, outro)));
  assert.equal(new Set(variants.map(value => value.identity.key)).size, 3);
  for (const standard of variants.slice(0, 2)) {
    const oldManifest = { schema: 1, ...standard.identity, file: `${standard.identity.key}-saved.mp3`,
      sha256: 'a'.repeat(64), bytes: 150000 };
    assert.ok(validManifest(oldManifest, standard.identity));
    assert.equal(validManifest(oldManifest, variants[2].identity), false);
    const lookupCache = createSavedGreetingCache({
      fetcher: async () => Response.json(oldManifest), log: () => {},
    });
    assert.equal(await lookupCache.lookup(record, library, 'nov'), null);
  }
  assert.notEqual(santaAudioRecipeVersion(undefined, undefined, 'nov'), santaAudioRecipeVersion());
});

test('one open client crosses November and December: parsed/streamed requests render the resolved ending only', { timeout: 120000 }, async () => {
  const nameBytes = await readFile('server/santa-audio/names/arabella.wav');
  const record = { id: 'arabella', name: 'Arabella', file: 'arabella.mp3', source: 'hosted' };
  const library = {
    resolve: async id => id === record.id ? record : null,
    download: async (_, destination) => writeFile(destination, nameBytes),
  };
  let date, reservations = 0;
  const endings = [], keys = [], finished = [];
  // Exercise both recipe-key and fallback-key single flights. No remote reads
  // or publisher is connected by these controlled rendering fixtures.
  let unavailableRevision = false;
  const cache = {
    prepare: async (_, __, outro) => {
      endings.push(outro);
      if (unavailableRevision) throw new Error('fixture revision unavailable');
      return { identity: { key: santaAudioRecipeVersion(undefined, undefined, outro) } };
    },
    singleFlight: async (key, generate) => { keys.push(key); return generate(); },
    publish: async () => {},
  };
  const handler = createSantaMessageHandler(library, cache, {
    now: () => new Date(date),
    limit: async () => {}, authorize: async () => ({ subject: 'seasonal-fixture' }),
    verify: token => token,
    reserve: async () => { reservations++; return {}; },
    finish: async (_, success) => finished.push(success),
  });
  const server = createServer(async (req, res) => {
    if (req.url === '/parsed') {
      let text = '';
      for await (const chunk of req) text += chunk;
      req.body = JSON.parse(text);
    }
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, outro) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // A stale or deliberately incorrect visitor date must have no effect.
    body: JSON.stringify({ name: 'arabella', selectionToken: 'arabella', outro,
      date: '2026-01-01', month: 1 }),
  });
  await mkdir('generated-artifacts/november-ending', { recursive: true });
  const directory = await mkdtemp(join(tmpdir(), 'seasonal-reference-'));
  try {
    for (const [index, [instant, requested, expected]] of [
      ['2026-10-31T23:59:59.999Z', 1, 1],
      ['2026-11-01T00:00:00.000Z', 1, 'nov'],
      ['2026-11-30T23:59:59.999Z', 2, 'nov'],
      ['2026-12-01T00:00:00.000Z', 2, 2],
      ['2026-12-01T00:00:01.000Z', 1, 1],
      ['2026-11-15T12:00:00.000Z', 2, 'nov'],
    ].entries()) {
      date = instant;
      unavailableRevision = index >= 4;
      const response = await post(index % 2 ? '/parsed' : '/stream', requested);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'audio/mpeg');
      assert.match(response.headers.get('content-disposition'), /Santa-recorded-message-for-Arabella\.mp3/);
      assert.match(response.headers.get('cache-control'), /no-store/);
      const audio = Buffer.from(await response.arrayBuffer());
      assert.equal(Number(response.headers.get('content-length')), audio.length);
      assert.equal(endings.at(-1), expected);
      assert.equal(keys.at(-1), unavailableRevision ? `arabella-${expected}`
        : santaAudioRecipeVersion(undefined, undefined, expected));
      // Compare against the actual expected render, not just the cache spy.
      const args = renderArgs('server/santa-audio/prepared/intro.wav',
        'server/santa-audio/names/arabella.wav', `server/santa-audio/prepared/outro-${expected}.wav`,
        'server/santa-audio/sleighbells.mp3', join(directory, 'reference.mp3'), true);
      const reference = spawnSync(ffmpeg, args, { timeout: 20000, maxBuffer: 5 * 1024 * 1024 });
      assert.equal(reference.status, 0, reference.stderr?.toString());
      const digest = bytes => createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest(audio), digest(await readFile(join(directory, 'reference.mp3'))),
        'The entire response must be the exact expected ending, joins and bells');
      const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', 'pipe:0', '-f', 'null', '-'],
        { input: audio, timeout: 20000 });
      assert.equal(decoded.status, 0, decoded.stderr?.toString());
      await writeFile(`generated-artifacts/november-ending/arabella-${index}-${expected}.mp3`, audio);
    }
    assert.equal(reservations, 6);
    assert.deepEqual(finished, Array(6).fill(true));
    for (const route of ['/stream', '/parsed']) {
      for (const invalid of [3, 'nov', '1', null]) {
        assert.equal((await post(route, invalid)).status, 400);
      }
    }
    assert.equal(reservations, 6, 'Invalid requests must not consume allowance');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
