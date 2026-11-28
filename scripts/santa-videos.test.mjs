import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { outputDuration, stitchArguments } from '../src/santa-videos/arguments.js';

test('preserves the full clip and extends it for longer MP3s; bounds duration', () => {
  assert.equal(outputDuration(3), 102.24);
  assert.equal(outputDuration(120), 120);
  for (const duration of [0, -1, NaN, Infinity, 601]) assert.throws(() => outputDuration(duration));
});

test('mixes both audio tracks while looping only the picture', () => {
  const directory = mkdtempSync(join(tmpdir(), 'santa-video-audio-'));
  const run = args => execFileSync(ffmpeg, ['-v', 'error', ...args], { cwd: directory });
  try {
    run(['-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=25:d=1', '-f', 'lavfi', '-i', 'sine=frequency=200:duration=1', '-c:v', 'libx264', '-c:a', 'aac', 'source.mp4']);
    run(['-f', 'lavfi', '-i', 'sine=frequency=800:duration=3', 'audio.mp3']);
    run(stitchArguments(3, false));
    function amplitude(start, frequency) {
      const pcm = run(['-ss', String(start), '-i', 'output.mp4', '-t', '0.4', '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1']);
      let real = 0, imaginary = 0;
      for (let i = 0; i < pcm.length / 4; i++) {
        const sample = pcm.readFloatLE(i * 4), angle = 2 * Math.PI * frequency * i / 8000;
        real += sample * Math.cos(angle); imaginary += sample * Math.sin(angle);
      }
      return 2 * Math.hypot(real, imaginary) / (pcm.length / 4);
    }
    assert.ok(amplitude(0.2, 200) > 0.06, 'Santa/source audio is audible');
    assert.ok(amplitude(0.2, 800) > 0.06, 'uploaded MP3 is audible at the same time');
    assert.ok(amplitude(2, 800) > 0.06, 'uploaded MP3 continues');
    assert.ok(amplitude(2, 200) < 0.005, 'original greeting does not repeat when picture loops');
    run(['-ss', '101', '-i', 'output.mp4', '-frames:v', '1', '-f', 'null', '-']);
    run(['-f', 'lavfi', '-i', 'sine=frequency=1000:duration=0.5', 'bells.mp3']);
    run(stitchArguments(110));
    assert.ok(amplitude(0.2, 200) > 0.06, 'Santa is still audible with bells enabled');
    assert.ok(amplitude(0.2, 800) > 0.06, 'uploaded MP3 is still audible with bells enabled');
    assert.ok(amplitude(50, 1000) > 0.01, 'bells continue after the source audio ends');
    assert.ok(amplitude(109.1, 1000) > 0.01, 'bells continue beyond the original video through the final second');
    assert.ok(amplitude(50, 200) < 0.005, 'looping bells do not repeat Santa’s hello');
    run(['-f', 'lavfi', '-i', 'color=c=blue:s=64x64:d=1', '-frames:v', '1', 'name.png']);
    run(['-f', 'lavfi', '-i', 'color=c=blue:s=64x64:d=1', '-frames:v', '1', 'name-second.png']);
    run(stitchArguments(3, false, true));
    function pixelAt(time) {
      return run(['-ss', String(time), '-i', 'output.mp4', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']).subarray(0, 3);
    }
    for (const time of [10.9, 17.08, 83.9, 90.08]) {
      const pixel = pixelAt(time); assert.ok(pixel[0] > 200 && pixel[2] < 30, `no caption at ${time}s`);
    }
    for (const time of [11.08, 16.92, 84.08, 89.92]) {
      const pixel = pixelAt(time); assert.ok(pixel[2] > 200 && pixel[0] < 30, `caption visible at ${time}s`);
    }
    run(['-f', 'lavfi', '-i', 'color=c=lime:s=64x64:d=1', '-frames:v', '1', 'age.png']);
    for (const bells of [false, true]) for (const name of [false, true]) {
      run(stitchArguments(3, bells, name, true));
      for (const time of [17, 20, 23.96]) {
        const pixel = pixelAt(time); assert.ok(pixel[1] > 200 && pixel[0] < 30, `age visible at ${time}s, bells=${bells}, name=${name}`);
      }
      for (const time of [16.96, 24]) {
        const pixel = pixelAt(time); assert.ok(pixel[1] < 50, `age absent at ${time}s`);
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('averages completed timings and bounds saved history', async () => {
  const { validHistory, averageTimes } = await import('../src/santa-videos/history.js');
  const rows = validHistory([
    { name: 'one.mp3', bells: true, stitchingMs: 2000, totalMs: 10000 },
    { name: 'two.mp3', bells: false, stitchingMs: 4000, totalMs: 6000 },
    { name: 'broken.mp3', bells: true, stitchingMs: -1, totalMs: 100 },
    { name: 'invalid.mp3', bells: true, stitchingMs: 500, totalMs: 100 },
  ]);
  assert.deepEqual(averageTimes(rows), { count: 2, stitchingMs: 3000, totalMs: 8000 });
  assert.deepEqual(averageTimes([]), { count: 0, stitchingMs: null, totalMs: null });
  assert.equal(averageTimes(rows.filter(row => row.bells)).stitchingMs, 2000);
  const bounded = validHistory(Array.from({ length: 25 }, (_, i) => ({ ...rows[0], name: `${i}.mp3` })));
  assert.equal(bounded.length, 20); assert.equal(bounded[0].name, '5.mp3');
  assert.deepEqual(validHistory({}), []);
});
