// Lazy-loaded only by Download All. Personalised bytes never leave the browser.
import { zipSync } from 'fflate';
import { personaliseNiceListCertificate, certificateDownloadFilename } from './niceListCertificate.js';
import { exportStudioLetter, exportStudioPicture, studioGiftFilename } from './studioGiftExports.js';
import { studioVideoFilename } from './studioVideo.js';

export function studioBundleFilename(name) {
  const safeName = certificateDownloadFilename(name)
    .slice('Santa-Radio-Nice-List-Certificate-'.length, -4);
  return `Santa-Radio-Video-And-Gifts-${safeName}.zip`;
}

export async function prepareStudioRecordingBundle(result, signal) {
  const { gift, videoBlob } = result;
  if (!gift || !videoBlob) throw new Error('Completed gifts unavailable');
  signal.throwIfAborted();
  // Sequential exports bound peak memory and allow cancellation between renderers.
  const files = {};
  const add = async (filename, blob) => {
    signal.throwIfAborted();
    files[filename] = new Uint8Array(await blob.arrayBuffer());
    signal.throwIfAborted();
  };
  await add(studioVideoFilename(result), videoBlob);
  await add(certificateDownloadFilename(gift.writtenName),
    await personaliseNiceListCertificate(gift.writtenName));
  await add(studioGiftFilename('letter', gift.writtenName), await exportStudioLetter(gift.letter));
  await add(studioGiftFilename('picture', gift.writtenName),
    await exportStudioPicture(gift.writtenName, gift.picture));
  // MP4/PNG/PDF are already compressed. STORE avoids CPU-heavy recompression.
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}
