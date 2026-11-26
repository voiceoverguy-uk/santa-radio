export function isTrackAboutToPlay(estimatedAt, now) {
  return Number.isFinite(estimatedAt) && estimatedAt > now && estimatedAt - now <= 30_000;
}
