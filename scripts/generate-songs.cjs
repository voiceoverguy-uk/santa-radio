const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ZIP_PATH = 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip';
const JSON_PATH = 'src/data/songs.json';

function titleCase(str) {
  return str.split('-').map(w => {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ').replace(/\s+/g, ' ').trim();
}

function extractSitemapFromZip() {
  const buf = fs.readFileSync(ZIP_PATH);

  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) { console.error('Invalid zip'); process.exit(1); }

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let offset = cdOffset;

  for (let i = 0; i < totalEntries && offset < buf.length; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const uncompSize = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    offset += 46 + nameLen + extraLen + commentLen;

    if (name === 'sitemap.xml') {
      const localNameLen = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;

      if (method === 0) {
        return buf.slice(dataStart, dataStart + uncompSize).toString('utf-8');
      } else if (method === 8) {
        return zlib.inflateRawSync(buf.slice(dataStart, dataStart + compSize)).toString('utf-8');
      }
    }
  }
  console.error('sitemap.xml not found in zip');
  process.exit(1);
}

function generateSongs() {
  const xml = extractSitemapFromZip();

  const locRegex = /<loc>(.*?)<\/loc>/g;
  const songSlugs = [];
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1];
    if (url.includes('/christmas-artist/')) {
      const slug = url.split('/christmas-artist/')[1].replace(/\/$/, '');
      if (slug) songSlugs.push(slug);
    }
  }

  console.log(`Found ${songSlugs.length} song URLs in sitemap`);

  const SONG_START_WORDS = new Set([
    'the','a','an','all','i','my','oh','do','have','let','white','jingle',
    'silent','rudolph','frosty','winter','christmas','santa','deck','joy',
    'away','hark','o','we','last','baby','little','blue','rockin','sleigh',
    'mary','holy','it','merry','god','please','what','where','when','who',
    'how','come','here','this','that','run','walking','driving','step',
    'stop','stay','underneath','under','up','one','12','its','youre',
    'somewhere','happy','wonderful','feliz','grandma','carol','ring',
    'eight','cold','believe','ill','rock','dream','dj','2000','everybody',
    'chestnuts','peace','ave','in','on','at','are','bring','put','must',
    'so','fairy','river','songs','sing','thank','warm','snow','nuttin',
    'dont','way','cozy','cool','pine','pretty','most','kiss','reggae',
    'another','just','not','north','hey','wrap','no','night','very','bells',
    'rocking','first','home','hallelujah','grown','cried','mistletoe',
  ]);

  function parseArtistSong(slugPart) {
    if (!slugPart) return { artist: 'Unknown', song: 'Unknown' };
    const parts = slugPart.split('-');
    let bestSplit = Math.min(2, parts.length);
    for (let i = 1; i < parts.length; i++) {
      if (SONG_START_WORDS.has(parts[i].toLowerCase())) {
        bestSplit = i;
        break;
      }
    }
    if (bestSplit >= parts.length) bestSplit = Math.min(2, parts.length);
    const artist = titleCase(parts.slice(0, bestSplit).join('-'));
    const song = titleCase(parts.slice(bestSplit).join('-')) || artist;
    return { artist, song };
  }

  const songs = songSlugs.map(fullSlug => {
    const dashIdx = fullSlug.indexOf('-');
    let id, slugPart;
    if (dashIdx < 0 || /^\d+$/.test(fullSlug)) {
      id = parseInt(fullSlug, 10) || 0;
      slugPart = '';
    } else {
      id = parseInt(fullSlug.substring(0, dashIdx), 10) || 0;
      slugPart = fullSlug.substring(dashIdx + 1);
    }

    slugPart = slugPart.replace(/[?&#]/g, '');

    const { artist, song } = parseArtistSong(slugPart);

    return {
      id,
      artist,
      song,
      info: '',
      image: '',
      lyrics: '',
      link: slugPart,
      youtube: ''
    };
  });

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(songs, null, 2));
  console.log(`Generated ${songs.length} song entries in ${JSON_PATH}`);
}

generateSongs();
