import { songs, mugs, songPath, mugPath, songRedirects, mugAliases } from './catalogue.js';
import legacySongs from '../data/legacy-songs.js';
import { santaMessageRequestedName } from './santaMessageLinks.js';
export const staticPages = ['/', '/apps', '/privacy-policy', '/christmas-music', '/mugshots/all', '/free-santa-message', '/submit-a-song', '/links', '/santa-stories', '/santa-tracker'];
export const canonicalPaths = [...staticPages, ...songs.map(songPath), ...mugs.map(mugPath), ...songs.map(s => `/christmas-karaoke-lyrics/${s.id}-${s.link}`)];
const paths = new Set(canonicalPaths);
export const aliases = new Map([['/music', '/christmas-music'], ['/mugshots', '/mugshots/all'], ...songRedirects]);
for (const song of songs) {
  aliases.set(`/christmas-artist/${song.id}`, songPath(song));
  aliases.set(`/christmas-artist/${song.link}`, songPath(song));
}
const normalizeIdentity = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Verified shortened legacy title, not a shared numeric-ID assumption.
// AllMusic lists the full title; the retained catalogue URL and existing live
// feed alias document the local title correction. See the editorial evidence.
const verifiedLegacyTitles = [{
  artist: 'Gladys Knight & The Pips',
  title: "It's Christmas Everyday",
  catalogueTitle: "When You Love Someone (It's Christmas Everyday)",
}];
export const legacyMatches = legacySongs.map(legacy => {
  const verified = verifiedLegacyTitles.find(row => normalizeIdentity(row.artist) === normalizeIdentity(legacy.artist) && normalizeIdentity(row.title) === normalizeIdentity(legacy.song));
  const title = verified?.catalogueTitle || legacy.song;
  const matches = songs.filter(song => normalizeIdentity(song.artist) === normalizeIdentity(legacy.artist) && normalizeIdentity(song.song) === normalizeIdentity(title));
  return { legacy, target: matches.length === 1 ? songPath(matches[0]) : null };
});
for (const [alias, slug] of Object.entries(mugAliases)) {
  if (alias !== slug && mugs.some(m => m.song === slug)) aliases.set(`/mugshots/${alias}`, `/mugshots/${slug}`);
}
for (const [old, replacement] of songRedirects) {
  aliases.set(old.replace('/christmas-artist/', '/christmas-karaoke-lyrics/'), replacement.replace('/christmas-artist/', '/christmas-karaoke-lyrics/'));
}
export function resolvePublicRequest(raw) {
  const url = new URL(raw, 'https://www.santaradio.co.uk');
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return { status: 400 }; }
  // Never redirect hosts: preview, audio feeds, integrations and API calls stay same-origin.
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (/^\/(?:request-names|sign-in|sign-up)(?:\/|$)/.test(normalized)) return { status: 200, noindex: true };
  const messageLink = normalized.match(/^\/personalised-santa-message(?:\/([^/]+))?$/i);
  if (messageLink) {
    if (!messageLink[1] || messageLink[1].toLowerCase() === 'all') {
      url.searchParams.delete('name');
    } else {
      const name = santaMessageRequestedName(messageLink[1]);
      if (!name) return { status: 404 };
      url.searchParams.set('name', name);
    }
    return { status: 308, location: '/free-santa-message' + url.search };
  }
  const target = aliases.get(normalized);
  if (target) return { status: 308, location: target + url.search };
  if (normalized !== path && (paths.has(normalized) || normalized === '/santa-tracker/preview'))
    return { status: 308, location: normalized + url.search };
  if (normalized === '/santa-tracker/preview') return { status: 200, noindex: true };
  if (normalized === '/artist') {
    const id = url.searchParams.get('s');
    const match = /^\d+$/.test(id || '') && legacyMatches.find(row => row.legacy.id === Number(id));
    if (!match) return { status: 404, noindex: true };
    if (match.target) {
      url.searchParams.delete('s');
      return { status: 308, location: match.target + (url.searchParams.size ? `?${url.searchParams}` : '') };
    }
    return { status: 200, noindex: true };
  }
  return { status: paths.has(normalized) ? 200 : 404 };
}
