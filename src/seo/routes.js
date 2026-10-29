import { songs, mugs, songPath, mugPath, songRedirects, mugAliases, mugPhotoTermsPath } from './catalogue.js';
import legacySongs from '../data/legacy-songs.js';
import { santaMessageRequestedName } from './santaMessageLinks.js';
import { alternateProfileRedirects } from './alternateRedirects.js';
import { publicRequestUrl } from './requestUrl.js';
export const staticPages = ['/', '/apps', '/privacy-policy', mugPhotoTermsPath, '/christmas-music', '/mugshots/all', '/free-santa-message', '/submit-a-song', '/links', '/santa-stories', '/santa-tracker'];
export const canonicalPaths = [...staticPages, ...songs.map(songPath), ...mugs.map(mugPath), ...songs.map(s => `/christmas-karaoke-lyrics/${s.id}-${s.link}`)];
const paths = new Set(canonicalPaths);
export const aliases = new Map([['/music', '/christmas-music'], ['/mugshots', '/mugshots/all'], ...songRedirects]);
// Exact doubled-separator examples already consolidated by the public edge.
// Mirror those results locally; this is not arbitrary slash normalization.
aliases.set('//', '/');
aliases.set('//christmas-music', '/christmas-music');
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
// Exact reported slug identities only. Never parse a numeric prefix as a
// historical ID, or accept arbitrary current IDs/slugs in the old query route.
const verifiedArtistQueries = new Map([
  ['84-barbra-streisand-the-christmas-song', ['Barbra Streisand', 'The Christmas Song']],
  ['450-donny-hathaway-this-christmas', ['Donny Hathaway', 'This Christmas']],
  ['494-sabrina-claudio-christmas-blues', ['Sabrina Claudio', 'Christmas Blues']],
  ['108-extreme-christmas-time-again', ['Extreme', 'Christmas Time Again']],
  ['153-x-mas-donkey-&-the-glittering-balls-at-the-christmas-ball', ['X-mas Donkey & The Glittering Balls', 'At The Christmas Ball']],
  ['277-bing-crosby-silver-bells', ['Bing Crosby', 'Silver Bells']],
  ['287-mitch-miller-and-the-gang-the-twelve-days-of-christmas', ['Mitch Miller and The Gang', 'The Twelve Days Of Christmas']],
].map(([query, [artist, title]]) => {
  const matches = songs.filter(song => song.artist === artist && song.song === title);
  return [query, matches.length === 1 ? songPath(matches[0]) : null];
}));
// Exact malformed addresses from the export; no general slash/hyphen rewriting.
for (const [old, target] of [
  ['/christmas-karaoke-lyrics/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow', '/christmas-karaoke-lyrics/369-dean-martin-let-it-snow-let-it-snow-let-it-snow'],
  ['/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin--to-town', '/christmas-karaoke-lyrics/564-laufey-santa-claus-is-comin-to-town'],
]) {
  if (paths.has(target)) aliases.set(old, target);
}
// Additional exact crawled-report identities, verified against the retained
// sitemap, original music rows and current profiles. Do not strip prefixes or
// rename Bon Jovi's established canonical. Evidence: docs/search-console-crawled-links.md.
for (const [old, target] of [
  ['/christmas-artist/549-bon-jovi-christmas-isn-t-christmas', '/christmas-artist/549-bon-jovi-christmas-isna-tmt-christmas'],
  ['/mugshots/rob-walker-bbc-sport/rob-rinder-judge', '/mugshots/rob-rinder-judge'],
  ['/mugshots/rob-walker-bbc-sport/kell-brook-boxer', '/mugshots/kell-brook-boxer'],
  ['/shop/product/mugshots/mugshots/matthew-cottle-actor', '/mugshots/matthew-cottle-actor'],
  ['/santa-messages/mugshots/christmas-artist/christmas-karaoke-lyrics/58-cliff-richard-saviours-day', '/christmas-karaoke-lyrics/58-cliff-richard-saviours-day'],
  // Original personalised.php enumerated audio-messages/ and linked name pages.
  ['/personalised', '/free-santa-message'],
]) {
  if (paths.has(target)) aliases.set(old, target);
}
for (const [alias, slug] of Object.entries(mugAliases)) {
  if (alias !== slug && mugs.some(m => m.song === slug)) aliases.set(`/mugshots/${alias}`, `/mugshots/${slug}`);
}
for (const [old, replacement] of songRedirects) {
  aliases.set(old.replace('/christmas-artist/', '/christmas-karaoke-lyrics/'), replacement.replace('/christmas-artist/', '/christmas-karaoke-lyrics/'));
}
// Exact malformed links in the Duplicate without user-selected canonical export.
// Full slug + retained source identities were verified, not inferred from IDs.
// Keep lyrics as lyrics and take punctuation/profile aliases straight to their
// final page. Never strip arbitrary prefixes. Evidence and all 32 report rows:
// docs/search-console-duplicate-links.md and its CSV.
for (const [old, target] of [
  ['/mugshots/rob-walker-bbc-sport/all', '/mugshots/all'],
  ['/mugshots/rob-walker-bbc-sport/everal-a-walsh', '/mugshots/everal-a-walsh-actor'],
  ['/santa-messages/christmas-artist/mugshots/jeff-mostyn-bournemouth-fc-chairman', '/mugshots/jeff-mostyn-bournemouth-fc-chairman'],
  ['/santa-messages/christmas-artist/mugshots/mark-radcliffe-radio-presenter', '/mugshots/mark-radcliffe-radio-presenter'],
  ['/santa-messages/christmas-karaoke-lyrics/216-rizzo-gonzo-it-s-the-most-wonderful-time-of-the-year', '/christmas-karaoke-lyrics/216-rizzo-gonzo-its-the-most-wonderful-time-of-the-year'],
  ['/santa-messages/christmas-artist/413-the-jackson-5-i-saw-mommy-kissing-santa-claus', '/christmas-artist/413-the-jackson-5-i-saw-mommy-kissing-santa-claus'],
  ['/santa-messages/christmas-karaoke-lyrics/120-james-brown-the-christmas-song', '/christmas-karaoke-lyrics/120-james-brown-the-christmas-song'],
  ['/santa-messages/christmas-karaoke-lyrics/89-the-beach-boys-bells-of-christmas', '/christmas-karaoke-lyrics/89-the-beach-boys-bells-of-christmas'],
  ['/santa-messages/mugshots/christmas-artist/137-nat-king-cole-frosty-the-snowman', '/christmas-artist/137-nat-king-cole-frosty-the-snowman'],
  ['/santa-messages/christmas-karaoke-lyrics/401-aretha-franklin-joy-to-the-world', '/christmas-karaoke-lyrics/401-aretha-franklin-joy-to-the-world'],
  ['/santa-messages/christmas-karaoke-lyrics/311-the-magnets-a-winter-s-tale', '/christmas-karaoke-lyrics/311-the-magnets-a-winters-tale'],
  ['/santa-messages/christmas-artist/213-the-carpenters-it-s-christmas-time', '/christmas-artist/213-the-carpenters-its-christmas-time'],
  ['/santa-messages/christmas-artist/199-state-of-the-heart-i-believe-in-father-christmas', '/christmas-artist/199-state-of-the-heart-i-believe-in-father-christmas'],
  ['/santa-messages/christmas-artist/252-burl-ives-rudolph-the-red-nosed-reindeer', '/christmas-artist/252-burl-ives-rudolph-the-red-nosed-reindeer'],
  ['/santa-messages/mugshots/christmas-artist/10-the-ronettes-sleigh-ride', '/christmas-artist/10-the-ronettes-sleigh-ride'],
  ['/santa-messages/mugshots/christmas-artist/93-bing-crosby-the-christmas-song', '/christmas-artist/93-bing-crosby-the-christmas-song'],
  ['/santa-messages/christmas-artist/180-frank-sinatra-the-first-noel', '/christmas-artist/180-frank-sinatra-the-first-noel'],
]) {
  if (paths.has(target)) aliases.set(old, target);
}
// Additional verified document links only; other report repairs stay above.
for (const [old, target] of alternateProfileRedirects) {
  if (!paths.has(target) || aliases.has(old)) throw new Error(`Invalid alternate-report redirect: ${old}`);
  aliases.set(old, target);
}
export function resolvePublicRequest(raw) {
  const url = publicRequestUrl(raw);
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return { status: 400 }; }
  // Never redirect hosts: preview, audio feeds, integrations and API calls stay same-origin.
  const normalized = path === '//' ? path : path.length > 1 ? path.replace(/\/+$/, '') : path;
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
  if (normalized !== path && (paths.has(normalized) || normalized === '/santa-tracker/preview' || normalized === '/santa-message-workshop'))
    return { status: 308, location: normalized + url.search };
  if (normalized === '/santa-message-workshop') return { status: 200, noindex: true };
  if (normalized === '/santa-tracker/preview') return { status: 200, noindex: true };
  if (normalized === '/artist') {
    if (url.searchParams.getAll('s').length !== 1) return { status: 404, noindex: true };
    let id = url.searchParams.get('s');
    // The exported Donkey URL has an unescaped ampersand inside its full slug.
    // URLSearchParams (and the Vercel handler) represent the second half as an
    // empty-valued key. Accept only this exact pair, not arbitrary joined keys,
    // conflicting values, or repeated continuations. Encoded full slugs also work.
    const continuation = '-the-glittering-balls-at-the-christmas-ball';
    if (url.searchParams.has(continuation)) {
      if (id !== '153-x-mas-donkey-' || url.searchParams.getAll(continuation).length !== 1 ||
          url.searchParams.get(continuation) !== '') return { status: 404, noindex: true };
      id += '&' + continuation;
      url.searchParams.delete(continuation);
    }
    const verifiedTarget = verifiedArtistQueries.get(id);
    const match = /^\d+$/.test(id || '') && legacyMatches.find(row => row.legacy.id === Number(id));
    if (!match && !verifiedTarget) return { status: 404, noindex: true };
    if (verifiedTarget || match.target) {
      url.searchParams.delete('s');
      return { status: 308, location: (verifiedTarget || match.target) + (url.searchParams.size ? `?${url.searchParams}` : '') };
    }
    return { status: 200, noindex: true };
  }
  return { status: paths.has(normalized) ? 200 : 404 };
}
