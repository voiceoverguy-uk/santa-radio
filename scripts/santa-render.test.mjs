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

test('free-message sleigh bells receive 6 dB gain after their existing level control', () => {
  const args = renderArgs('intro', 'name', 'outro', 'bells', 'output');
  const graph = args[args.indexOf('-filter_complex') + 1];
  const bells = graph.slice(graph.indexOf('[3:a]'), graph.indexOf(';[speech]'));
  assert.match(bells, /loudnorm=I=-34:TP=-9:LRA=7,volume=6dB,aresample=48000,afade=t=in:d=1\[bells\]/);
});

test('free bell source is the exact approved loop; repeated MP3 decoding introduces no padding or join spike', async () => {
  const file = 'server/santa-audio/sleighbells.mp3';
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),
    'f722fcae19445dc47a24cbf12b689a1e44e59c6c69c818428b8bef393c47e347');
  // Compare at the source rate before resampling/normalisation, including every
  // sample across eight repeat boundaries. No bell trimming/crossfade is needed.
  const decode = loops => {
    const result = spawnSync(ffmpeg, ['-v', 'error', '-stream_loop', String(loops),
      '-i', file, '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr?.toString());
    return result.stdout;
  };
  const single = decode(0), repeated = decode(8);
  assert.equal(single.length / 4, 95852);
  assert.deepEqual(repeated, Buffer.concat(Array(9).fill(single)),
    'Looping must preserve the exact supplied decoded samples, not insert encoder padding.');
  let maxStep = 0;
  for (let i = 4; i < single.length; i += 4) {
    maxStep = Math.max(maxStep, Math.abs(single.readFloatLE(i) - single.readFloatLE(i - 4)));
  }
  const joinStep = Math.abs(single.readFloatLE(single.length - 4) - single.readFloatLE(0));
  assert.ok(joinStep < maxStep, `Repeat step ${joinStep} is below existing source transients ${maxStep}`);
});

test('free mixer preserves every voice sample at +1 second, with a continuous bed and bells-only tail fade', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'free-mix-timing-'));
  try {
    const paths = [], segments = [];
    for (let i = 0; i < 3; i++) {
      const path = join(dir, `${i}.wav`);
      // Long silent intervals span multiple bell joins. The final clip ends in
      // sound so a voice fade or loss of the last samples cannot pass unnoticed.
      const result = spawnSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i',
        `aevalsrc=if(between(t\\,0.17\\,0.7)+gte(t\\,4.5)\\,0.05*sin(2*PI*${440 + i * 100}*t)\\,0):s=48000:d=5.17`,
        '-c:a', 'pcm_f32le', path]);
      assert.equal(result.status, 0, result.stderr?.toString());
      paths.push(path);
      segments.push(pcm(['-i', path, '-af', voiceFilter()]));
    }
    const args = renderArgs(...paths, 'server/santa-audio/sleighbells.mp3', 'unused');
    const at = args.indexOf('-filter_complex'), inputs = args.slice(0, at);
    const graph = args[at + 1];
    const runGraph = filter => pcm([...inputs, '-filter_complex', filter, '-map', '[out]']);
    const voiceGraph = graph.split(';[voice]')[0] +
      ';[voice]adelay=48000S:all=1,apad=pad_len=48000[out]';
    const speech = pcm([...inputs.slice(0, inputs.indexOf('-stream_loop')), '-filter_complex',
      voiceGraph, '-map', '[out]']);
    const pad = Buffer.alloc(48000 * 8);
    const expectedSpeech = Buffer.concat([pad, ...segments, pad]);
    assert.equal(speech.length, expectedSpeech.length);
    let voiceError = 0;
    for (let i = 0; i < speech.length; i += 4) {
      voiceError = Math.max(voiceError, Math.abs(speech.readFloatLE(i) - expectedSpeech.readFloatLE(i)));
    }
    assert.ok(voiceError < 1e-7,
      `Complete recordings and pauses have exactly one second on each side; max sample error ${voiceError}`);
    const bed = runGraph(graph.replace('[speech][bells]amix=', '[speech]volume=0[silent];[silent][bells]amix='));
    const mixed = runGraph(graph);
    assert.equal(bed.length, speech.length);
    assert.equal(mixed.length, speech.length, 'Limiter must compensate latency and retain the full ending.');
    let error = 0, peak = 0;
    for (let i = 0; i < mixed.length; i += 4) {
      error += (mixed.readFloatLE(i) - speech.readFloatLE(i) - bed.readFloatLE(i)) ** 2;
      peak = Math.max(peak, Math.abs(mixed.readFloatLE(i)));
    }
    assert.ok(error < 1e-8, `Voice unchanged throughout, including the final second: ${error}`);
    assert.ok(peak < 0.89);
    // Independently render the unchanged level-control branch, then calculate
    // the requested two bell envelopes sample-for-sample.
    const rawBellBranch = graph.split(';').find(branch => branch.startsWith('[3:a]'))
      .replace(',afade=t=in:d=1[bells]', '[out]');
    const seconds = speech.length / 8 / 48000;
    const raw = pcm([...inputs.slice(inputs.indexOf('-stream_loop')),
      '-af', rawBellBranch.replace('[3:a]', '').replace('[out]', ''), '-t', String(seconds + 1)]);
    const previous = pcm([...inputs.slice(inputs.indexOf('-stream_loop')),
      '-af', rawBellBranch.replace('[3:a]', '').replace('[out]', '').replace('volume=6dB', 'volume=4dB'),
      '-t', String(seconds + 1)]);
    let oldEnergy = 0, newEnergy = 0, gainError = 0;
    for (let i = 0; i < raw.length; i += 4) {
      const before = previous.readFloatLE(i), after = raw.readFloatLE(i);
      oldEnergy += before ** 2; newEnergy += after ** 2;
      gainError += (after - before * 10 ** (2 / 20)) ** 2;
    }
    assert.ok(Math.abs(10 * Math.log10(newEnergy / oldEnergy) - 2) < 0.00001);
    assert.ok(gainError / newEnergy < 1e-12, 'Exactly +2 dB on isolated bells before shared limiting');
    let envelopeError = 0;
    const frames = speech.length / 8;
    for (let i = 0; i < bed.length; i += 4) {
      const frame = Math.floor(i / 8);
      const fade = Math.min(1, frame / 48000) * Math.min(1, (frames - 1 - frame) / 48000);
      envelopeError += (bed.readFloatLE(i) - raw.readFloatLE(i) * fade) ** 2;
    }
    assert.ok(envelopeError < 1e-8, 'Exactly one-second fade at each end on bells, not on speech.');
    // 10 ms RMS windows catch gaps, including every join, while voice is silent.
    let minRms = Infinity;
    for (let start = 48000; start + 480 < frames - 48000; start += 480) {
      let energy = 0;
      for (let frame = start; frame < start + 480; frame++) energy += bed.readFloatLE(frame * 8) ** 2;
      minRms = Math.min(minRms, Math.sqrt(energy / 480));
    }
    assert.ok(minRms > 10 ** (-55 / 20), `No silent bell windows through speech pauses or repeats: ${minRms}`);
    const limited = runGraph(graph.replace('[speech][bells]amix=', '[speech]volume=20[hot];[hot][bells]amix='));
    let limitedPeak = 0;
    for (let i = 0; i < limited.length; i += 4) limitedPeak = Math.max(limitedPeak, Math.abs(limited.readFloatLE(i)));
    assert.equal(limited.length, speech.length);
    assert.ok(limitedPeak <= 0.890001, 'Existing peak protection still caps an overloaded mix.');
    console.info('[free-bells automated]', { seconds, voiceOffsetSeconds: 1,
      min10msRmsDb: 20 * Math.log10(minRms), peak, envelopeError });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Studio real mixer: exact delayed speech, bells raised from +4 to +6 dB, complete ending and fades', async () => {
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
    assert.match(bellBranch, /loudnorm=I=-34:TP=-9:LRA=7,volume=6dB,/);
    const delayed = pcm([...inputs.slice(0, inputs.indexOf('-stream_loop')),
      '-af', voiceBranch.replace('[0:a]', '').replace('[speech]', '')]);
    assert.deepEqual(delayed, Buffer.concat([Buffer.alloc(48000 * 8), speech]),
      'Exactly one second on both channels, then every original voice sample and pause unchanged');
    const seconds = delayed.length / 8 / 48000;
    const bells = [];
    for (const branch of [bellBranch.replace('volume=6dB,', 'volume=4dB,'), bellBranch]) {
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
    assert.ok(gainError / newEnergy < 1e-12, 'A further constant +2 dB over the previous +4 dB bell track');
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

test('the MP3 intro and all MP3 outros match the latest uploads; shared preparation retains source duration', async () => {
  const source = 'server/santa-audio';
  // Pin the supplied MP3s without depending on ignored uploads in a clean checkout.
  for (const [segment, hash] of [
    ['intro', '38ed43ef4e99842f48df801c073d50a41826db1b5b59b34829268275bba139dc'],
    ['outro-1', '8fbda6ab90ffd876002e8e5fc35a3a7181c2f3c712ede56e4be2dfa8a31de0fd'],
    ['outro-2', '3743e05263780e357e2907f5a70790f57cd700272b84d9f7b4641ea0e80a597e'],
    ['outro-nov', '74af54f53ddb31cf137e3b091002cc0ff86aa465cb27e26f898d0407cf13011b'],
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
    const graph = args[args.indexOf('-filter_complex') + 1].split(';[voice]')[0];
    const joined = pcm(paths.flatMap(path => ['-i', path]).concat([
      '-filter_complex_threads', '1', '-filter_complex', graph, '-map', '[voice]',
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

for (const outro of [1, 2, 'nov']) test(`lossless shared clips preserve the full outro-${outro} render, pauses and 192k stereo MP3`, { timeout: 30000 }, async () => {
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
    assert.equal(pcmOutputs[0].length, sourceLength + 2 * 48000 * 8,
      'Mixed duration must equal the three complete source recordings plus exactly two seconds.');
    assert.ok(Math.abs(reference.length / 8 - (sourceLength / 8 + 96000) * 44100 / 48000) <= 2,
      'Decoded MP3 retains the full padded duration, within resampling rounding.');
    for (const decoded of outputs) {
      let decodedPeak = 0;
      for (let i = 0; i < decoded.length; i += 4) {
        const sample = decoded.readFloatLE(i);
        assert.ok(Number.isFinite(sample), 'MP3 decodes to finite audio throughout.');
        decodedPeak = Math.max(decodedPeak, Math.abs(sample));
      }
      assert.ok(decodedPeak < 1, `Lossy MP3 output remains unclipped: ${decodedPeak}`);
    }
    let errorEnergy = 0, referenceEnergy = 0, peak = 0;
    for (let i = 0; i < pcmOutputs[0].length; i += 4) {
      const a = pcmOutputs[0].readFloatLE(i), b = pcmOutputs[1].readFloatLE(i);
      errorEnergy += (a - b) ** 2; referenceEnergy += a ** 2;
      peak = Math.max(peak, Math.abs(b));
    }
    const differenceDb = 10 * Math.log10(errorEnergy / referenceEnergy);
    assert.ok(differenceDb < -100, `The mixer waveform must be unchanged apart from float rounding: ${differenceDb} dB`);
    assert.ok(peak < 0.89, 'Peak limiter must still protect the mixed message.');
    console.info('[free-bells automated real ending]', { outro,
      seconds: pcmOutputs[0].length / 8 / 48000, preparedDifferenceDb: differenceDb, peak });
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
