import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { renderArgs, voiceFilter } from './santa-audio-filters.mjs';
import { studioMixArgs, studioBells } from '../server/santa-studio-render.js';

function pcm(args) {
  const result = spawnSync(ffmpeg, ['-v', 'error', '-threads', '1', '-filter_threads', '1',
    ...args, '-c:a', 'pcm_f32le', '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'],
  { timeout: 15000, maxBuffer: 40 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}

test('free-message sleigh bells receive 4 dB gain after their existing level control', () => {
  const args = renderArgs('intro', 'name', 'outro', 'bells', 'output');
  const graph = args[args.indexOf('-filter_complex') + 1];
  const bells = graph.slice(graph.indexOf('[3:a]'), graph.indexOf(';[speech]'));
  assert.match(bells, /loudnorm=I=-34:TP=-9:LRA=7,volume=4dB,aresample=48000,afade=t=in:d=1\[bells\]/);
});

test('Studio real mixer: exact delayed speech, bells raised from +2 to +4 dB, complete ending and fades', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-mix-timing-'));
  try {
    const voice = join(dir, 'voice.f32');
    // Leading/internal pauses and a non-silent final sample expose trimming.
    const speech = pcm(['-f', 'lavfi', '-i',
      'aevalsrc=if(between(t\\,0.17\\,0.9)+gte(t\\,1.4)\\,0.12*sin(2*PI*440*t)\\,0):s=48000:d=3.17']);
    await writeFile(voice, speech);
    const args = studioMixArgs(voice, studioBells, 'unused.mp3');
    const graphIndex = args.indexOf('-filter_complex');
    const inputs = args.slice(0, graphIndex);
    const [voiceBranch, bellBranch, mixBranch] = args[graphIndex + 1].split(';');
    assert.match(bellBranch, /loudnorm=I=-34:TP=-9:LRA=7,volume=4dB,/);
    const delayed = pcm([...inputs.slice(0, inputs.indexOf('-stream_loop')),
      '-af', voiceBranch.replace('[0:a]', '').replace('[speech]', '')]);
    assert.deepEqual(delayed, Buffer.concat([Buffer.alloc(48000 * 8), speech]),
      'Exactly one second on both channels, then every original voice sample and pause unchanged');
    const seconds = delayed.length / 8 / 48000;
    const bells = [];
    for (const branch of [bellBranch.replace('volume=4dB,', 'volume=2dB,'), bellBranch]) {
      // Exercise the production branch before the shared peak limiter.
      // Decode beyond the speech duration to allow for the MP3's timestamp
      // offset, then compare exactly the PCM frames consumed by amix.
      const decoded = pcm([...inputs.slice(inputs.indexOf('-stream_loop')),
        '-af', branch.replace('[1:a]', '').replace('[bells]', ''), '-t', String(seconds + 1)]);
      assert.ok(decoded.length >= delayed.length);
      bells.push(decoded.subarray(0, delayed.length));
    }
    assert.equal(bells[0].length, delayed.length);
    assert.equal(bells[1].length, delayed.length);
    let oldEnergy = 0, newEnergy = 0, gainError = 0, leadEnergy = 0;
    const ratio = 10 ** (2 / 20);
    for (let i = 0; i < bells[0].length; i += 4) {
      const before = bells[0].readFloatLE(i), after = bells[1].readFloatLE(i);
      oldEnergy += before ** 2; newEnergy += after ** 2;
      gainError += (after - before * ratio) ** 2;
      if (i < 48000 * 8) leadEnergy += after ** 2;
    }
    assert.ok(Math.abs(10 * Math.log10(newEnergy / oldEnergy) - 2) < 0.00001);
    assert.ok(gainError / newEnergy < 1e-12, 'A further constant +2 dB over the previous +2 dB bell track');
    assert.ok(leadEnergy > 0.001, 'Bells play during the voice-free first second');
    const prePeak = pcm([...inputs, '-filter_complex',
      `${voiceBranch};${bellBranch};${mixBranch.split(',areverse')[0]}[out]`, '-map', '[out]']);
    const mixed = pcm([...inputs, '-filter_complex', args[graphIndex + 1], '-map', '[out]']);
    assert.equal(prePeak.length, delayed.length);
    assert.equal(mixed.length, delayed.length, 'The complete speech ending survives the final fade and limiter');
    let mixError = 0, fadeError = 0, peak = 0;
    for (let i = 0; i < mixed.length; i += 4) {
      const sum = delayed.readFloatLE(i) + bells[1].readFloatLE(i);
      mixError += (prePeak.readFloatLE(i) - sum) ** 2;
      // The existing reverse one-second fade must move with the full ending.
      const frame = Math.floor(i / 8), total = mixed.length / 8;
      const fade = Math.min(1, (total - 1 - frame) / 48000);
      fadeError += (mixed.readFloatLE(i) - sum * fade) ** 2;
      peak = Math.max(peak, Math.abs(mixed.readFloatLE(i)));
    }
    assert.ok(mixError < 1e-9, 'No voice gain change in the mix before shared peak protection');
    assert.ok(fadeError < 1e-8, 'Existing fades retained, no truncation, no limiter latency');
    assert.ok(peak < 0.89);
    assert.ok(Math.abs(mixed.readFloatLE(mixed.length - 4)) < 1e-6, 'Clean faded endpoint');
    const hotSpeech = Buffer.from(speech);
    for (let i = 0; i < hotSpeech.length; i += 4) hotSpeech.writeFloatLE(hotSpeech.readFloatLE(i) * 20, i);
    await writeFile(voice, hotSpeech);
    const limited = pcm([...inputs, '-filter_complex', args[graphIndex + 1], '-map', '[out]']);
    let limitedPeak = 0;
    for (let i = 0; i < limited.length; i += 4) limitedPeak = Math.max(limitedPeak, Math.abs(limited.readFloatLE(i)));
    assert.equal(limited.length, delayed.length, 'Peak protection adds no latency or truncation');
    assert.ok(limitedPeak <= 0.890001, `Shared limiter protects deliberately overloaded mix: ${limitedPeak}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Studio maximum 175-second speech still fits unchanged MP3 byte limits with its extra second', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studio-max-duration-'));
  try {
    const voice = join(dir, 'voice.f32'), output = join(dir, 'message.mp3');
    const source = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i',
      'sine=frequency=440:duration=175', '-ar', '48000', '-ac', '2',
      '-c:a', 'pcm_f32le', '-f', 'f32le', voice], { timeout: 10000 });
    assert.equal(source.status, 0, source.stderr?.toString());
    const result = spawnSync(ffmpeg, studioMixArgs(voice, studioBells, output),
      { timeout: 20000 });
    assert.equal(result.status, 0, result.stderr?.toString());
    assert.ok((await stat(output)).size < 4_400_000, 'Server and browser byte safeguards need no increase');
    const decoded = spawnSync(ffmpeg, ['-hide_banner', '-i', output, '-f', 'null', '-'],
      { timeout: 10000, encoding: 'utf8' });
    assert.equal(decoded.status, 0);
    assert.match(decoded.stderr, /time=00:02:56\.00/, 'The full maximum-length speech plus lead-in decodes');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the MP3 intro and both MP3 outros match the latest uploads; shared preparation retains source duration', async () => {
  const source = 'server/santa-audio';
  // Pin the supplied MP3s without depending on ignored uploads in a clean checkout.
  for (const [segment, hash] of [
    ['intro', '38ed43ef4e99842f48df801c073d50a41826db1b5b59b34829268275bba139dc'],
    ['outro-1', '8fbda6ab90ffd876002e8e5fc35a3a7181c2f3c712ede56e4be2dfa8a31de0fd'],
    ['outro-2', '3743e05263780e357e2907f5a70790f57cd700272b84d9f7b4641ea0e80a597e'],
  ]) {
    assert.equal(createHash('sha256').update(await readFile(`${source}/free-${segment}.mp3`)).digest('hex'), hash);
    assert.equal(pcm(['-i', `${source}/prepared/${segment}.wav`]).length,
      pcm(['-i', `${source}/free-${segment}.mp3`]).length,
      `${segment}: preparation must not trim or pad the source`);
    assert.deepEqual(pcm(['-i', `${source}/prepared/${segment}.wav`]),
      pcm(['-i', `${source}/free-${segment}.mp3`, '-af', voiceFilter()]),
      `${segment}: prepared samples must match the current source and unchanged processing`);
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
