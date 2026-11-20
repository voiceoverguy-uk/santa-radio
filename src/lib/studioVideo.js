import { studioAge, drawStudioVideoFrames, prepareStudioVideoFrames } from './studioVideoTimeline.js';
import { createSantaVideo } from './createSantaVideo.js';
import { getWorkshopDownloadName } from './workshopNameSpelling.js';
export const STUDIO_VIDEO_ARTWORK = '/images/studio-santa-video-framed-v1.png';
export const STUDIO_VIDEO_SCENES = [
  { src: '/images/studio-scenes/workshop.webp', label: 'Santa’s workshop' },
  { src: '/images/studio-scenes/kitchen.webp', label: 'Mrs Claus’s kitchen' },
  { src: '/images/studio-scenes/present-room.webp', label: 'The present room' },
  { src: '/images/studio-scenes/office.webp', label: 'Santa’s office' },
  { src: '/images/studio-scenes/festive-loo.webp', label: 'The festive loo' },
  { src: '/images/studio-scenes/reindeer-stables.webp', label: 'The reindeer stables' },
];
export const studioVideoFilename = result => getWorkshopDownloadName(result.record.name, result.spelling).replace(/\.mp3$/i, '.mp4');
export function studioVideoRecipient(result) { return `${result.writtenName} aged ${studioAge(result)}`; }
export async function createStudioVideoPoster(result) {
  const image = new Image(); image.src = result.artwork || STUDIO_VIDEO_ARTWORK; await image.decode();
  const { base, layers } = drawStudioVideoFrames(image, result);
  for (const layer of layers.filter(layer => ['intro', 'name'].includes(layer.id))) {
    base.getContext('2d').drawImage(layer.canvas, 0, layer.y);
  }
  return base.toDataURL('image/png');
}
export function createStudioVideo(result, options) {
  return createSantaVideo({ ...options, audio: result.audioBlob, name: result.writtenName,
    prepareFrames: (image, duration) => prepareStudioVideoFrames(image, result, duration), artwork: result.artwork || STUDIO_VIDEO_ARTWORK });
}
