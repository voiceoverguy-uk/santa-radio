import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { renderArgs } from './santa-audio-filters.mjs';

test('lossless shared clips preserve the full render, padding and 192k stereo MP3', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'santa-equivalence-'));
  try {
    const source = 'server/santa-audio';
    const outputs = [];
    const pcmOutputs = [];
    for (const prepared of [false, true]) {
      const output = join(dir, `${prepared}.mp3`);
      const result = spawnSync(ffmpeg, renderArgs(
        join(source, prepared ? 'prepared/intro.wav' : 'free-intro.wav'),
        join(source, 'names/arabella.wav'),
        join(source, prepared ? 'prepared/outro.wav' : 'free-outro.wav'),
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
        join(source, prepared ? 'prepared/intro.wav' : 'free-intro.wav'),
        join(source, 'names/arabella.wav'),
        join(source, prepared ? 'prepared/outro.wav' : 'free-outro.wav'),
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
