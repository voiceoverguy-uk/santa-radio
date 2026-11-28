import { matchLiveSong, normalizeTrackText } from '../data/matchLiveSong.js';
import { websiteNowPlayingTrack } from './websiteNowPlayingTrack.js';

export function galleryMatchesTrack(image, rawTrack) {
  if (!image || !rawTrack) return false;
  const track = websiteNowPlayingTrack(rawTrack);
  if (image.songId != null) return matchLiveSong(track).song?.id === image.songId;
  return Boolean(image.title && normalizeTrackText(track.artist || '') === normalizeTrackText(image.artist || '') &&
    normalizeTrackText(track.title || '') === normalizeTrackText(image.title));
}

export function galleryPlayTime(image, upcoming, now = Date.now()) {
  const track = upcoming.slice(0, 4).find(track =>
    Number.isFinite(track.estimatedAt) && track.estimatedAt > now && galleryMatchesTrack(image, track));
  return track?.estimatedAt ?? null;
}
