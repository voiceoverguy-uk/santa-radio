export function upcomingCountdownSeconds(estimatedAt, now) {
  if (!Number.isFinite(estimatedAt) || !Number.isFinite(now)) return null;
  const remaining = estimatedAt - now;
  return remaining > 0 && remaining <= 60_000 ? Math.ceil(remaining / 1000) : null;
}

export function isTrackAboutToPlay(estimatedAt, now) {
  return upcomingCountdownSeconds(estimatedAt, now) !== null;
}
