import { AGE_WINDOW } from './ageCaption.js';
import { NAME_WINDOWS } from './nameCaption.js';
export const SOURCE_DURATION = 102.24;
export function outputDuration(audioDuration) {
  if (!Number.isFinite(audioDuration) || audioDuration <= 0 || audioDuration > 600) throw new Error('Choose an MP3 no longer than 10 minutes.');
  return Math.max(SOURCE_DURATION, audioDuration);
}
// Loop only the picture and (optionally) the bells, never Santa's greeting.
export function stitchArguments(audioDuration, sleighbells = true, withName = false, withAge = false) {
  const duration = outputDuration(audioDuration);
  const inputs = ['-stream_loop', '-1', '-i', 'source.mp4', '-i', 'audio.mp3', '-i', 'source.mp4'];
  if (sleighbells) inputs.push('-stream_loop', '-1', '-i', 'bells.mp3');
  if (withName) inputs.push('-i', 'name.png', '-i', 'name-second.png');
  if (withAge) inputs.push('-i', 'age.png');
  // Match the live Studio bells recipe. Reset MP3 loop timestamps to decoded
  // sample time so encoder padding cannot make the end fade happen early.
  const bells = sleighbells
    ? `[3:a:0]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,loudnorm=I=-34:TP=-9:LRA=7,volume=8dB,aresample=48000,asetpts=N/SR/TB,afade=t=in:d=1,afade=t=out:st=${duration - 1}:d=1[bells];`
    : '';
  const mix = `[2:a:0][1:a:0]${sleighbells ? '[bells]' : ''}amix=inputs=${sleighbells ? 3 : 2}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false[mixed]`;
  const index = sleighbells ? 4 : 3;
  const [first, second] = NAME_WINDOWS;
  const caption = withName ? `;[0:v:0][${index}:v:0]overlay=0:0:enable='gte(t,${first[0]})*lt(t,${first[1]})'[firstCaption];[firstCaption][${index + 1}:v:0]overlay=0:0:enable='gte(t,${second[0]})*lt(t,${second[1]})'[captioned]` : '';
  const ageCaption = withAge ? `;[${withName ? 'captioned' : '0:v:0'}][${index + (withName ? 2 : 0)}:v:0]overlay=0:0:enable='gte(t,${AGE_WINDOW[0]})*lt(t,${AGE_WINDOW[1]})'[aged]` : '';
  const videoCodec = withName || withAge
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p']
    : ['-c:v', 'copy'];
  return [...inputs, '-filter_complex', bells + mix + caption + ageCaption,
    '-map', withAge ? '[aged]' : withName ? '[captioned]' : '0:v:0', '-map', '[mixed]', ...videoCodec, '-c:a', 'aac', '-b:a', '192k',
    '-t', String(duration), '-movflags', '+faststart', '-y', 'output.mp4'];
}
