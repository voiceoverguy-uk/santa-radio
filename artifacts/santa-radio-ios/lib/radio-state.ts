export type Track = { title: string; artist: string; artwork?: string };
export function parseMetadata(data: unknown): Track | null {
  if (!data || typeof data !== 'object') throw new Error('Invalid metadata');
  const payload = data as { currentStatus?: unknown; current?: unknown };
  if (payload.currentStatus === 'unavailable') return null;
  if (payload.currentStatus !== 'ready' || !payload.current || typeof payload.current !== 'object') throw new Error('Invalid metadata');
  const track = payload.current as Record<string, unknown>;
  if (typeof track.title !== 'string' || typeof track.artist !== 'string' || !track.title.trim()) throw new Error('Invalid track');
  return { title: track.title.trim().slice(0, 300), artist: track.artist.trim().slice(0, 300),
    ...(typeof track.artwork === 'string' && track.artwork.startsWith('https://') ? { artwork: track.artwork } : {}) };
}
