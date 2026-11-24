import { audioDuration, encodingProgress } from './videoProgress.js';
import { drawStitcherImage, stitcherArguments } from './bigStitcher.js';
export const SANTA_VIDEO_ARTWORK = '/images/big-stitcher-christmas-v3.png';
// Keep memory bounded when several completed greetings are shown together.
let queue = Promise.resolve();
export function createSantaVideo({
  audio, name, prepareFrames, artwork = SANTA_VIDEO_ARTWORK, signal,
  encodingStatus = 'Adding Santa’s voice to your video… Keep this page open.',
  onStatus = () => {}, onProgress = () => {},
}) {
  const job = queue.catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    let ffmpeg;
    const cancel = () => ffmpeg?.terminate();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      onProgress(null); onStatus('Preparing your personalised Christmas video…');
      const duration = await audioDuration(audio, signal);
      const image = new Image();
      image.src = artwork;
      await image.decode();
      signal?.throwIfAborted();
      let prepared;
      if (prepareFrames) prepared = await prepareFrames(image, duration);
      else {
        // Messaging apps may sample the very first frame for their preview.
        const canvas = document.createElement('canvas');
        drawStitcherImage(canvas, image, name, true, 'complete');
        const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!png) throw new Error('The Christmas image could not be prepared. Please try again.');
        prepared = { files: [{ name: 'image.png', blob: png }], args: stitcherArguments };
      }
      const [{ FFmpeg }, { default: coreURL }, { default: wasmURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'), import('@ffmpeg/core?url'), import('@ffmpeg/core/wasm?url'),
      ]);
      signal?.throwIfAborted();
      ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ time }) => { if (!signal?.aborted) onProgress(encodingProgress(time, duration)); });
      await ffmpeg.load({ coreURL, wasmURL });
      signal?.throwIfAborted();
      onProgress(duration > 0 ? 0 : null);
      onStatus(encodingStatus);
      for (const file of prepared.files) await ffmpeg.writeFile(file.name, new Uint8Array(await file.blob.arrayBuffer()));
      await ffmpeg.writeFile('audio.mp3', new Uint8Array(await audio.arrayBuffer()));
      if (await ffmpeg.exec(prepared.args) !== 0) throw new Error('Your video could not be completed. Please try again.');
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

export async function createSantaVideoPoster(name, artwork = SANTA_VIDEO_ARTWORK) {
  const image = new Image(); image.src = artwork; await image.decode();
  const canvas = document.createElement('canvas'); drawStitcherImage(canvas, image, name, true);
  return canvas.toDataURL('image/png');
}
