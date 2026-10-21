// Test-only preload. The application and production worker never import this.
globalThis.fetch = async url => {
  if (!String(url).startsWith('https://stagcommunications.com/santaradio/Nowplaying.txt')) throw new Error('Unexpected test URL');
  return new Response('CLI Artist - CLI Song', { headers: { 'content-type': 'text/plain' } });
};
