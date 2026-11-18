// Retain every source JPEG. Conversion changes only catalogue image references.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const data=JSON.parse(await fs.readFile('src/data/mugshots.json','utf8'));
const images=[...new Set(data.map(x=>x.image).filter(x=>/\.jpe?g$/i.test(x)))];
const manifest=[];
let cursor=0;
async function encode(bytes,file,quality){
 await new Promise((resolve,reject)=>{
  const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-threads','1','-i','pipe:0','-frames:v','1','-c:v','libwebp','-quality',String(quality),'-threads','1',file]);
  let error='';child.stderr.on('data',x=>error+=x);child.on('error',reject);child.stdin.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(error)));child.stdin.end(bytes);
 });
}
await Promise.all(Array.from({length:4},async()=>{
 while(cursor<images.length){
  const original=images[cursor++];const local='public'+original;
  // Use exact tracked bytes: this also handles historic filename pairs that
  // differ only in case on a case-insensitive macOS checkout.
  const bytes=execFileSync('git',['show',`HEAD:${local}`],{maxBuffer:20*1024*1024});
  const sourceHash=hash(bytes);const image=original.replace(/\.jpe?g$/i,`-optimized-${sourceHash.slice(0,8)}.webp`);
  const output='public'+image;let quality=82;
  await encode(bytes,output,quality);
  if((await fs.stat(output)).size>bytes.length){quality=76;await encode(bytes,output,quality);}
  const converted=await fs.readFile(output);
  manifest.push({original,image,sourceHash,originalBytes:bytes.length,webpBytes:converted.length,quality});
  if(manifest.length%100===0)console.log(`Converted ${manifest.length}/${images.length}`);
 }
}));
const replacements=new Map(manifest.map(x=>[x.original,x.image]));
for(const row of data)if(replacements.has(row.image))row.image=replacements.get(row.image);
manifest.sort((a,b)=>a.original.localeCompare(b.original));
await fs.writeFile('src/data/mugshots.json',JSON.stringify(data,null,2)+'\n');
await fs.writeFile('reports/mugshot-webp-conversion.json',JSON.stringify(manifest,null,2)+'\n');
const originalBytes=manifest.reduce((n,x)=>n+x.originalBytes,0),webpBytes=manifest.reduce((n,x)=>n+x.webpBytes,0);
console.log(JSON.stringify({converted:manifest.length,originalBytes,webpBytes,savingPercent:Math.round(100*(1-webpBytes/originalBytes))}));
