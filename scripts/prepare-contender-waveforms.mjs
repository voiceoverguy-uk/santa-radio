// Explicit offline asset preparation. Never decode MP3s in a listener's browser.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const assets = new URL('../public/contenders/', import.meta.url);
const output = new URL('waveforms/', assets);
await mkdir(output, { recursive: true });
const catalogue = {};
const bins = 360;
for (const name of (await readdir(assets)).filter(name => name.endsWith('.mp3')).sort()) {
  const source = new URL(name, assets);
  const bytes = await readFile(source);
  const hash = createHash('sha256').update('mono8k-peak360-v1:').update(bytes).digest('hex').slice(0, 24);
  const file = `${hash}.json`;
  let waveform;
  try {
    waveform = JSON.parse(await readFile(new URL(file, output), 'utf8'));
    if (waveform.peaks.length !== bins || !Number.isFinite(waveform.duration)) throw new Error('Invalid cache');
  } catch {
    const decoded = spawnSync(ffmpeg, ['-v', 'error', '-i', source.pathname, '-vn',
      '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
    if (decoded.error || decoded.status !== 0) throw new Error(`Unable to decode ${name}: ${decoded.error?.message || decoded.stderr}`);
    const pcm = decoded.stdout;
    const samples = pcm.length / 2;
    if (!samples) throw new Error(`Empty recording: ${name}`);
    const peaks = Array.from({ length: bins }, (_, bin) => {
      let peak = 0;
      for (let i = Math.floor(bin * samples / bins); i < Math.floor((bin + 1) * samples / bins); i++) {
        peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2)));
      }
      return peak;
    });
    const maximum = Math.max(...peaks);
    waveform = { duration: samples / 8000, peaks: peaks.map(peak => maximum ? Math.round(peak / maximum * 1000) / 1000 : 0) };
    await writeFile(new URL(file, output), JSON.stringify(waveform) + '\n');
  }
  catalogue[`/contenders/${name}`] = { url: `/contenders/waveforms/${file}`, duration: waveform.duration };
  console.log(`${name}: ${waveform.duration.toFixed(2)}s, ${bins} real peaks (cached by recording hash)`);
}
await writeFile(new URL('../src/lib/contender-waveforms.json', import.meta.url), JSON.stringify(catalogue, null, 2) + '\n');
