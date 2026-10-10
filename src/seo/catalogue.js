import rawSongs from '../data/songs.json' with { type: 'json' };
import rawMugs from '../data/mugshots.json' with { type: 'json' };
import { buildCatalogue } from '../data/mugshot-catalogue.js';
import { artistArtwork, fallbackArtwork } from '../data/artistArtwork.js';

export const ORIGIN = 'https://www.santaradio.co.uk';
export const absolute = path => new URL(path, ORIGIN).href;
export const brandImage = '/images/santa-radio-logo.png';
export const songPath = song => `/christmas-artist/${song.id}-${song.link}`;
export const mugPath = mug => `/mugshots/${mug.song}`;
// Confirmed identical artist, title, lyrics and video. Keep every historical URL.
export const duplicateRecordings = new Map([[233, 99], [345, 204]]);
export const songs = rawSongs.filter(s => !duplicateRecordings.has(s.id));
export const { catalogue: mugs, aliases: mugAliases } = buildCatalogue(rawMugs);
export const songRedirects = new Map();
for (const song of rawSongs) {
  const target = rawSongs.find(s => s.id === duplicateRecordings.get(song.id)) || song;
  if (target !== song) songRedirects.set(songPath(song), songPath(target));
  for (const alias of song.aliases || []) {
    const path = `/christmas-artist/${alias}`;
    if (path !== songPath(target)) songRedirects.set(path, songPath(target));
  }
}
const groups = new Set(`Wham!|Waitresses|Train|Slade|Scouting For Girls|The Ronettes|Queen|Pogues|N Sync|Mud|Mel & Kim|The Jackson 5|Hanson|Freiheit|East 17|The Darkness|Coldplay|Backstreet Boys|ABBA|Band Aid|The Beach Boys|Boyz II Men|The Carpenters|Elmo & Patsy|Extreme|Girls Aloud|Glee Cast|Hot Chocolate|Relient K|Run-DMC|S Club 7|Spice Girls|The Wombles|Tom Petty & Heartbreakers|Squeeze|Shane MacGowan & Popes|The Band|Mitch Miller and The Gang|Bob B Soxx & Blue Jeans|Showaddywaddy|State of the Heart|The Mills Brothers|Saint Etienne|Gladys Knight & The Pips|Snap!|The Moonglows|The Seekers|The Flying Pickets|The Cadillacs|The Crystals|Bjorn Again|The Pointer Sisters|The Supremes|The Fireside Singers|Eurythmics|The Magnets|Frankie Goes to Hollywood|Boney M|Eternal|Hall & Oates|Il Divo|Pet Shop Boys|SWV|The Weather Girls|3T|The Futureheads|Goodies|Nat King Cole Trio|The Osmonds|Bananarama|Big Big Train|Def Leppard|Pentatonix|The Monkees|Jonas Brothers|Blossoms|Goo Goo Dolls|Little Mix|Bastille|Bon Jovi|A1|Showaddywaddy Band|Laurel and Hardy`.split('|'));
const characters = new Set(['Elsa and Anna', 'David Brent', 'Bo Selecta', 'Geraldine McQueen', 'Rizzo Gonzo', 'Miss Piggy', 'Father Christmas', 'Santa', 'UEFA Trophy']);
const soloPeople = new Set(`Shakin Stevens|Paul McCartney|Nat King Cole|Michael Buble|Mariah Carey|Lisa Hugo|Kylie Minogue|Kelly Clarkson|Jona Lewie|Jon Bon Jovi|Johnny Mathis|John Lennon|Greg Lake|Frank Sinatra|Elton John|Dido|Dean Martin|Darlene Love|Cliff Richard|Chris Rea|Chris De Burgh|Bruce Springsteen|Brenda Lee|Bing Crosby|Ariana Grande|Andy Williams|Aled Jones|Barbra Streisand|Bobby Vee|Craig Charles|Paul Potts|Dion|Luther Vandross|Sammy Davis Jr.|Elvis Presley|Stevie Nicks|Robbie Williams|Bob Rivers|Inna|John Denver|Johnny Cash|Jonathan Antoine|Alexander O' Neal|Carly Rae Jepsen|Charles Jenkins|Cruz Beckham|Matt Terry|Levi Roots|Sia|Engelbert Humperdinck|Gwen Stefani|Sabrina Claudio|Chris Kamara|Gary Barlow|Leona Lewis|George Ezra|Kevin Bacon|Lindsey Lohan|Cher|Sam Ryder|Freya Skye|Ed Sheeran`.split('|'));
for (const name of ['Wilson Phillips', 'Scottish Quest All Stars', 'Johnny Hates Jazz', 'Damage', 'Mungo Jerry', 'Right Said Fred', 'The Sherlocks', 'Chas & Dave']) groups.add(name);
for (const name of ['Wizzard', 'Darts', 'Barenaked Ladies', 'Paul McCartney & Wings']) groups.add(name);
soloPeople.add('Taylor Swift');
soloPeople.add('Eric Clapton');
const comedyGroups = new Set(['Laurel and Hardy', 'Chuckle Brothers', 'The Krankies']);
groups.delete('Laurel and Hardy');
const collaborations = {
  'Frank Sinatra & Cyndi Lauper': ['Frank Sinatra', 'Cyndi Lauper'],
  'Frank Sinatra and Dean Martin': ['Frank Sinatra', 'Dean Martin'],
  'Bonnie Raitt & Charles Brown': ['Bonnie Raitt', 'Charles Brown'],
  'Ronnie Spector & Darlene Love': ['Ronnie Spector', 'Darlene Love'],
  'Graham Parker & Nona Hendryx': ['Graham Parker', 'Nona Hendryx'],
  'Bing Crosby & Rosemary Clooney': ['Bing Crosby', 'Rosemary Clooney'],
  'Kelly Clarkson and Brett Eldredge': ['Kelly Clarkson', 'Brett Eldredge'],
  'Kelly Clarkson & Ariana Grande': ['Kelly Clarkson', 'Ariana Grande'],
  'Ed Sheeran & Elton John': ['Ed Sheeran', 'Elton John'],
  'Ella Fitzgerald & Louis Armstrong': ['Ella Fitzgerald', 'Louis Armstrong'],
  'Barenaked Ladies & Sarah McLachlan': ['Barenaked Ladies', 'Sarah McLachlan'],
};
const entityId = name => `${ORIGIN}/#performer-${encodeURIComponent(name.toLowerCase())}`;
export function identity(name, biography = '', role = '') {
  if (characters.has(name) || /waxwork|fictional character|impersonat|trophy/i.test(role)) return null;
  if (comedyGroups.has(name)) return { '@type': 'PerformingGroup', '@id': entityId(name), name };
  if (groups.has(name)) return { '@type': 'MusicGroup', '@id': entityId(name), name };
  if (soloPeople.has(name)) return { '@type': 'Person', '@id': entityId(name), name };
  if (/&| and |^Lee-and|^Raven,/i.test(name)) return null;
  // Only classify from explicit existing biographical/role evidence.
  if (/^[^.!?]{0,100}\b(?:is|was|are|were)\s+(?:an?\s+)?(?:(?:British|American|English|Scottish|Irish|Swedish|German|Australian|vocal|pop|rock|folk|musical|soul|instrumental)\s+){0,4}(?:band|group|orchestra|ensemble|duo|trio)\b/i.test(biography))
    return { '@type': 'MusicGroup', '@id': entityId(name), name };
  if (/\b(singer|songwriter|actor|actress|presenter|comedian|musician|footballer|dancer|athlete|journalist|chef|politician|author|broadcaster|producer|artist|performer|DJ|cricketer|host|manager)\b/i.test(role) ||
      /^[^.!?]{0,120}\b(?:is|was)\b[^.!?]{0,65}\b(?:singer|songwriter|actor|actress|musician|composer|rapper|performer|pianist)\b/i.test(biography))
    return { '@type': 'Person', '@id': entityId(name), name };
  return null;
}
export function performers(song) {
  if (collaborations[song.artist]) return collaborations[song.artist].map(name => ({ '@type': groups.has(name) ? 'MusicGroup' : 'Person', '@id': entityId(name), name }));
  const entity = identity(song.artist, song.info);
  return entity ? [entity] : [];
}
export function artworkAlt(song) {
  if (artistArtwork(song.artist) === fallbackArtwork) return 'Santa Radio branded artwork: Santa with music notes';
  if (song.artist === 'Frankie Goes to Hollywood') return 'Illustration of Holly Johnson, singer with Frankie Goes to Hollywood';
  return `${song.artist} illustrated artwork`;
}
export const songDescription = song => `Explore “${song.song}” by ${song.artist}: lyrics${song.youtube ? ', the linked video' : ''} and artist background on Santa Radio.`;
export function performanceKind(song) {
  if (characters.has(song.artist)) return 'Character performance';
  if (collaborations[song.artist]) return 'Collaboration';
  const entity = identity(song.artist, song.info);
  return entity?.['@type'] === 'MusicGroup' ? 'Music group' : entity?.['@type'] === 'Person' ? 'Individual performer' : 'Catalogue performer credit';
}
export const mugDescription = mug => `${mug.artist}${mug.link ? ` (${mug.link})` : ''}, pictured with a Santa Radio mug. View the photograph${mug.credit ? `, credited to ${mug.credit}` : ''}, and biography.`;
export const identityGraph = [
  { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: 'Santa Radio', url: `${ORIGIN}/`, logo: { '@type': 'ImageObject', url: absolute(brandImage), width: 827, height: 190 } },
  { '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Santa Radio', url: `${ORIGIN}/`, inLanguage: 'en-GB', publisher: { '@id': `${ORIGIN}/#organization` } },
];
export function pageMetadata({ path, title, description, image = brandImage, imageAlt = 'Santa Radio', crumbs = [], nodes = [], collection = false, noindex = false }) {
  const url = absolute(path);
  return { path, title, description, image: absolute(image), imageAlt, url, noindex, graph: [
    ...identityGraph,
    { '@type': collection ? 'CollectionPage' : 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en-GB', isPartOf: { '@id': `${ORIGIN}/#website` }, publisher: { '@id': `${ORIGIN}/#organization` }, primaryImageOfPage: { '@id': `${url}#image` }, ...(nodes[0] ? { mainEntity: { '@id': nodes[0]['@id'] } } : {}) },
    { '@type': 'ImageObject', '@id': `${url}#image`, contentUrl: absolute(image), url: absolute(image), caption: imageAlt },
    ...(crumbs.length ? [{ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumbs`, itemListElement: crumbs.map(([name, link], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absolute(link) })) }] : []),
    ...nodes,
  ] };
}
export function songMetadata(song) {
  const path = songPath(song), url = absolute(path), artist = performers(song);
  return pageMetadata({ path, title: `${song.song} — ${song.artist} | Santa Radio`, description: songDescription(song), image: artistArtwork(song.artist), imageAlt: artworkAlt(song),
    crumbs: [['Home', '/'], ['Christmas Music', '/christmas-music'], [`${song.song} — ${song.artist}`, path]],
    nodes: [{ '@type': 'MusicRecording', '@id': `${url}#recording`, name: song.song, url, description: songDescription(song), creditText: `Catalogue performer credit: ${song.artist}`, ...(artist.length ? { byArtist: artist } : {}), image: { '@id': `${url}#image` } }] });
}
export function mugMetadata(mug) {
  const path = mugPath(mug), url = absolute(path), entity = identity(mug.artist, mug.info, mug.link);
  return pageMetadata({ path, title: `${mug.artist} — Mug Photo | Santa Radio`, description: mugDescription(mug), image: mug.image, imageAlt: `${mug.artist} with a Santa Radio mug`,
    crumbs: [['Home', '/'], ['Mug Shots', '/mugshots/all'], [mug.artist, path]],
    nodes: [
      { '@type': 'ImageObject', '@id': `${url}#photograph`, contentUrl: absolute(mug.image), caption: `${mug.artist} with a Santa Radio mug`, ...(mug.credit ? { creditText: `Photo credit: ${mug.credit}` } : {}), ...(entity ? { about: entity } : {}) },
      ...(entity ? [entity] : []),
    ] });
}
export function collectionMetadata(kind) {
  const music = kind === 'music', rows = music ? songs : [...mugs].sort((a, b) => a.artist.localeCompare(b.artist, 'en-GB'));
  const path = music ? '/christmas-music' : '/mugshots/all';
  return pageMetadata({ path, title: music ? 'Christmas Song Lyrics & Artists — Santa Radio' : 'Celebrity Mug Photos — Santa Radio',
    description: music ? `Browse ${songs.length} Christmas recordings, with lyrics, artist background and illustrated artwork. Find a song or performer in Santa Radio’s music catalogue.` : `Explore ${mugs.length} friendly celebrity photographs with Santa Radio mugs, including biographies and credited photographs. These are mug photos, not criminal mugshots.`,
    collection: true, crumbs: [['Home', '/'], [music ? 'Christmas Music' : 'Mug Shots', path]],
    nodes: [{ '@type': 'ItemList', '@id': `${absolute(path)}#list`, numberOfItems: rows.length, itemListElement: rows.map((row, i) => ({ '@type': 'ListItem', position: i + 1, name: music ? `${row.song} — ${row.artist}` : row.artist, url: absolute(music ? songPath(row) : mugPath(row)) })) }] });
}
export const trackerQuestions = [
  ['When does the Santa Tracker start?', 'The estimated Christmas Eve journey starts at 10:00 UTC on 24 December and finishes at 10:00 UTC on 25 December. The countdown is to Santa’s departure, not Christmas midnight or his arrival at your home.'],
  ['Where is Santa now?', 'The updating map shows a location on Santa Radio’s festive estimated route. Outside the journey, enjoy the North Pole preparations and holiday postcards. Santa is on holiday from March through 30 November and returns to the North Pole on 1 December.'],
  ['Is this real GPS tracking?', 'No. This is an independent festive experience created by Santa Radio, not GPS tracking or an official location feed. The route, arrival times, gifts, distance and speed are playful estimates.'],
  ['Whose local time is displayed?', 'The route clock belongs to the displayed stop’s representative location, not the visitor’s time zone. Broad regions can contain several time zones. Holiday postcard clocks are approximate.'],
  ['What happens after Christmas Day?', 'After the estimated journey finishes, the Tracker shows its completion celebration until 26 December UTC, before returning to its seasonal display.'],
  ['Can I listen while tracking Santa?', 'Yes. Use the Santa Radio player while exploring the map, or browse our Christmas music and lyrics.'],
];
export function trackerMetadata() {
  return pageMetadata({ path: '/santa-tracker', title: "Santa Tracker | Track Santa's Journey — Santa Radio",
    description: 'Track Santa on Santa Radio’s estimated Christmas Eve journey. Explore the countdown to departure, updating map, holiday postcards and Christmas questions.',
    image: '/images/santa-tracker-share.png', imageAlt: 'Santa Radio — Santa Tracker: an estimated Christmas Eve journey',
    crumbs: [['Home', '/'], ['Santa Tracker', '/santa-tracker']] });
}
