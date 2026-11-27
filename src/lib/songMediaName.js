export function songMediaSlug(artist = '', title = '') {
  return [artist, title].map(value => value.trim()).filter(Boolean).join('-')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/g, '') || 'santa-radio-song';
}

export function songMediaLink(link, artist, title) {
  if (!link) return '';
  try {
    const url = new URL(link);
    if (url.pathname === '/api/song-media' && /^[a-f0-9]{32}\.(mp3|jpg|png|webp)$/.test(url.searchParams.get('file') || '')) {
      url.searchParams.set('name', songMediaSlug(artist, title));
    }
    return url.toString();
  } catch { return link; }
}

export function songDownloadFilename(file, name) {
  const ext = file.match(/\.([a-z0-9]+)$/)?.[1];
  return typeof name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 80
    ? `${name}.${ext}` : `Santa-Radio-${file}`;
}
