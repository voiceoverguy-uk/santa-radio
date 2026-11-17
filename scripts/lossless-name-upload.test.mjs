import test from 'node:test';
import assert from 'node:assert/strict';
import { losslessNameUpload } from '../server/lossless-name-upload.js';
import { createNameLibrary, validateNameWav } from '../server/santa-name-library.js';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function wav(bits,format=1,channels=2) {
 const n=4800, align=channels*bits/8,b=Buffer.alloc(44+n*align);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(format,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(48000*align,28);b.writeUInt16LE(align,32);b.writeUInt16LE(bits,34);b.write('data',36);b.writeUInt32LE(n*align,40);
 if(format===1)for(let i=44;i<b.length;i+=bits/8){if(bits===8)b[i]=128+Math.round(40*Math.sin(i/40));else b.writeIntLE(Math.round(2000*Math.sin(i/40)),i,bits/8);}
 return b;
}
test('integer WAVs round-trip verified, remain deterministic and render from FLAC',async()=>{
 for(const bits of [8,16,24,32]){
  const original=wav(bits);validateNameWav(original);const result=await losslessNameUpload(original,'wav');
  assert.ok(result.bytes.length<=original.length);assert.deepEqual(result,await losslessNameUpload(original,'wav'));
  if(bits===16||bits===24)assert.equal(result.extension,'flac');
  const dir=await mkdtemp(join(tmpdir(),'flac-render-'));
  try{await createNameLibrary().download({file:`name.${result.extension}`},join(dir,'render.wav'),result.bytes);validateNameWav(await readFile(join(dir,'render.wav')));}finally{await rm(dir,{recursive:true,force:true});}
 }
});
test('floating WAV and MP3 bytes remain untouched',async()=>{
 for(const [bytes,extension] of [[wav(32,3),'wav'],[Buffer.from('mp3'),'mp3']])assert.deepEqual(await losslessNameUpload(bytes,extension),{bytes,extension});
});
