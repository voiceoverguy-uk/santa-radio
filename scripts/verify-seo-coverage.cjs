const fs = require('fs');
const zlib = require('zlib');

const ZIP_PATH = 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip';

function extractSitemap() {
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
      if (method === 0) return buf.slice(dataStart, dataStart + uncompSize).toString('utf-8');
      if (method === 8) return zlib.inflateRawSync(buf.slice(dataStart, dataStart + compSize)).toString('utf-8');
    }
  }
  console.error('sitemap.xml not found');
  process.exit(1);
}

function findSong(songsData, rawSlug) {
  const slug = rawSlug.replace(/[?&#]/g, '');
  const exactMatch = songsData.find(s => `${s.id}-${s.link}` === slug);
  if (exactMatch) return exactMatch;
  if (/^\d+$/.test(slug)) {
    return songsData.find(s => s.id === parseInt(slug, 10));
  }
  const slugPart = slug.replace(/^\d+-/, '');
  return songsData.find(s => s.link === slugPart);
}

function findMugshot(mugshotsData, slug) {
  return mugshotsData.find(m => m.song === slug);
}

const xml = extractSitemap();
const songsData = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf-8'));
const mugshotsData = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf-8'));

const locRegex = /<loc>(.*?)<\/loc>/g;
let match;

const results = { mugshot: { total: 0, pass: 0, fail: [] }, song: { total: 0, pass: 0, fail: [] }, karaoke: { total: 0, pass: 0, fail: [] } };

while ((match = locRegex.exec(xml)) !== null) {
  const url = match[1];

  if (url.includes('/mugshots/') && !url.endsWith('/mugshots/all') && !url.endsWith('/mugshots/')) {
    const slug = url.split('/mugshots/')[1].replace(/\/$/, '');
    if (!slug) continue;
    results.mugshot.total++;
    if (findMugshot(mugshotsData, slug)) results.mugshot.pass++;
    else results.mugshot.fail.push(slug);
  }

  if (url.includes('/christmas-artist/')) {
    const slug = url.split('/christmas-artist/')[1].replace(/\/$/, '');
    if (!slug) continue;
    results.song.total++;
    if (findSong(songsData, slug)) results.song.pass++;
    else results.song.fail.push(slug);
  }

  if (url.includes('/christmas-karaoke-lyrics/')) {
    const slug = url.split('/christmas-karaoke-lyrics/')[1].replace(/\/$/, '');
    if (!slug) continue;
    results.karaoke.total++;
    if (findSong(songsData, slug)) results.karaoke.pass++;
    else results.karaoke.fail.push(slug);
  }
}

let allPass = true;
for (const [section, r] of Object.entries(results)) {
  const status = r.fail.length === 0 ? 'PASS' : 'FAIL';
  if (status === 'FAIL') allPass = false;
  console.log(`${section}: ${r.pass}/${r.total} ${status}`);
  if (r.fail.length > 0) {
    console.log(`  Missing: ${r.fail.join(', ')}`);
  }
}

if (!allPass) {
  console.error('\nSEO coverage verification FAILED');
  process.exit(1);
} else {
  console.log('\nAll legacy URLs resolve correctly. SEO coverage verified.');
}
