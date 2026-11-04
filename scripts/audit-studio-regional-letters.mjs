// PRIVATE reports only. Exact current labels/aliases, but no paths, IDs, names
// from the name inventory, audio or public exports. Run the source check first.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { workshopCatalogue } from '../server/santa-workshop-catalogue.js';
import { regionalEditorialInventory, regionalAliases } from '../server/studio-regional-stories.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';
import { workshopTreatWording } from '../src/lib/workshopTreatWording.js';

const output = '.local/studio-letter-editorial';
await mkdir(output, { recursive: true });
let catalogue;
try { catalogue = await workshopCatalogue(); }
catch {
  await writeFile(`${output}/regional-coverage.md`, '# Regional letter coverage\n\nHosted catalogue unavailable. No complete-catalogue claim can be made.\n');
  throw new Error('Hosted catalogue unavailable; recorded in private regional coverage report.');
}
let sources = [];
try { sources = JSON.parse(await readFile(`${output}/regional-source-checks.json`, 'utf8')); }
catch { /* Explicit missing-source flags below; never silently approve. */ }
const rows = ['# Private regional letter coverage', '', `Hosted index checked ${new Date().toISOString()}.`,
  '', 'Coverage is of current selectable recordings, not every administrative area. Names, IDs and source recording URLs are omitted.',
  'Aliases are explicit and parent-qualified. Historical county terms are catalogue labels, not a claim about present administrative boundaries.',
  '', '| Parent group | Exact selected label | Editorial label / alias | Alternatives | Source evidence | Review |',
  '| --- | --- | --- | --- | --- | --- |'];
const totals = {}, gaps = [], samples = [], sampleKeys = new Set(['Florida', 'West Yorkshire', 'City of Edinburgh', 'Cardiff', 'Antrim']);
const catalogueLimitations = [];
if (!catalogue.regionalGroups['wales-counties'].records.some(record => record.label.toLowerCase() === 'gwynedd')) {
  catalogueLimitations.push('Gwynedd is not currently returned as a selectable Welsh region. The 21 Welsh selections are not all 22 principal areas; no recording or choice has been invented.');
}
let letters = 0;
const mapping = { age: 'age', activity: 'activity', achievement: 'achievement', treat: 'treats', place: 'destination' };
const base = {}, context = {};
for (const [category, field] of Object.entries(mapping)) {
  const record = catalogue.categories[category][0];
  base[field] = category === 'treat' ? workshopTreatWording(record.label) : record.label;
  context[field] = record.letterContext;
}
for (const [folder, group] of Object.entries(catalogue.regionalGroups)) {
  const parent = catalogue.categories.place.find(record => record.id === group.parentId);
  totals[folder] = { available: group.records.length, reviewed: 0, alternatives: 0,
    excludedAudio: group.excludedAudioCount, heldSourceRecords: group.needsReviewCount, parentAvailable: !!parent };
  if (!parent || !group.records.length || group.excludedAudioCount || group.needsReviewCount) gaps.push(`${folder}: parent=${!!parent}; available=${group.records.length}; excluded audio=${group.excludedAudioCount}; held source records=${group.needsReviewCount}.`);
  for (const record of group.records) {
    const normalised = record.label.toLowerCase();
    const canonical = regionalAliases[folder][normalised] || record.label;
    const entry = regionalEditorialInventory[folder][canonical.toLowerCase()];
    const source = sources.find(source => source.folder === folder && source.label === entry?.label);
    const checked = !!source?.status.startsWith('Location evidence found');
    const { passages, needsReview } = record.letterContext;
    if (needsReview || !checked) gaps.push(`${folder} / ${record.label}: ${needsReview ? 'neutral fallback; editorial clarification required' : 'source evidence missing or unresolved'}.`);
    rows.push(`| ${folder} | ${record.label} | ${entry?.label || 'Unresolved'} | ${passages?.length || 0} | ${checked ? `[Location note](${source.url})` : source?.status || 'Source check unavailable'} | ${needsReview ? 'Needs editorial review; neutral' : 'Prose desk-reviewed'} |`);
    if (!needsReview) {
      assert.ok(passages.length >= 2 && passages.length <= 3);
      assert.equal(new Set(passages).size, passages.length);
      totals[folder].reviewed++;
      totals[folder].alternatives += passages.length;
    }
    for (const [index, passage] of (passages || []).entries()) {
      const variation = createStudioLetterVariation(() => .2);
      variation.destination = (index + .1) / passages.length;
      const details = { ...base, destination: `${record.label}, ${parent.label}`,
        context: { ...context, destination: record.letterContext } };
      const letter = createStudioLetter('Editorial Example', () => { throw Error('Unexpected randomness'); }, details, variation);
      assert.equal(letter.paragraphs.length, 12);
      assert.ok(letter.paragraphs[6].includes(passage));
      assert.ok(letter.paragraphs[6].includes(details.destination));
      assert.ok(!letter.editorialReview.includes('destination'));
      const renamed = createStudioLetter('Edited Example', () => 0, { ...details, activity: 'Reading books' }, variation);
      assert.equal(renamed.paragraphs[6], letter.paragraphs[6]);
      assert.match(passage, /pretend/);
      assert.doesNotMatch(passage, /\b(pub|beer|wine|whisky|drunk|your home|you live|you visited)\b/i);
      letters++;
      if (sampleKeys.has(record.label)) samples.push({ label: details.destination, index: index + 1, passage });
    }
  }
}
rows.push('', '## Totals', '', ...Object.entries(totals).map(([folder, result]) => `- ${folder}: ${JSON.stringify(result)}`),
  '', `${letters} complete letters exercised across all available regional alternatives.`,
  '', '## Catalogue availability limitations', '',
  ...(catalogueLimitations.length ? catalogueLimitations.map(note => `- ${note}`) : ['No additional known geographical omissions.']),
  '', '## Unavailable entries and unresolved issues', '',
  ...(gaps.length ? gaps.map(gap => `- ${gap}`) : ['None in the current hosted regional selections. This is not a claim that every geographical area has a recording.']),
  '', '## Owner inspection samples', '', ...samples.flatMap(sample => [`### ${sample.label} — alternative ${sample.index}`, '', sample.passage, '']));
await writeFile(`${output}/regional-coverage.md`, rows.join('\n') + '\n');
// Durable owner-inspection snapshot beside the server-only editorial sources,
// never imported by browser code or placed in the public/deployment output.
if (process.argv.includes('--snapshot')) {
  await writeFile('server/studio-regional-coverage.md', rows.join('\n') + '\n');
}
await writeFile(`${output}/regional-metrics.json`, JSON.stringify({ totals, letters, gaps, catalogueLimitations }, null, 2));
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Regional Santa letter samples</title><style>body{font:18px/1.6 Georgia,serif;background:#fffaf0;color:#173b2b;max-width:850px;margin:32px auto;padding:0 24px}h1,h2{line-height:1.2}article{border-top:1px solid #b79b59;padding:16px 0}small{font-family:system-ui,sans-serif}</style>
<h1>Regional Santa letter stories</h1><p>Two short, curated alternatives per current regional choice. The selected story replaces the neutral destination passage; it adds no paragraph or question.</p>
<p>${Object.values(totals).reduce((sum, row) => sum + row.available, 0)} selectable regional recordings; ${letters} complete regional alternatives checked. These include explicit aliases; the private library has ${Object.values(regionalEditorialInventory).reduce((sum, entries) => sum + Object.keys(entries).length, 0)} canonical regional entries.</p>
<p>${gaps.length ? `${gaps.length} unresolved source/catalogue issues are listed in the private coverage report; do not claim full reviewed coverage.` : 'No unresolved current-catalogue or location-source issues. This does not claim a recording exists for every geographical area.'}</p>
${catalogueLimitations.map(note => `<p>${escape(note)}</p>`).join('')}
<p>All incidents are fictional workshop rehearsals. Landmarks are not claims about a recipient’s home, visits, local customs or endorsements. The same page-local choice survives spelling changes and unrelated edits.</p>
${samples.map(sample => `<article><h2>${escape(sample.label)} · ${sample.index}</h2><p>${escape(sample.passage)}</p></article>`).join('')}
<small>Owner inspection sample only, not the private catalogue. No recordings, recipient data, paid fulfilment or audio changes.</small></html>`;
await mkdir('generated-artifacts/studio-editorial', { recursive: true });
await writeFile('generated-artifacts/studio-editorial/regional-samples.html', html);
console.log(JSON.stringify({ totals, letters, gaps, catalogueLimitations, privateReport: `${output}/regional-coverage.md` }, null, 2));
if (gaps.length) process.exitCode = 1;
