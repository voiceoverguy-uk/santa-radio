import { matchLiveSong, normalizeTrackText } from '../data/matchLiveSong.js';

export function galleryPlayTime(image, upcoming, now = Date.now()) {
  if (!image) return null;
  const track = upcoming.slice(0, 4).find(track => {
    if (!Number.isFinite(track.estimatedAt) || track.estimatedAt <= now) return false;
    if (image.songId != null) return matchLiveSong(track).song?.id === image.songId;
    return image.title && normalizeTrackText(track.artist || '') === normalizeTrackText(image.artist) &&
      normalizeTrackText(track.title || '') === normalizeTrackText(image.title);
  });
  return track?.estimatedAt ?? null;
}

