import { mkdir, writeFile } from 'node:fs/promises';
import { songs, mugs, performers, identity, performanceKind, songPath, mugPath } from '../src/seo/catalogue.js';
import { legacyMatches } from '../src/seo/routes.js';
const rows = [['Category', 'Subject', 'Path', 'Existing external link', 'Review needed']];
for (const song of songs) {
  if (!performers(song).length) rows.push([
    performanceKind(song) === 'Character performance' ? 'Character performance' : 'Unresolved performer classification',
    `${song.song} — ${song.artist}`, songPath(song), '',
    performanceKind(song) === 'Character performance' ? 'Character credit retained; no real-person performer identity invented.' : 'Confirm solo person, group or collaboration from a reliable source before adding performer entities.',
  ]);
}
for (const mug of mugs) {
  if (!identity(mug.artist, mug.info, mug.link)) rows.push(['Photo subject classification', mug.artist, mugPath(mug), '', 'Photo and biography retained. Confirm person/group/character/object classification; no subject entity invented.']);
  if (mug.socialUrl) rows.push(['Unverified external identity', mug.artist, mugPath(mug), mug.socialUrl, 'Not included in sameAs. Verify actual ownership/identity before schema use.']);
}
for (const { legacy, target } of legacyMatches) if (!target) rows.push(['Unmatched legacy recording', `${legacy.artist} — ${legacy.song}`, `/artist?s=${legacy.id}`, '', 'No unique exact artist/title match. Original route retained with noindex; no guessed redirect.']);
for (const slug of ['showaddywaddy-singers', 'showaddywaddy-band']) rows.push(['Distinct-photo review', 'Showaddywaddy', `/mugshots/${slug}`, '', 'Different photographs retained despite shared biography. Editorial confirmation required before consolidation.']);
const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
await mkdir('generated-artifacts', { recursive: true });
await writeFile('generated-artifacts/seo-editorial-review.csv', '\ufeff' + csv);
console.log(`Editorial review: ${rows.length - 1} entries, including ${rows.filter(r => r[0] === 'Unverified external identity').length} external links intentionally omitted from schema.`);
