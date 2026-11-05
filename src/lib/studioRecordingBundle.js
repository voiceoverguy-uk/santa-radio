// Lazy-loaded only by Download All. Personalised bytes never leave the browser.
import { zipSync } from 'fflate';
import { personaliseNiceListCertificate, certificateDownloadFilename } from './niceListCertificate.js';
import { exportStudioLetter, exportStudioPicture, studioGiftFilename } from './studioGiftExports.js';
import { getWorkshopDownloadName } from './workshopNameSpelling.js';

export function studioBundleFilename(name) {
  const safeName = certificateDownloadFilename(name)
    .slice('Santa-Radio-Nice-List-Certificate-'.length, -4);
  return `Santa-Radio-Audio-And-Gifts-${safeName}.zip`;
}

export async function prepareStudioRecordingBundle(result, signal) {
  const { gift, audioBlob } = result;
  if (!gift || !audioBlob) throw new Error('Completed gifts unavailable');
  signal.throwIfAborted();
  // Sequential exports bound peak memory and allow cancellation between renderers.
  const files = {};
  const add = async (filename, blob) => {
    signal.throwIfAborted();
    files[filename] = new Uint8Array(await blob.arrayBuffer());
    signal.throwIfAborted();
  };
  await add(getWorkshopDownloadName(result.record.name, result.spelling), audioBlob);
  await add(certificateDownloadFilename(gift.writtenName),
    await personaliseNiceListCertificate(gift.writtenName));
  await add(studioGiftFilename('letter', gift.writtenName), await exportStudioLetter(gift.letter));
  await add(studioGiftFilename('picture', gift.writtenName),
    await exportStudioPicture(gift.writtenName, gift.picture));
  // MP3/PNG/PDF are already compressed. STORE avoids CPU-heavy recompression.
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}
