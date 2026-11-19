import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

const execute = promisify(execFile);
export const studioSources = fileURLToPath(new URL('./santa-audio/studio/', import.meta.url));
export const studioBells = fileURLToPath(new URL('./santa-audio/studio/sleigh-bells.mp3', import.meta.url));
const RATE = 48000, FRAME = 8;
export const STUDIO_LEAD_IN_SECONDS = 1;
// The source-speech budget is unchanged. At 192 kb/s, even 176 seconds plus
// MP3 framing fits the existing 4,400,000-byte server and browser limits.
export const MAX_STUDIO_SECONDS = 175;

export function studioOrder(name, choices, fixed = studioSources, fourth = join(fixed, '4th.flac')) {
  return [join(fixed, 'intro.flac'), name, join(fixed, '1st.flac'), choices.age,
    ...(choices.talent ? [join(fixed, '1-5.flac'), choices.talent] : []),
    join(fixed, '2nd.flac'), choices.activity, choices.achievement,
    join(fixed, '3rd.flac'), choices.treat, fourth, choices.place,
    join(fixed, '5th.flac'), name, join(fixed, '6th.flac')];
}

async function run(args, signal) {
  signal?.throwIfAborted();
  return execute(ffmpeg, ['-hide_banner', '-nostdin', '-threads', '1',
    '-filter_threads', '1', ...args], {
    signal, timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024,
  });
}

// Force the demuxer AND decoder: a recording must never be interpreted as a
// playlist, URL or arbitrary local-file reference. Retain every decoded sample.
export async function prepareStudioClip(source, target, { signal, maxSeconds = 60 } = {}) {
  const extension = source.split('.').at(-1).toLowerCase();
  const format = { wav: ['wav', 'pcm_s16le'], mp3: ['mp3', 'mp3'], flac: ['flac', 'flac'] }[extension];
  if (!format) throw new Error('Unsupported recording.');
  // WAVs may contain 16/24/32-bit PCM; constrain demuxing but allow its PCM codec.
  const args = ['-v', 'error', '-xerror', '-err_detect', 'explode',
    '-protocol_whitelist', 'file,pipe', '-f', format[0],
    ...(extension === 'wav' ? [] : ['-c:a', format[1]]), '-i', source,
    '-map', '0:a:0', '-vn', '-sn', '-dn', '-t', String(maxSeconds + 1),
    '-ar', String(RATE), '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'f32le', '-n', target];
  const decoded = await run(args, signal);
  const { size } = await stat(target);
  if (decoded.stderr || !size || size % FRAME || size > maxSeconds * RATE * FRAME) {
    throw new Error('Invalid recording duration or decode.');
  }
  const measured = await run(['-v', 'info', '-f', 'f32le', '-ar', String(RATE), '-ac', '2',
    '-i', target, '-af', 'loudnorm=I=-18:TP=-3:LRA=11:print_format=json', '-f', 'null', '-'], signal);
  const match = measured.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  const measurement = JSON.parse(match?.[0] || '{}');
  const integrated = Number(measurement.input_i), peak = Number(measurement.input_tp);
  if (!Number.isFinite(integrated) || !Number.isFinite(peak)) throw new Error('Unmeasurable recording.');
  const gainDb = Math.min(-18 - integrated, -3 - peak);
  // Constant gain, not dynamic loudnorm: no latency, padding, fades or trimming.
  const pcm = await readFile(target);
  const gain = 10 ** (gainDb / 20);
  for (let offset = 0; offset < pcm.length; offset += 4) {
    const sample = pcm.readFloatLE(offset);
    if (!Number.isFinite(sample)) throw new Error('Invalid recording sample.');
    pcm.writeFloatLE(sample * gain, offset);
  }
  await writeFile(target, pcm);
  return { frames: size / FRAME, seconds: size / FRAME / RATE, gainDb };
}

export function studioMixArgs(voice, bells, output) {
  return ['-v', 'error', '-filter_complex_threads', '1',
    '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', voice,
    '-stream_loop', '-1', '-protocol_whitelist', 'file,pipe', '-f', 'mp3', '-c:a', 'mp3', '-i', bells,
    '-filter_complex',
    `[0:a]adelay=${STUDIO_LEAD_IN_SECONDS * RATE}S:all=1[speech];` +
    '[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
    'loudnorm=I=-34:TP=-9:LRA=7,volume=8dB,aresample=48000,afade=t=in:d=1[bells];' +
    '[speech][bells]amix=inputs=2:duration=first:normalize=0,' +
    'areverse,afade=t=in:d=1,areverse,alimiter=limit=0.89:level=false:latency=true[out]',
    '-map', '[out]', '-map_metadata', '-1', '-c:a', 'libmp3lame',
    '-threads', '1', '-b:a', '192k', '-ar', '44100', '-n', output];
}

export function dadOrder(name, choices, fixed) {
 return [fixed[0],name,fixed[1],choices.age,fixed[2],choices.habit,fixed[3],choices.viewing,fixed[4],choices.treat,fixed[5],name,fixed[6]];
}
export async function renderDadMessage({name,choices,fixed,directory,signal,bells=studioBells}) {
 const order=dadOrder(name,choices,fixed), prepared=new Map(); let index=0;
 for(const source of new Set(order)) {
  const target=join(directory,`prepared-${index++}.f32`);
  prepared.set(source,{target,...await prepareStudioClip(source,target,{signal})});
 }
 let cursor=48000, names=0; const clipStarts={},clipEnds={};
 for(const source of order){
  const key=source===name?(++names===1?'name':'secondName'):Object.keys(choices).find(k=>choices[k]===source);
  if(key){clipStarts[key]=cursor/48000;clipEnds[key]=(cursor+prepared.get(source).frames)/48000;}
  cursor+=prepared.get(source).frames;
 }
 if(cursor/48000>175)throw Error('Message too long');
 const voice=join(directory,'speech.f32');
 // Exact PCM concatenation: section 5 flows straight into the selected treat.
 await writeFile(voice,Buffer.concat(await Promise.all(order.map(source=>readFile(prepared.get(source).target)))),{flag:'wx',mode:0o600});
 const output=join(directory,'message.mp3');const mixArgs=studioMixArgs(voice,bells,output);
 const filter=mixArgs.indexOf('-filter_complex')+1;
 mixArgs[filter]=mixArgs[filter].replace('[1:a]aresample',`[1:a]atrim=duration=${cursor/48000},aresample`);
 const mixed=await run(mixArgs,signal);
 if(mixed.stderr)throw Error('Mix failed');const audio=await readFile(output);
 if(!audio.length||audio.length>4400000)throw Error('Invalid output');
 return {audio,clipStarts,clipEnds};
}
