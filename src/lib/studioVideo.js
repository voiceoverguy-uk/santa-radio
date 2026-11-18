import { createSantaVideo } from './createSantaVideo.js';
import { getWorkshopDownloadName } from './workshopNameSpelling.js';
export const STUDIO_VIDEO_ARTWORK = '/images/studio-santa-video-v2.png';
export const studioVideoFilename = result => getWorkshopDownloadName(result.record.name, result.spelling).replace(/\.mp3$/i, '.mp4');
export function studioVideoRecipient(result) {
  const age = String(result.gift?.details?.age || '').replace(/\s+old$/i, '').replace(/\s+years?$/i, '').trim();
  if (!age) throw new Error('The selected age could not be found. Keep this page open and try again.');
  return `${result.writtenName} aged ${age}`;
}
export function createStudioVideo(result, options) {
  return createSantaVideo({ ...options, audio: result.audioBlob, name: studioVideoRecipient(result), artwork: STUDIO_VIDEO_ARTWORK });
}
