import { audioDuration, encodingProgress } from './videoProgress.js';
import { drawStitcherImage, stitcherArguments } from './bigStitcher.js';
export const SANTA_VIDEO_ARTWORK = '/images/big-stitcher-christmas-v3.png';
// Keep memory bounded when several completed greetings are shown together.
let queue = Promise.resolve();
export function createSantaVideo({ audio, name, signal, onStatus = () => {}, onProgress = () => {} }) {
  const job = queue.catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    let ffmpeg;
    const cancel = () => ffmpeg?.terminate();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      onProgress(null); onStatus('Preparing your personalised Christmas video…');
      const duration = await audioDuration(audio, signal);
      const image = new Image();
      image.src = SANTA_VIDEO_ARTWORK;
      await image.decode();
      signal?.throwIfAborted();
      const canvas = document.createElement('canvas');
      drawStitcherImage(canvas, image, name, true);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('The Christmas image could not be prepared. Please try again.');
      const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'), import('@ffmpeg/core?url'), import('@ffmpeg/core/wasm?url'),
      ]);
      signal?.throwIfAborted();
      ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ time }) => { if (!signal?.aborted) onProgress(encodingProgress(time, duration)); });
      await ffmpeg.load({ coreURL, wasmURL });
      signal?.throwIfAborted();
      onProgress(duration > 0 ? 0 : null);
      onStatus('Adding Santa’s voice to your video… Keep this page open.');
      await ffmpeg.writeFile('image.png', new Uint8Array(await png.arrayBuffer()));
      await ffmpeg.writeFile('audio.mp3', new Uint8Array(await audio.arrayBuffer()));
      if (await ffmpeg.exec(stitcherArguments) !== 0) throw new Error('Your video could not be completed. Please try again.');
      onProgress(0.97); onStatus('Finishing your MP4…');
      const bytes = await ffmpeg.readFile('output.mp4');
      signal?.throwIfAborted();
      onProgress(1);
      return new Blob([bytes], { type: 'video/mp4' });
    } finally {
      signal?.removeEventListener('abort', cancel);
      ffmpeg?.terminate();
    }
  });
  queue = job.catch(() => {});
  return job;
}
