// The Dashboard supplies its existing owner credential in this frame's memory.
export function videoRequest(asset = '', options = {}) {
  const headers = new Headers(options.headers);
  if (window.__santaVideoOwnerToken) headers.set('Authorization', `Bearer studio-owner.${window.__santaVideoOwnerToken}`);
  return fetch(`/api/santa-videos${asset ? `?asset=${asset}` : ''}`, { ...options, headers });
}
