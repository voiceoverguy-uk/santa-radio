import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import catalogue from '../src/lib/contender-waveforms.json' with { type: 'json' };

for (const [source, metadata] of Object.entries(catalogue)) {
  test(`precomputed waveform matches supplied recording: ${source}`, async () => {
    const bytes = await readFile(new URL(`../public${source}`, import.meta.url));
    const hash = createHash('sha256').update('mono8k-peak360-v1:').update(bytes).digest('hex').slice(0, 24);
    assert.equal(metadata.url, `/contenders/waveforms/${hash}.json`);
    const json = await readFile(new URL(`../public${metadata.url}`, import.meta.url), 'utf8');
    const waveform = JSON.parse(json);
    assert.equal(waveform.duration, metadata.duration);
    assert.ok(metadata.duration > 0);
    assert.equal(waveform.peaks.length, 360);
    assert.ok(waveform.peaks.every(peak => Number.isFinite(peak) && peak >= 0 && peak <= 1));
    assert.ok(new Set(waveform.peaks).size > 20);
    assert.ok(json.length < 4000, 'Small peak data, not the MP3, is fetched on listing');
  });
}
