import { studioAge, drawStudioVideoFrames, prepareStudioVideoFrames } from './studioVideoTimeline.js';
import { createSantaVideo } from './createSantaVideo.js';
import { getWorkshopDownloadName } from './workshopNameSpelling.js';
export const STUDIO_VIDEO_ARTWORK = '/images/studio-santa-video-v2.png';
export const studioVideoFilename = result => getWorkshopDownloadName(result.record.name, result.spelling).replace(/\.mp3$/i, '.mp4');
export function studioVideoRecipient(result) { return `${result.writtenName} aged ${studioAge(result)}`; }
export async function createStudioVideoPoster(result) {
  const image = new Image(); image.src = STUDIO_VIDEO_ARTWORK; await image.decode();
  return drawStudioVideoFrames(image, result).base.toDataURL('image/png');
}
export function createStudioVideo(result, options) {
  return createSantaVideo({ ...options, audio: result.audioBlob, name: result.writtenName,
    prepareFrames: (image, duration) => prepareStudioVideoFrames(image, result, duration), artwork: STUDIO_VIDEO_ARTWORK });
}
