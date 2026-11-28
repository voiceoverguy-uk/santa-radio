import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import manifest from '../src/lib/contender-display.json' with {type:'json'};

test('every prepared image is a bounded WebP thumbnail',async()=>{
  for(const path of Object.values(manifest.artwork)) {
    const file=new URL('../public'+path,import.meta.url);
    const meta=await sharp(await readFile(file)).metadata();
    assert.equal(meta.format,'webp');
    assert.ok(meta.width<=320 && meta.height<=320);
    assert.ok((await stat(file)).size<100000);
  }
});
test('waveforms contain small, valid real peak data',async()=>{
  for(const meta of Object.values(manifest.waveforms)) {
    const bytes=await readFile(new URL('../public'+meta.url,import.meta.url));
    const wave=JSON.parse(bytes);
    assert.ok(bytes.length<2000);
    assert.equal(wave.duration,meta.duration);
    assert.ok(wave.duration>0);
    assert.equal(wave.peaks.length,120);
    assert.ok(wave.peaks.every(p=>Number.isFinite(p)&&p>=0&&p<=1));
    assert.ok(new Set(wave.peaks).size>10);
  }
});
