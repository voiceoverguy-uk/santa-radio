// Run after publishing/replacing contenders. Downloads approved public media only;
// originals remain untouched. Cached derivatives are keyed by the source URL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
const root = new URL('../', import.meta.url);
const output = new URL('public/contenders/display/', root);
await mkdir(output, { recursive: true });
const manifestPath = new URL('src/lib/contender-display.json', root);
let manifest = { artwork: {}, waveforms: {} };
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
const response = await fetch('https://www.santaradio.co.uk/api/christmas-contenders');
if (!response.ok) throw new Error('Unable to read approved contenders');
const { entries } = await response.json();
const sourceUrl = value => {
  const url = new URL(value, 'https://www.santaradio.co.uk');
  if (url.origin !== 'https://www.santaradio.co.uk' || !(url.pathname.startsWith('/contenders/') || url.pathname === '/api/christmas-contenders')) throw new Error('Unexpected media origin');
  return url;
};
async function bytes(value) {
  const r = await fetch(sourceUrl(value));
  if (!r.ok) throw new Error(`Media failed: ${value}`);
  return Buffer.from(await r.arrayBuffer());
}
const key = value => createHash('sha256').update(value).digest('hex').slice(0,24);
for (const entry of entries) {
  if (entry.artwork && (!manifest.artwork[entry.artwork] || process.argv.includes('--refresh-artwork'))) {
    const input = await bytes(entry.artwork);
    const name = `${key(entry.artwork)}.webp`;
    await sharp(input).rotate().resize(320,320,{fit:'inside',withoutEnlargement:true}).webp({quality:75}).toFile(new URL(name,output).pathname);
    manifest.artwork[entry.artwork] = `/contenders/display/${name}`;
  }
  if (entry.audio && !manifest.waveforms[entry.audio]) {
    const name = `${key(entry.audio)}.json`;
    let wave;
    if (entry.waveform?.url) wave = JSON.parse((await bytes(entry.waveform.url)).toString());
    else {
      const input = await bytes(entry.audio);
      const decoded = spawnSync(process.env.FFMPEG_PATH || ffmpeg,['-v','error','-i','pipe:0','-vn','-ac','1','-ar','8000','-f','s16le','pipe:1'],{input,maxBuffer:64*1024*1024});
      if (decoded.status !== 0 || !decoded.stdout.length) throw new Error(`Cannot decode ${entry.artist}`);
      const pcm = decoded.stdout, samples = pcm.length/2;
      const peaks = Array.from({length:120},(_,bin)=>{
        let peak=0;
        for(let i=Math.floor(bin*samples/120);i<Math.floor((bin+1)*samples/120);i++) peak=Math.max(peak,Math.abs(pcm.readInt16LE(i*2)));
        return peak;
      });
      const max=Math.max(...peaks)||1;
      wave={duration:samples/8000,peaks:peaks.map(p=>Math.round(p/max*1000)/1000)};
    }
    // 120 bars are ample for a small player; reduce existing 360-bin waveforms.
    if(wave.peaks.length>120) wave.peaks=Array.from({length:120},(_,i)=>Math.max(...wave.peaks.slice(Math.floor(i*wave.peaks.length/120),Math.floor((i+1)*wave.peaks.length/120))));
    await writeFile(new URL(name,output),JSON.stringify(wave));
    manifest.waveforms[entry.audio]={url:`/contenders/display/${name}`,duration:wave.duration};
  }
  console.log(`Prepared ${entry.artist}`);
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
console.log(`Prepared ${entries.length} approved entries`);
