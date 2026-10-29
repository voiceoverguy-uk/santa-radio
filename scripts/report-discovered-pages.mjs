// Derive the portable owner report and representative content evidence from saved
// observations. No network calls, catalogue changes or indexing-policy decisions.
import { readFile, writeFile } from 'node:fs/promises';
import { songs, songPath, ORIGIN } from '../src/seo/catalogue.js';
import { sha256 } from './discovered-pages-lib.mjs';

const dir = 'docs/search-console-discovered';
const audit = JSON.parse(await readFile(`${dir}/live-audit.json`, 'utf8'));
const narrative = await readFile(`${dir}/README.md`, 'utf8');
const ids = [3, 115, 143, 84, 330, 10, 135, 181];
const pairs = ids.map(id => {
  const song = songs.find(song => song.id === id);
  const songUrl = ORIGIN + songPath(song);
  const lyricsUrl = songUrl.replace('/christmas-artist/', '/christmas-karaoke-lyrics/');
  const songEvidence = audit.documents[songUrl], lyricsEvidence = audit.documents[lyricsUrl];
  const a = songEvidence?.document, b = lyricsEvidence?.document;
  const available = songEvidence?.finalStatus === 200 && lyricsEvidence?.finalStatus === 200 && a && b;
  return { id, artist: song.artist, title: song.song, songUrl, lyricsUrl,
    linkedVideoId: song.youtube || null,
    comparisonAvailable: !!available,
    ...(available ? {
      sameInitialLyrics: a.lyrics === b.lyrics, lyricsCharacters: b.lyrics.length,
      songMainCharacters: a.mainCharacters, lyricsMainCharacters: b.mainCharacters,
      songHasArtistBackground: a.hasBackground, lyricsHasArtistBackground: b.hasBackground,
      lyricsSha256: sha256(b.lyrics),
      lyricsExcerpt: b.lyrics.slice(0, 120),
      songH1: a.h1, lyricsH1: b.h1,
    } : { limitation: 'One or both documents unavailable; no overlap inferred' }),
  };
});
await writeFile(`${dir}/representative-pairs.json`, JSON.stringify(pairs, null, 2) + '\n');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cell = value => `<td>${escape(typeof value === 'object' ? JSON.stringify(value) : value)}</td>`;
const table = audit.rows.map(row => {
  const live = row.live, doc = live.document;
  const problems = [...row.technicalObservations,
    ...row.discovery.filter(e => e.result !== 'linked').map(e => `${e.result}: ${e.from} → ${e.to}`)];
  return `<tr>${[
    row.row, row.url, row.family, live.error || live.finalStatus,
    live.chain.map(e => `${e.status} ${e.url}${e.location ? ' → ' + e.location : ''}`).join('\n'),
    `eligible=${row.sourceEligible}; local HTTP=${row.localStatus}; noindex=${row.localNoindex}; lyrics characters=${row.lyricsCharacters ?? 'n/a'}`,
    row.expectedCanonical, doc?.canonicals ?? 'unavailable',
    `meta=${doc?.robots.join('; ') ?? 'unavailable'}; X-Robots-Tag=${live.xRobotsTag ?? 'absent'}; robots=${audit.robots.finalStatus === 200 ? audit.robots.text : 'unavailable'}`,
    `local=${row.localSitemap}; live=${row.liveSitemap ?? 'unavailable'}`,
    `H1=${doc?.h1 ?? 'unavailable'}; main characters=${doc?.mainCharacters ?? 'unavailable'}`,
    row.discovery.map(e => `${e.result}: ${e.from} → ${e.to}`).join('\n'),
    live.checkedAt ?? 'see chain', problems.length ? problems.join('; ') : 'No fault found in these checks',
  ].map(cell).join('')}</tr>`;
}).join('\n');
const headings = ['Export row', 'Exact exported URL', 'Family', 'Live result', 'Redirect chain', 'Source eligibility (local, not Google)', 'Expected canonical', 'Observed canonical', 'Crawl directives', 'Sitemap inclusion', 'Initial content', 'Server-rendered discovery path', 'Checked (UTC)', 'Observations'];
const pairRows = pairs.map(pair => `<tr>${[pair.artist + ' — ' + pair.title, pair.songUrl, pair.lyricsUrl,
  pair.comparisonAvailable ? `Identical lyrics=${pair.sameInitialLyrics}; ${pair.lyricsCharacters} normalised characters; main characters song/lyrics=${pair.songMainCharacters}/${pair.lyricsMainCharacters}; background on song/lyrics=${pair.songHasArtistBackground}/${pair.lyricsHasArtistBackground}; video=${pair.linkedVideoId}` : pair.limitation].map(cell).join('')}</tr>`).join('');
await writeFile(`${dir}/report.html`, `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Discovered-page indexing audit — 447 exact URLs</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;color:#173326;background:#f7faf8}main{max-width:1200px;margin:auto;padding:28px}h1,h2{line-height:1.2}pre{white-space:pre-wrap;font:inherit}section{background:white;padding:24px;margin:24px 0;border:1px solid #c9d7ce;border-radius:8px}.scroll{overflow:auto;max-height:75vh}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:10px;text-align:left;vertical-align:top;border:1px solid #c9d7ce;min-width:160px;overflow-wrap:anywhere;white-space:pre-wrap}th{position:sticky;top:0;background:#173326;color:white}input{font:inherit;padding:10px;width:min(95%,650px)}label{display:block}a{color:#146745}</style>
<main><h1>447 discovered but currently unindexed pages</h1><p>Read-only observations: ${escape(audit.startedAt)} to ${escape(audit.finishedAt)}. This is not a Google indexing decision.</p>
<section><h2>Findings and owner checklist</h2><pre>${escape(narrative)}</pre></section>
<section><h2>Representative rendered page pairs</h2><div class="scroll"><table><thead><tr>${['Recording', 'Song page', 'Lyrics page', 'Saved live HTML comparison'].map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${pairRows}</tbody></table></div></section>
<section><h2>Complete 447-row audit</h2><p>All rows remain available without JavaScript. “Eligible” means a retained local route and source record, not guaranteed eligibility for Google indexing. Unknown or unavailable checks must not be read as passes.</p><label for="search">Filter by URL, performer, family or observation</label><input id="search" type="search"><p id="count">447 rows</p><div class="scroll"><table id="inventory"><thead><tr>${headings.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${table}</tbody></table></div></section>
<script>document.getElementById('search').addEventListener('input',function(){let count=0;for(const row of document.querySelectorAll('#inventory tbody tr')){row.hidden=!row.textContent.toLowerCase().includes(this.value.toLowerCase());if(!row.hidden)count++}document.getElementById('count').textContent=count+' rows'});</script></main></html>`);
console.log(JSON.stringify(pairs, null, 2));
