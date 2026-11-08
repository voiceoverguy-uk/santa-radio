import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { studioBells, renderStudioMessage } from '../server/santa-studio-render.js';

const provenance = JSON.parse(readFileSync('server/santa-audio/studio/sources.json'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('verified private Studio assets retain their hashes, native properties and decoded samples', () => {
  assert.equal(provenance.recordings.length, 9);
  for (const recording of provenance.recordings) {
    const file = `server/santa-audio/${recording.packaged.path}`;
    assert.equal(sha256(readFileSync(file)), recording.packaged.sha256, file);
    const pcm = execFileSync(ffmpeg, ['-v', 'error',
      ...(file.endsWith('.mp3') ? ['-c:a', 'mp3'] : []),
      '-i', file, '-map', '0:a:0', '-c:a', 'pcm_s32le', '-f', 's32le', '-'],
    { maxBuffer: 30 * 1024 * 1024, timeout: 20000 });
    assert.equal(sha256(pcm), recording.source.pcmS32leSha256, file);
    assert.equal(pcm.length / 4 / recording.source.channels, recording.source.frames, file);
    // ffmpeg's output header confirms native properties without a system ffprobe dependency.
    const decoded = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-f', 'null', '-'],
      { encoding: 'utf8', timeout: 20000 });
    assert.equal(decoded.status, 0, decoded.stderr);
    assert.match(decoded.stderr, new RegExp(`${recording.source.sampleRate} Hz, ${recording.source.channels === 1 ? 'mono' : 'stereo'}`));
  }
  assert.match(studioBells, /santa-audio\/studio\/sleigh-bells\.mp3$/);
  // freeMakerBellsSha256 is the historical free-maker source at the time of
  // this Studio inventory, not a requirement to freeze the website's audio.
  // Keep every Studio byte/decoded-sample check above; pin each free path here.
  assert.equal(sha256(readFileSync('server/santa-audio/sleighbells.mp3')),
    'f722fcae19445dc47a24cbf12b689a1e44e59c6c69c818428b8bef393c47e347');
  assert.equal(sha256(readFileSync('server/santa-audio/mobile-free-sleighbells.mp3')),
    '0896b5c703b2c4b335db5e43ea3894fc34b22c5e1f7f87281edc8017f764e541');
});

for (const withTalent of [false, true]) {
  test(`refreshed fixed speech renders with synthetic choices, Talent ${withTalent ? 'selected' : 'skipped'}`,
    { timeout: 110000 }, async () => {
      const directory = mkdtempSync(join(tmpdir(), 'studio-source-check-'));
      try {
        const fixture = join(directory, 'synthetic.wav');
        execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i',
          'sine=frequency=420:duration=0.5', '-c:a', 'pcm_s16le', fixture]);
        const choices = Object.fromEntries(['age', 'activity', 'achievement', 'treat', 'place']
          .map(key => [key, fixture]));
        if (withTalent) choices.talent = fixture;
        const result = await renderStudioMessage({ name: fixture, choices, directory,
          signal: AbortSignal.timeout(100000) });
        assert.ok(result.audio.length > 100000 && result.audio.length <= 4_400_000);
        assert.equal(result.order.some(path => path.endsWith('/1-5.flac')), withTalent);
        assert.equal(result.order.length, withTalent ? 16 : 14);
        const ending = result.order.at(-1);
        assert.ok(ending.endsWith('/studio/6th.flac'));
        const endingPcm = readFileSync(result.prepared.get(ending).target);
        const speech = readFileSync(join(directory, 'speech.f32'));
        assert.deepEqual(speech.subarray(-endingPcm.length), endingPcm,
          'New messages end with the complete prepared sixth recording');
        const pcm = execFileSync(ffmpeg, ['-v', 'error', '-i', join(directory, 'message.mp3'),
          '-ar', '48000', '-ac', '2', '-f', 'f32le', '-'],
        { maxBuffer: 90 * 1024 * 1024, timeout: 20000 });
        assert.ok(Math.abs(pcm.length / 8 - result.renderedFrames) <= 3);
        let peak = 0;
        for (let offset = 0; offset < pcm.length; offset += 4) {
          const sample = pcm.readFloatLE(offset);
          assert.ok(Number.isFinite(sample));
          peak = Math.max(peak, Math.abs(sample));
        }
        assert.ok(peak < 0.95, `Decoded peak ${peak}`);
        console.info('Automated render, not listening verification:', {
          talent: withTalent, seconds: result.renderedFrames / 48000, peak,
        });
      } finally { rmSync(directory, { recursive: true, force: true }); }
    });
}
