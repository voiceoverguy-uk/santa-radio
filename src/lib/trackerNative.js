export function isTrackerNative(userAgent = '') {
  return typeof userAgent === 'string' && /(?:^|\s)SantaTrackerNative(?:\s|$)/.test(userAgent);
}
