import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import { createAuditionMiddleware, auditionPath } from '../server/studio-reverb-audition.js';
import { renderStudioAudition, warmRoomImpulse, auditionTailSeconds } from '../server/studio-reverb-audition-render.js';

const execute = promisify(execFile);

async function withServer(options, action) {
  const middleware = createAuditionMiddleware(options);
  const server = createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }); }
}

test('audition fails closed by default and outside development, without rendering', async () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const environment of ['development', 'production', 'test']) {
      process.env.NODE_ENV = environment;
      for (const development of [false, true]) {
        if (development && environment === 'development') continue;
        await withServer({ development, render: () => assert.fail('Must not render') }, async base => {
          for (const path of [auditionPath, `${auditionPath}/anything/original.mp3`]) {
            const response = await fetch(base + path);
            assert.equal(response.status, 404);
            assert.match(response.headers.get('cache-control'), /private, no-store/);
          }
        });
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('private exact allowlist, no autoplay/source disclosure, single-flight, HEAD, ranges and retry', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let calls = 0;
  try {
    await withServer({ development: true, render: async () => {
      calls++;
      if (calls === 1) throw new Error('/private/recording.flac https://private.invalid');
      return { samples: { original: Buffer.from('original'), reverb: Buffer.from('reverb') } };
    } }, async base => {
      const page = await fetch(base + auditionPath);
      const html = await page.text();
      const sources = [...html.matchAll(/src="([^"]+\.mp3)"/g)].map(match => match[1]);
      assert.equal(sources.length, 2);
      assert.equal(calls, 0, 'No rendering or preloading on entry');
      assert.match(html, />Original</);
      assert.match(html, />Subtle reverb</);
      assert.doesNotMatch(html, /autoplay|https?:|\.flac|\/server|catalogue|child/i);
      assert.match(page.headers.get('x-robots-tag'), /noindex/);
      assert.match(page.headers.get('content-security-policy'), /media-src 'self'/);
      assert.equal((await fetch(base + sources[0], { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
      assert.equal((await fetch(base + auditionPath, { method: 'POST' })).status, 405);
      const failed = await fetch(base + sources[0]);
      assert.equal(failed.status, 503);
      assert.doesNotMatch(await failed.text(), /private|flac|https/);
      const responses = await Promise.all(sources.map(source => fetch(base + source)));
      assert.equal(calls, 2, 'One retry prepares both variants together');
      assert.deepEqual(await Promise.all(responses.map(response => response.text())), ['original', 'reverb']);
      const head = await fetch(base + sources[0], { method: 'HEAD' });
      assert.equal(head.headers.get('content-length'), '8');
      assert.equal(await head.text(), '');
      for (const [range, expected] of [['bytes=1-3', 'rig'], ['bytes=-3', 'nal'], ['bytes=6-', 'al']]) {
        const response = await fetch(base + sources[0], { headers: { range } });
        assert.equal(response.status, 206);
        assert.equal(await response.text(), expected);
      }
      for (const range of ['bytes=100-', 'bytes=-', 'bytes=2-1', 'bytes=0-1,3-4']) {
        assert.equal((await fetch(base + sources[0], { headers: { range } })).status, 416);
      }
      for (const path of ['/original.mp3', '/../6th.flac', '/token/other.mp3']) {
        assert.equal((await fetch(base + auditionPath + path)).status, 404);
      }
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('real fixed audition: matched MP3 levels, no clipping, dense finite room tail and temporary cleanup', { timeout: 90000 }, async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const source = 'server/santa-audio/studio/6th.flac';
  const hash = async () => createHash('sha256').update(await readFile(source)).digest('hex');
  const beforeHash = await hash();
  const beforeDirectories = (await readdir(tmpdir())).filter(name => name.startsWith('studio-audition-'));
  const directory = await mkdtemp(join(tmpdir(), 'audition-check-'));
  try {
    const { samples, seconds } = await renderStudioAudition();
    const levels = {};
    const decoded = {};
    for (const [variant, audio] of Object.entries(samples)) {
      const output = join(directory, `${variant}.mp3`);
      await writeFile(output, audio);
      const result = await execute(ffmpeg, ['-hide_banner', '-i', output,
        '-af', 'loudnorm=I=-18:TP=-3:print_format=json', '-f', 'null', '-']);
      levels[variant] = JSON.parse(result.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s)[0]);
      const { stdout, stderr } = await execute(ffmpeg, ['-v', 'error', '-xerror', '-i', output,
        '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 30 * 1024 * 1024 });
      assert.equal(stderr.length, 0);
      decoded[variant] = stdout;
      assert.ok(Math.abs(stdout.length / 8 / 48000 - seconds) < 0.001);
      let peak = 0;
      for (let offset = 0; offset < stdout.length; offset += 4) {
        const sample = stdout.readFloatLE(offset);
        assert.ok(Number.isFinite(sample));
        peak = Math.max(peak, Math.abs(sample));
      }
      assert.ok(peak < 0.95, `${variant} decoded peak ${peak}`);
      assert.ok(Number(levels[variant].input_tp) < -1.5);
      // Mix fade reaches silence rather than cutting off the bells or room.
      const end = stdout.subarray(-480 * 8);
      let endPeak = 0;
      for (let offset = 0; offset < end.length; offset += 4) endPeak = Math.max(endPeak, Math.abs(end.readFloatLE(offset)));
      assert.ok(endPeak < 0.002, `${variant} final 10 ms peak ${endPeak}`);
    }
    assert.ok(Math.abs(Number(levels.original.input_i) - Number(levels.reverb.input_i)) < 0.5);
    assert.equal(decoded.original.length, decoded.reverb.length);
    assert.notDeepEqual(samples.original, samples.reverb);
    const impulse = warmRoomImpulse();
    assert.deepEqual(impulse, warmRoomImpulse(), 'Repeatable effect');
    let lateEnergy = 0;
    for (let offset = Math.round(48000 * 0.6) * 8; offset < impulse.length; offset += 4) lateEnergy += impulse.readFloatLE(offset) ** 2;
    assert.ok(lateEnergy < 0.000002, 'Room has already decayed before end fade');
    assert.ok(auditionTailSeconds > impulse.length / 8 / 48000);
    assert.equal(await hash(), beforeHash, 'Source untouched');
    assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith('studio-audition-')), beforeDirectories);
    console.info('Audition measured, not listened:', { seconds, levels, lateEnergy });
  } finally {
    await rm(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
