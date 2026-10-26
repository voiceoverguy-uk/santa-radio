import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { renderArgs, voiceFilter } from './santa-audio-filters.mjs';

function pcm(args) {
  const result = spawnSync(ffmpeg, ['-v', 'error', '-threads', '1', '-filter_threads', '1',
    ...args, '-c:a', 'pcm_f32le', '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'],
  { timeout: 15000, maxBuffer: 40 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}

test('the MP3 intro and both MP3 outros match the latest uploads; shared preparation retains source duration', async () => {
  const source = 'server/santa-audio';
  // Pin the supplied MP3s without depending on ignored uploads in a clean checkout.
  for (const [segment, hash] of [
    ['intro', '38ed43ef4e99842f48df801c073d50a41826db1b5b59b34829268275bba139dc'],
    ['outro-1', 'c61708db60ea89f299f9eae242ef6ed29a2cc45d6723719900266ff432888ccf'],
    ['outro-2', 'fc169a44dadb6c50ef0bc48b78ec063f38b65a99cbe1b32b90b6ce12dd55edf3'],
  ]) {
    assert.equal(createHash('sha256').update(await readFile(`${source}/free-${segment}.mp3`)).digest('hex'), hash);
    assert.equal(pcm(['-i', `${source}/prepared/${segment}.wav`]).length,
      pcm(['-i', `${source}/free-${segment}.mp3`]).length,
      `${segment}: preparation must not trim or pad the source`);
  }
});

test('all three segments retain leading, internal and trailing silence and join without injected gaps', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'santa-pauses-'));
  try {
    const paths = [];
    const segments = [];
    for (let i = 0; i < 3; i++) {
      const path = join(dir, `${i}.wav`);
      // Distinct pauses on every segment, including the name and outro opening.
      const generated = spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i',
        `aevalsrc=if(between(t\\,0.17\\,0.37)+between(t\\,0.49\\,0.73)\\,0.1*sin(2*PI*${400 + i * 200}*t)\\,0):s=48000:d=1.03`,
        '-c:a', 'pcm_f32le', path], { timeout: 10000 });
      assert.equal(generated.status, 0, generated.stderr?.toString());
      const prepared = pcm(['-i', path, '-af', voiceFilter()]);
      assert.equal(prepared.length, 49440 * 8, 'The entire 1.03-second recording must remain.');
      paths.push(path);
      segments.push(prepared);
    }
    const args = renderArgs(...paths, paths[0], 'pipe:1');
    // Exercise the exact production voice/concat graph before the bells/mix.
    const graph = args[args.indexOf('-filter_complex') + 1].split(';[3:a]')[0];
    const joined = pcm(paths.flatMap(path => ['-i', path]).concat([
      '-filter_complex_threads', '1', '-filter_complex', graph, '-map', '[speech]',
    ]));
    assert.deepEqual(joined, Buffer.concat(segments), 'Joins must be plain sample concatenation.');
    for (let i = 0; i < 3; i++) {
      for (const [start, end] of [[0, 0.16], [0.38, 0.48], [0.74, 1.03]]) {
        const silence = joined.subarray((i * 49440 + Math.round(start * 48000)) * 8,
          (i * 49440 + Math.round(end * 48000)) * 8);
        for (let offset = 0; offset < silence.length; offset += 4) {
          assert.ok(Math.abs(silence.readFloatLE(offset)) < 1e-6, 'Recorded silence must remain in place.');
        }
      }
      assert.ok(Math.abs(joined.readFloatLE((i * 49440 + 12001) * 8)) > 0.001,
        'Speech must still occur at its recorded position.');
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const outro of [1, 2]) test(`lossless shared clips preserve the full outro-${outro} render, pauses and 192k stereo MP3`, { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'santa-equivalence-'));
  try {
    const source = 'server/santa-audio';
    const outputs = [];
    const pcmOutputs = [];
    for (const prepared of [false, true]) {
      const output = join(dir, `${prepared}.mp3`);
      const result = spawnSync(ffmpeg, renderArgs(
        join(source, prepared ? 'prepared/intro.wav' : 'free-intro.mp3'),
        join(source, 'names/arabella.wav'),
        join(source, prepared ? `prepared/outro-${outro}.wav` : `free-outro-${outro}.mp3`),
        join(source, 'sleighbells.mp3'), output, prepared,
      ), { timeout: 15000 });
      assert.equal(result.status, 0, 'Actual MP3 rendering must complete inside 15 seconds.');
      const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', output, '-f', 'f32le', '-'],
        { timeout: 10000, maxBuffer: 40 * 1024 * 1024 });
      assert.equal(decoded.status, 0, 'MP3 must decode completely.');
      outputs.push(decoded.stdout);
      const metadata = spawnSync(ffmpeg, ['-hide_banner', '-i', output], { encoding: 'utf8' }).stderr;
      assert.match(metadata, /44100 Hz, stereo/);
      assert.match(metadata, /192 kb\/s/);
      // Compare the mixer BEFORE MP3's lossy quantisation. Tiny float changes
      // can alter encoder decisions without an actual mixer quality change.
      const pcmArgs = renderArgs(
        join(source, prepared ? 'prepared/intro.wav' : 'free-intro.mp3'),
        join(source, 'names/arabella.wav'),
        join(source, prepared ? `prepared/outro-${outro}.wav` : `free-outro-${outro}.mp3`),
        join(source, 'sleighbells.mp3'), 'pipe:1', prepared);
      pcmArgs[pcmArgs.indexOf('libmp3lame')] = 'pcm_f32le';
      pcmArgs[pcmArgs.indexOf('44100')] = '48000';
      pcmArgs.splice(pcmArgs.length - 1, 0, '-f', 'f32le');
      const pcm = spawnSync(ffmpeg, pcmArgs, { timeout: 15000, maxBuffer: 40 * 1024 * 1024 });
      assert.equal(pcm.status, 0);
      pcmOutputs.push(pcm.stdout);
    }
    const [reference, prepared] = outputs;
    assert.equal(prepared.length, reference.length, 'Every sample, including editorial pauses, must remain.');
    assert.equal(pcmOutputs[0].length, pcmOutputs[1].length);
    const sourceLength = ['free-intro.mp3', 'names/arabella.wav', `free-outro-${outro}.mp3`]
      .reduce((sum, path) => sum + pcm(['-i', join(source, path)]).length, 0);
    assert.equal(pcmOutputs[0].length, sourceLength, 'Mixed duration must equal the three complete source recordings.');
    let errorEnergy = 0, referenceEnergy = 0, peak = 0;
    for (let i = 0; i < pcmOutputs[0].length; i += 4) {
      const a = pcmOutputs[0].readFloatLE(i), b = pcmOutputs[1].readFloatLE(i);
      errorEnergy += (a - b) ** 2; referenceEnergy += a ** 2;
      peak = Math.max(peak, Math.abs(b));
    }
    assert.ok(10 * Math.log10(errorEnergy / referenceEnergy) < -100, 'The mixer waveform must be unchanged apart from float rounding.');
    assert.ok(peak < 0.89, 'Peak limiter must still protect the mixed message.');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a rendering deadline kills the audio worker, not just its wrapper', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'santa-deadline-'));
  try {
    let pid;
    const error = await new Promise(resolve => {
      const child = execFile(ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi',
        '-i', 'anullsrc', '-f', 'null', '-'],
      { timeout: 200, killSignal: 'SIGKILL' }, resolve);
      pid = child.pid;
    });
    assert.equal(error.signal, 'SIGKILL');
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
