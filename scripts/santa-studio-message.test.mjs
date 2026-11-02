import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { createStudioMessageHandler, downloadStudioClip } from '../server/santa-studio-message.js';
import { studioOrder, studioMixArgs, prepareStudioClip, renderStudioMessage } from '../server/santa-studio-render.js';
import { getWorkshopDownloadName } from '../src/lib/workshopNameSpelling.js';
import serverlessHandler from '../api/santa-studio-message.js';
import defaultHandler from '../server/santa-studio-message.js';

const execute = promisify(execFile);
const keys = ['age', 'activity', 'achievement', 'treat', 'place'];
const id = n => `c-${n.toString(16).repeat(64)}`;
const choices = Object.fromEntries(keys.map((key, index) => [key, id(index + 1)]));
const body = { name: `f-${'a'.repeat(64)}`, ...choices };
const inventory = { categories: Object.fromEntries(keys.map((key, index) =>
  [key, [{ id: choices[key], file: `trusted/${key}.wav` }, { id: id(index + 6), file: `trusted/other-${key}.mp3` }]])) };

function fixture(overrides = {}) {
  const state = { resolved: [], downloads: [], renders: [], scopes: [] };
  const handler = createStudioMessageHandler({
    authorize: async () => true,
    limit: async (_req, scope) => state.scopes.push(scope),
    catalogue: async () => inventory,
    library: {
      resolve: async name => { state.resolved.push(name); return { id: name, source: 'hosted' }; },
      download: async (_record, target) => writeFile(target, 'name'),
    },
    download: async (url, target) => { state.downloads.push(url); await writeFile(target, 'clip'); },
    render: async args => { state.renders.push(args); return { audio: Buffer.from('mp3') }; },
    ...overrides,
  });
  return { state, handler };
}
async function call(handler, { data = body, method = 'POST', origin = 'https://studio.test', headers = {}, res = new EventEmitter() } = {}) {
  const result = { headers: {}, res };
  Object.assign(res, {
    setHeader: (key, value) => { result.headers[key.toLowerCase()] = value; },
    writeHead: (status, values) => { result.status = status; Object.entries(values).forEach(([key, value]) => res.setHeader(key, value)); },
    end: bytes => { result.bytes = bytes; },
  });
  const req = Object.assign(new EventEmitter(), { method, body: data,
    socket: { encrypted: true }, headers: { host: 'studio.test', origin, 'content-type': 'application/json', ...headers } });
  await handler(req, res);
  if (result.headers['content-type']?.includes('json')) result.json = JSON.parse(result.bytes);
  return result;
}

test('protected Studio resolves exact ID afresh, all category IDs, private MP3 and cleanup without free allowance', async () => {
  const { handler, state } = fixture();
  const result = await call(handler);
  assert.equal(result.status, 200);
  assert.deepEqual(state.resolved, [body.name]);
  assert.deepEqual(state.scopes, ['studioMessage']);
  assert.equal(state.downloads.length, 5);
  for (const key of keys) assert.ok(state.downloads.some(url => url.endsWith(`/trusted/${key}.wav`)));
  assert.equal(result.headers['content-type'], 'audio/mpeg');
  assert.match(result.headers['cache-control'], /private, no-store/);
  assert.equal(result.headers['vercel-cdn-cache-control'], 'no-store');
  assert.ok(!result.headers['content-disposition'].includes(body.name));
  await assert.rejects(stat(state.renders[0].directory), { code: 'ENOENT' });
});

test('every category changes its own trusted recording and never changes the selected name variant', async () => {
  for (let index = 0; index < keys.length; index++) {
    const { handler, state } = fixture();
    const result = await call(handler, { data: { ...body, [keys[index]]: id(index + 6) } });
    assert.equal(result.status, 200);
    assert.ok(state.downloads.some(url => url.endsWith(`/trusted/other-${keys[index]}.mp3`)));
    assert.deepEqual(state.resolved, [body.name]);
  }
});

test('no access, wrong origin, tampering, URLs, malformed/oversize JSON and methods never render', async () => {
  const { handler, state } = fixture();
  assert.equal((await call(fixture({ authorize: async () => false }).handler)).status, 403);
  for (const options of [
    { origin: 'https://attacker.test' }, { headers: { 'sec-fetch-site': 'cross-site' } },
    { method: 'GET' }, { origin: '' },
    { data: { ...body, name: 'https://attacker.test/name.wav' } },
    { data: { ...body, age: 'https://attacker.test/age.wav' } },
    { data: { ...body, spelling: 'Different' } },
    { data: { ...body, activity: id(0) } }, { data: {} },
    { data: '{broken' }, { data: 'x'.repeat(1025) },
    { headers: { 'content-type': 'text/plain' } },
  ]) {
    const result = await call(handler, options);
    assert.ok(result.status >= 400, JSON.stringify(options));
    assert.equal(state.renders.length, 0);
  }
});

test('missing exact recording is not substituted, unavailable/undecodable clips fail privately and can retry', async () => {
  const unavailable = fixture({ library: { resolve: async () => null } });
  assert.equal((await call(unavailable.handler)).status, 400);
  let fail = true, directory;
  const { handler } = fixture({ render: async args => {
    directory = args.directory;
    if (fail) throw new Error('/private/child-name.wav https://origin.invalid');
    return { audio: Buffer.from('mp3') };
  } });
  const result = await call(handler);
  assert.equal(result.status, 503);
  assert.ok(!result.bytes.includes('origin.invalid'));
  assert.ok(!result.bytes.includes('child-name'));
  await assert.rejects(stat(directory), { code: 'ENOENT' });
  fail = false;
  assert.equal((await call(handler)).status, 200);
});

test('cancellation kills rendering, cleans files, releases concurrency and permits retries', async () => {
  let enter;
  const entered = new Promise(resolve => { enter = resolve; });
  let directory;
  const { handler } = fixture({ render: async args => {
    directory = args.directory;
    enter();
    await new Promise((_, reject) => args.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  } });
  const res = new EventEmitter();
  const pending = call(handler, { res });
  await entered;
  res.destroyed = true;
  res.emit('close');
  await pending;
  await assert.rejects(stat(directory), { code: 'ENOENT' });
  assert.equal((await call(handler, { data: {} })).status, 400);
});

test('two jobs maximum and global execution deadline includes access checks', async () => {
  const blocked = fixture({ authorize: () => new Promise(() => {}), executionMs: 30 });
  const first = call(blocked.handler), second = call(blocked.handler);
  assert.equal((await call(blocked.handler)).status, 429);
  assert.equal((await first).status, 503);
  assert.equal((await second).status, 503);
  assert.equal((await call(blocked.handler)).status, 503);
});

test('category download rejects redirects, missing, empty and oversized bytes; cancellation is forwarded', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-download-test-'));
  const signal = new AbortController().signal;
  try {
    for (const response of [
      new Response('missing', { status: 404 }), new Response(''),
      new Response('big', { headers: { 'content-length': String(21 * 1024 * 1024) } }),
      new Response(new Uint8Array(21 * 1024 * 1024)),
    ]) await assert.rejects(downloadStudioClip('https://trusted.test/file.wav',
      join(directory, 'clip.wav'), signal, async (_url, options) => {
        assert.equal(options.redirect, 'error'); assert.ok(options.signal); return response;
      }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('recipe uses all 14 positions, exact repeated variant, unchanged bells settings, safe local filenames', () => {
  const paths = Object.fromEntries(keys.map(key => [key, `${key}.wav`]));
  assert.deepEqual(studioOrder('variant-2.wav', paths, '/fixed').map(path => basename(path)), [
    'intro.flac', 'variant-2.wav', '1st.flac', 'age.wav', '2nd.flac', 'activity.wav',
    'achievement.wav', '3rd.flac', 'treat.wav', '4th.flac', 'place.wav', '5th.flac', 'variant-2.wav', '6th.flac',
  ]);
  const graph = studioMixArgs('speech', 'bells', 'output').join(' ');
  assert.match(graph, /I=-34:TP=-9:LRA=7/);
  assert.match(graph, /latency=true/);
  for (const name of ['D’Arcy', 'Élodie', 'Anna-Mae']) {
    assert.equal(getWorkshopDownloadName('Original', name), `santa-message-for-${name}.mp3`);
  }
  assert.equal(getWorkshopDownloadName('Arabella', '../../bad\r\nname'), 'santa-message-for-Arabella.mp3');
});

test('serverless entry shares the protected handler and packages all fixed sources and executable', async () => {
  assert.equal(serverlessHandler, defaultHandler);
  const config = JSON.parse(await readFile('vercel.json', 'utf8')).functions['api/santa-studio-message.js'];
  assert.equal(config.maxDuration, 120);
  assert.ok(config.includeFiles.includes('server/santa-audio/studio/**'));
  assert.ok(config.includeFiles.includes('server/santa-audio/names/**'));
  assert.ok(config.includeFiles.includes('node_modules/ffmpeg-static/**'));
  for (const file of ['intro', '1st', '2nd', '3rd', '4th', '5th', '6th']) {
    assert.ok((await stat(`server/santa-audio/studio/${file}.flac`)).size > 1000);
  }
  assert.ok((await stat(ffmpeg)).mode & 0o111);
  assert.equal((await call(serverlessHandler, { method: 'GET' })).status, 405);
  assert.equal((await call(serverlessHandler, { origin: 'https://untrusted.test' })).status, 403);
});

test('real FFmpeg: pause-preserving constant gain, repeated name PCM, audible mixed bells, gapless non-clipping MP3', { timeout: 110000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'studio-render-test-'));
  try {
    const paths = {};
    for (const [index, key] of ['name', ...keys].entries()) {
      paths[key] = join(directory, `${key}.wav`);
      // Different exact frequencies, each with a recorded half-second pause.
      await execute(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${320 + index * 110}:duration=1`,
        '-af', 'apad=pad_dur=0.5', '-c:a', 'pcm_s16le', '-n', paths[key]]);
    }
    const { audio, frames, prepared, order } = await renderStudioMessage({
      name: paths.name, choices: paths, directory, signal: AbortSignal.timeout(100000),
    });
    assert.ok(audio.length > 100000);
    assert.equal(frames, order.reduce((sum, source) => sum + prepared.get(source).frames, 0));
    assert.equal(order.filter(source => source === paths.name).length, 2);
    const namePcm = await readFile(prepared.get(paths.name).target);
    assert.equal(namePcm.length / 8 / 48000, 1.5);
    for (let offset = 52800 * 8; offset < namePcm.length; offset += 4) {
      assert.equal(Math.abs(namePcm.readFloatLE(offset)), 0, 'Recorded name pause retained exactly');
    }
    const speech = await readFile(join(directory, 'speech.f32'));
    let cursor = 0;
    for (const source of order) {
      const pcm = await readFile(prepared.get(source).target);
      assert.deepEqual(speech.subarray(cursor, cursor + pcm.length), pcm, 'Exact clip identity/order at every boundary');
      cursor += pcm.length;
    }
    const output = join(directory, 'message.mp3');
    // execFile binary output, not string decoding.
    const decoded = (await execute(ffmpeg, ['-v', 'error', '-i', output,
      '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 80 * 1024 * 1024 })).stdout;
    assert.ok(Math.abs(decoded.length / 8 - frames) <= 3, 'No timeline drift, encoder priming or limiter latency');
    let peak = 0;
    for (let offset = 0; offset < decoded.length; offset += 4) peak = Math.max(peak, Math.abs(decoded.readFloatLE(offset)));
    assert.ok(peak < 0.95, `Decoded peak ${peak}`);
    const firstNameStart = prepared.get(order[0]).frames;
    const quietStart = (firstNameStart + 48000 * 1.2) * 8;
    let bellsEnergy = 0;
    for (let offset = quietStart; offset < quietStart + 4800 * 8; offset += 4) bellsEnergy += decoded.readFloatLE(offset) ** 2;
    assert.ok(bellsEnergy > 0.00001, 'Audible non-zero bells under recorded voice pause');
    const measured = await execute(ffmpeg, ['-hide_banner', '-i', output,
      '-af', 'loudnorm=I=-18:TP=-3:print_format=json', '-f', 'null', '-']);
    const measurements = JSON.parse(measured.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s)[0]);
    assert.ok(Number(measurements.input_tp) < -1.5);
    console.info('Studio MP3 measured (not listened):', { seconds: frames / 48000, peak, truePeak: measurements.input_tp });
    await assert.rejects(prepareStudioClip(paths.name, join(directory, 'too-long.f32'), { maxSeconds: 1 }));
    await writeFile(join(directory, 'broken.wav'), 'not audio');
    await assert.rejects(prepareStudioClip(join(directory, 'broken.wav'), join(directory, 'broken.f32')));
    // Retain only ignored test output for browser's real-decoding regression.
    await writeFile('generated-artifacts/studio-test-message.mp3', audio);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
