const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ZIP_PATH = 'attached_assets/Santa_Radio_mugshot-images_1774460167106.zip';
const IMG_DIR = 'public/mugshot-images';
const JSON_PATH = 'src/data/mugshots.json';

const ROLE_WORDS = new Set([
  'actor','actress','singer','dancer','comedian','presenter','mp','footballer',
  'chef','tv','radio','bbc','itv','model','musician','olympian','paralympian',
  'producer','director','dj','host','journalist','correspondent','author',
  'writer','athlete','boxer','cricketer','cyclist','golfer','gymnast',
  'rugby','snooker','swimmer','tennis','wrestler','weatherman','weathergirl',
  'magician','illusionist','ventriloquist','puppeteer','personality',
  'vlogger','youtuber','influencer','blogger','entertainer','newsreader',
  'commentator','pundit','analyst','therapist','doctor','scientist',
  'astronaut','pilot','explorer','adventurer','campaigner','activist',
  'charity','philanthropist','royalty','royal','duke','duchess','prince',
  'princess','lord','lady','sir','dame','baroness','earl','countess',
  'vicar','bishop','archbishop','reverend','cardinal','pope',
  'gmb','eastenders','coronation','emmerdale','hollyoaks','strictly',
  'xfactor','x-factor','bgt','apprentice',
  'player','star','legend','champion','winner','contestant','judge',
  'captain','manager','coach','trainer','instructor',
  'drag','queen','king','performer',
  'tv-personality','radio-presenter','tv-presenter','football','cricket',
]);

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function extractImages() {
  if (!fs.existsSync(ZIP_PATH)) {
    console.error('Zip file not found:', ZIP_PATH);
    process.exit(1);
  }

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const buf = fs.readFileSync(ZIP_PATH);

  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) { console.error('Invalid zip'); process.exit(1); }

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);

  let offset = cdOffset;
  let extracted = 0;
  let skipped = 0;

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

    if (name.endsWith('/') || name.startsWith('__MACOSX') || !/\.(jpg|jpeg|png|webp)$/i.test(name)) {
      skipped++;
      continue;
    }

    if (buf.readUInt32LE(localOffset) !== 0x04034b50) continue;
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;

    const basename = path.basename(name).replace(/ /g, '-');
    const outPath = path.join(IMG_DIR, basename);

    if (method === 0) {
      fs.writeFileSync(outPath, buf.slice(dataStart, dataStart + uncompSize));
      extracted++;
    } else if (method === 8) {
      try {
        const decompressed = zlib.inflateRawSync(buf.slice(dataStart, dataStart + compSize));
        fs.writeFileSync(outPath, decompressed);
        extracted++;
      } catch (e) {
        console.error('Failed:', basename, e.message);
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`Extracted: ${extracted}, Skipped: ${skipped}`);
}

function generateJson() {
  const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const mugshots = [];
  const seen = new Set();

  for (const file of files) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);

    if (/^(IMG_|DSC|DSCN|\d+$)/.test(base) || /^1\d{12}/.test(base)) continue;

    const parts = base.split(/[-_]+/);
    let nameEnd = parts.length;
    for (let i = 0; i < parts.length; i++) {
      if (ROLE_WORDS.has(parts[i].toLowerCase())) { nameEnd = i; break; }
    }
    if (nameEnd < 1) nameEnd = Math.min(2, parts.length);

    const name = titleCase(parts.slice(0, nameEnd).join(' '));
    const role = parts.slice(nameEnd).length > 0 ? titleCase(parts.slice(nameEnd).join(' ')) : '';
    const slug = base.toLowerCase().replace(/\s+/g, '-');

    const nameKey = name.toLowerCase();
    if (seen.has(nameKey)) continue;
    seen.add(nameKey);

    mugshots.push({ artist: name, song: slug, image: '/mugshot-images/' + file, link: role });
  }

  mugshots.sort((a, b) => a.artist.localeCompare(b.artist));
  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(mugshots, null, 2));
  console.log(`Generated ${mugshots.length} entries in ${JSON_PATH}`);
}

function addSitemapEntries() {
  const PHP_ZIP = 'attached_assets/Public_Folder_Santa_Radio_PHP_Files_1774459903533.zip';
  if (!fs.existsSync(PHP_ZIP)) {
    console.log('PHP zip not found, skipping sitemap validation');
    return;
  }

  const buf = fs.readFileSync(PHP_ZIP);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return;

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let offset = cdOffset;
  let xml = null;

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
      if (method === 0) xml = buf.slice(dataStart, dataStart + uncompSize).toString('utf-8');
      else if (method === 8) xml = zlib.inflateRawSync(buf.slice(dataStart, dataStart + compSize)).toString('utf-8');
      break;
    }
  }

  if (!xml) return;

  const locRegex = /<loc>(.*?)<\/loc>/g;
  const mugshotSlugs = [];
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1];
    if (url.includes('/mugshots/') && !url.endsWith('/mugshots/all') && !url.endsWith('/mugshots/')) {
      const slug = url.split('/mugshots/')[1].replace(/\/$/, '');
      if (slug) mugshotSlugs.push(slug);
    }
  }

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  const existingSlugs = new Set(data.map(m => m.song));
  let added = 0;

  for (const slug of mugshotSlugs) {
    if (!existingSlugs.has(slug)) {
      const parts = slug.split('-');
      let nameEnd = parts.length;
      for (let i = 0; i < parts.length; i++) {
        if (ROLE_WORDS.has(parts[i].toLowerCase())) { nameEnd = i; break; }
      }
      if (nameEnd < 1) nameEnd = Math.min(2, parts.length);
      const name = titleCase(parts.slice(0, nameEnd).join(' '));
      const role = parts.slice(nameEnd).length > 0 ? titleCase(parts.slice(nameEnd).join(' ')) : '';
      data.push({ artist: name, song: slug, image: '', link: role });
      existingSlugs.add(slug);
      added++;
    }
  }

  if (added > 0) {
    data.sort((a, b) => a.artist.localeCompare(b.artist));
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
    console.log(`Added ${added} mugshot entries from sitemap, total: ${data.length}`);
  } else {
    console.log('All sitemap mugshot slugs already present');
  }
}

function validate() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  let missing = 0;
  for (const m of data) {
    if (!m.image) continue;
    const imgPath = path.join('public', m.image);
    if (!fs.existsSync(imgPath)) {
      missing++;
    }
  }
  const imgFiles = fs.readdirSync(IMG_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  console.log(`Validation: ${data.length} JSON entries, ${imgFiles.length} image files, ${missing} with missing images`);
}

extractImages();
generateJson();
addSitemapEntries();
validate();
