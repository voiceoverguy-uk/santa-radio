import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
const execute = promisify(execFile);
// Input has already passed validateNameWav. Floating point stays WAV: FLAC is integer PCM.
export async function losslessNameUpload(bytes, extension) {
  if (extension !== 'wav') return { bytes, extension };
  let format;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === 'fmt ') {
      format = bytes.readUInt16LE(offset + 8);
    }
    offset += 8 + size + size % 2;
  }
  if (format !== 1) return { bytes, extension };
  const directory = await mkdtemp(join(tmpdir(), 'name-flac-'));
  const run = args => execute(ffmpeg, ['-hide_banner','-nostdin','-v','error','-xerror','-protocol_whitelist','file,pipe', ...args], { timeout: 20000, maxBuffer: 65536 });
  try {
    const input = join(directory,'input.wav'), output = join(directory,'output.flac');
    await writeFile(input, bytes, { mode: 0o600 });
    await run(['-f','wav','-i',input,'-map','0:a:0','-map_metadata','-1','-c:a','flac','-compression_level','8','-threads','1',output]);
    // Compare every decoded sample at original rate/channel count before publication.
    for (const [file, type, target] of [[input,'wav','before'],[output,'flac','after']]) {
      await run(['-f',type,'-i',file,'-map','0:a:0','-c:a','pcm_s32le','-f','s32le',join(directory,target)]);
    }
    const [before,after,compressed] = await Promise.all(['before','after','output.flac'].map(file=>readFile(join(directory,file))));
    if (!before.equals(after) || compressed.length >= bytes.length) return {bytes,extension};
    return {bytes:compressed,extension:'flac'};
  } finally { await rm(directory,{recursive:true,force:true}); }
}
