import durations from '../data/radio-song-durations.json' with { type: 'json' };
import { trackIdentity } from './radio-track-identity.js';
import { websiteNowPlayingTrack } from './websiteNowPlayingTrack.js';

const normalise = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[’‘']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const key = track => `${normalise(track.artist)}|${normalise(track.title)}`;
const index = new Map();
for (const track of durations) {
  if (!track.artist || !track.title) continue;
  const id = key(track);
  // Different recordings with the same credits are ambiguous: use the fallback.
  index.set(id, index.has(id) && index.get(id) !== track.seconds ? null : track.seconds);
}
export function songDuration(track) {
  if (Number.isFinite(track?.durationSeconds) && track.durationSeconds > 0 && track.durationSeconds <= 86400) {
    return track.durationSeconds;
  }
  const corrected = websiteNowPlayingTrack(track);
  return corrected ? index.get(key(corrected)) || 210 : 210;
}

export function observeSong(previous, track, now) {
  const identity = trackIdentity(track);
  if (!identity) return previous;
  const continuous = previous && now - previous.observedAt <= 15000;
  return { identity, observedAt: now, startedAt: continuous
    ? identity === previous.identity ? previous.startedAt : now : null };
}

export function upcomingSchedule(metadata, now = Date.now()) {
  if (metadata?.upcomingStatus !== 'ready') return [];
  const startedAt = Number.isFinite(metadata.current?.startedAt)
    ? metadata.current.startedAt : metadata.currentStartedAt;
  let next = metadata.currentStatus === 'ready' && Number.isFinite(startedAt) && startedAt <= now
    ? startedAt + (songDuration(metadata.current) + 5) * 1000 : null;
  // A late or interrupted feed must not leave old clock times on screen.
  if (next <= now) next = null;
  return (metadata.upcoming || []).slice(0, 9).map(track => {
    // Published playout times already include the station’s transitions.
    // A past published time is stale, not permission to invent a later time.
    if (Number.isFinite(track.startedAt)) next = track.startedAt > now ? track.startedAt : null;
    const item = { ...websiteNowPlayingTrack(track), estimatedAt: next };
    if (next !== null) next += (songDuration(track) + 5) * 1000;
    return item;
  });
}

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true });
export const formatPlayTime = timestamp => clock.format(timestamp).replace(/\s/g, '').toLowerCase();
