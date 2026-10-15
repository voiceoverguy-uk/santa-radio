// Test-process preload only; never imported by application code.
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const source = new URL(url);
  if (source.origin !== 'https://stagcommunications.com') return originalFetch(url, options);
  const body = source.pathname.endsWith('/Nowplaying.txt')
    ? 'Leona Lewis - One More Sleep'
    : 'Leona Lewis - One More Sleep\n - Santa Radio Announcement\nBryan Adams - Christmas Time\nLeona Lewis - One More Sleep';
  return Promise.resolve(new Response(body, { headers: { 'content-type': 'text/plain' } }));
};
