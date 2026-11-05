import { voiceFilter } from './santa-audio-filters.mjs';

// Preserve the iPhone free-message recipe from before the website-only bells
// change: no lead/tail padding and the original full-mix ending fade/limiter.
export function mobileFreeRenderArgs(intro, name, outro, bells, output, prepared = false) {
  const filter = [0, 1, 2].map(i =>
    `[${i}:a]${prepared && i !== 1 ? 'aformat=sample_fmts=fltp:channel_layouts=stereo' : voiceFilter()}[v${i}]`).join(';') +
    ';[v0][v1][v2]concat=n=3:v=0:a=1[speech];' +
    '[3:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
    'loudnorm=I=-34:TP=-9:LRA=7,volume=4dB,aresample=48000,afade=t=in:d=1[bells];' +
    '[speech][bells]amix=inputs=2:duration=first:normalize=0,' +
    'areverse,afade=t=in:d=1,areverse,alimiter=limit=0.89:level=false[out]';
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    '-filter_complex_threads', '1', '-threads', '1',
    '-i', intro, '-i', name, '-i', outro, '-stream_loop', '-1', '-i', bells,
    '-filter_complex', filter, '-map', '[out]', '-codec:a', 'libmp3lame',
    '-threads', '1', '-b:a', '192k', '-ar', '44100', '-map_metadata', '-1', output];
}
