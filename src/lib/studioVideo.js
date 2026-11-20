import { studioAge, drawStudioVideoFrames, prepareStudioVideoFrames, STUDIO_VIDEO_ARTWORK } from './studioVideoTimeline.js';
import { createSantaVideo } from './createSantaVideo.js';
import { getWorkshopDownloadName } from './workshopNameSpelling.js';
export { STUDIO_VIDEO_ARTWORK };
export const STUDIO_VIDEO_SCENES = [
  { src: '/images/studio-scenes/workshop-sign.webp', label: 'The Runaway Toy Train' },
  { src: '/images/studio-scenes/kitchen-sign.webp', label: 'Hands Off the Cookies!' },
  { src: '/images/studio-scenes/present-room-sign.webp', label: 'Ribbon Rampage' },
  { src: '/images/studio-scenes/office-sign.webp', label: 'The Never-Ending List' },
  { src: '/images/studio-scenes/festive-loo-sign.webp', label: 'The Wrapped-Up Loo' },
  { src: '/images/studio-scenes/reindeer-stables-sign.webp', label: 'Carrot Thief!' },
];
export const studioVideoFilename = result => getWorkshopDownloadName(result.record.name, result.spelling).replace(/\.mp3$/i, '.mp4');
export function studioVideoRecipient(result) { return `${result.writtenName} aged ${studioAge(result)}`; }
export async function createStudioVideoPoster(result) {
  const image = new Image(); image.src = result.artwork || STUDIO_VIDEO_ARTWORK; await image.decode();
  const { base } = await drawStudioVideoFrames(image, result);
  return base.toDataURL('image/png');
}
export function createStudioVideo(result, options) {
  return createSantaVideo({ ...options, audio: result.audioBlob, name: result.writtenName,
    prepareFrames: (image, duration) => prepareStudioVideoFrames(image, result, duration), artwork: result.artwork || STUDIO_VIDEO_ARTWORK });
}
