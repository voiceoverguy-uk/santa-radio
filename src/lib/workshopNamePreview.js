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

// A visitor can spend longer completing the form than a preview capability's
// lifetime. Refresh on demand without persisting the name or changing recording.
export async function refreshWorkshopNamePreview(record, { signal, request = fetch } = {}) {
  if (!record?.id || typeof record.name !== 'string' || !record.name.trim()) {
    throw new Error('Please choose the recorded name again to hear its preview.');
  }
  const response = await request('/api/santa-names', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: record.name }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(response.status === 429
      ? 'Too many preview attempts. Please wait a minute and try again.'
      : 'Santa’s name preview is temporarily unavailable. Please try again.');
  }
  const fresh = Array.isArray(data.records) && data.records.length <= 10
    ? data.records.find(item => item.id === record.id && item.name === record.name) : null;
  const url = workshopNamePreviewUrl(fresh);
  if (!url) throw new Error('Please choose the recorded name again to hear its preview.');
  return url;
}
