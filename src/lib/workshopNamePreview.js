// Only a same-origin, short-lived server preview capability may be played.
export function workshopNamePreviewUrl(record) {
  try {
    if (typeof record?.previewUrl !== 'string') return null;
    if (!/^\/api\/santa-name-preview\?token=[A-Za-z0-9_.%-]+$/.test(record.previewUrl)) return null;
    return record.previewUrl;
  } catch {
    return null;
  }
}
