// Keep the editorial processing identical for build-time shared clips and
// on-demand name clips. All pauses and joins come from the recordings themselves:
// no silence trimming, padding, overlap or crossfade on any voice segment.
export const voiceFilter = () => 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
  'loudnorm=I=-18:TP=-2:LRA=11,aresample=48000,' +
  'afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse';

export function renderArgs(intro, name, outro, bells, output, prepared = false) {
  const filter = [0, 1, 2].map(i =>
    `[${i}:a]${prepared && i !== 1 ? 'aformat=sample_fmts=fltp:channel_layouts=stereo' : voiceFilter()}[v${i}]`).join(';') +
    ';[v0][v1][v2]concat=n=3:v=0:a=1[voice];' +
    // Add time outside the complete recordings, never inside or over their pauses.
    '[voice]adelay=48000S:all=1,apad=pad_len=48000[speech];' +
    '[3:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
    'loudnorm=I=-34:TP=-9:LRA=7,volume=4dB,aresample=48000,afade=t=in:d=1[bells];' +
    // The final second contains only bells: the entire voice has already ended.
    // Fading this padded tail cannot attenuate any recorded voice or pause.
    // Reset reversed timestamps: raw MP3 processing and prepared WAVs can
    // otherwise give afade different starting timestamps despite equal samples.
    '[speech][bells]amix=inputs=2:duration=first:normalize=0,' +
    'areverse,asetpts=N/SR/TB,afade=t=in:d=1,areverse,' +
    'alimiter=limit=0.89:level=false:latency=true[out]';
  return ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    // Avoid auto-sizing thread pools to the host's CPU count on shared hosts.
    '-filter_complex_threads', '1', '-threads', '1',
    '-i', intro, '-i', name, '-i', outro, '-stream_loop', '-1', '-i', bells,
    '-filter_complex', filter, '-map', '[out]', '-codec:a', 'libmp3lame',
    '-threads', '1', '-b:a', '192k', '-ar', '44100', '-map_metadata', '-1', output];
}
