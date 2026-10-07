// Keep the editorial processing identical for build-time shared clips and
// on-demand name clips. Never remove the outro's supplied opening padding.
export const voiceFilter = preserveOpening => 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
  (preserveOpening ? '' : 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,') +
  'areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB,areverse,' +
  'loudnorm=I=-18:TP=-2:LRA=11,aresample=48000,' +
  'afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse,apad=pad_dur=0.10';

export function renderArgs(intro, name, outro, bells, output, prepared = false) {
  const filter = [0, 1, 2].map(i =>
    `[${i}:a]${prepared && i !== 1 ? 'aformat=sample_fmts=fltp:channel_layouts=stereo' : voiceFilter(i === 2)}[v${i}]`).join(';') +
    ';[v0][v1][v2]concat=n=3:v=0:a=1[speech];' +
    '[3:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
    'loudnorm=I=-34:TP=-9:LRA=7,aresample=48000,afade=t=in:d=1[bells];' +
    '[speech][bells]amix=inputs=2:duration=first:normalize=0,' +
    'areverse,afade=t=in:d=1,areverse,alimiter=limit=0.89:level=false[out]';
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    // Avoid auto-sizing thread pools to the host's CPU count on shared hosts.
    '-filter_complex_threads', '1', '-threads', '1',
    '-i', intro, '-i', name, '-i', outro, '-stream_loop', '-1', '-i', bells,
    '-filter_complex', filter, '-map', '[out]', '-codec:a', 'libmp3lame',
    '-threads', '1', '-b:a', '192k', '-ar', '44100', '-map_metadata', '-1', output];
}
