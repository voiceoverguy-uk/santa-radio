const ROOT = 'https://stagcommunications.com/santaradio/names/';
const FILE = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 '’_-]{0,79}\.(?:mp3|wav)$(?![\s\S])/iu;

// Only an exact, hosted recording URL from the inventory may be played.
// Never derive a filename from a typed or certificate spelling.
export function workshopNamePreviewUrl(record) {
  try {
    if (typeof record?.previewUrl !== 'string') return null;
    const url = new URL(record.previewUrl);
    if (!url.href.startsWith(ROOT) || url.username || url.password || url.search || url.hash) return null;
    const file = decodeURIComponent(url.pathname.slice(new URL(ROOT).pathname.length));
    return FILE.test(file) ? url.href : null;
  } catch {
    return null;
  }
}
