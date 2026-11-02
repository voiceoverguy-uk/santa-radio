// Run: node scripts/audit-studio-letter.mjs
// Writes a PRIVATE non-name matrix outside the public app and deployment output.
// No recording locations, IDs, names or recipient data are retained.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { workshopCatalogue } from '../server/santa-workshop-catalogue.js';
import { workshopTreatWording } from '../src/lib/workshopTreatWording.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';
import { responseLibraries } from '../src/lib/studioLetterResponses.js';

const output = '.local/studio-letter-editorial';
await mkdir(output, { recursive: true });
let catalogue;
try {
  catalogue = await workshopCatalogue();
} catch {
  await writeFile(`${output}/coverage.md`, '# Studio letter editorial coverage\n\nHosted catalogue unavailable. No complete-catalogue claim can be made; offline tests cover only their stated examples.\n');
  throw new Error('Hosted catalogue unavailable: private coverage report records the limitation.');
}
const mapping = { age: 'age', activity: 'activity', achievement: 'achievement', treat: 'treats', place: 'destination' };
const selectedValue = (category, record) => category === 'treat' ? workshopTreatWording(record.label)
  : category === 'place' ? record.label.replace(/ — (?:Fantasy place|Space destination)$/, '') : record.label;
const baseDetails = Object.fromEntries(Object.entries(mapping).map(([category, field]) =>
  [field, selectedValue(category, catalogue.categories[category][0])]));
const baseContext = Object.fromEntries(Object.entries(mapping).map(([category, field]) =>
  [field, catalogue.categories[category][0].letterContext]));
let checkedLetters = 0;
for (const [category, records] of Object.entries(catalogue.categories)) {
  for (const record of records) {
    const field = mapping[category], value = selectedValue(category, record);
    const context = record.letterContext;
    const variants = responseLibraries[field][context.group];
    assert.ok(variants?.length, `Missing ${category} response group`);
    for (const [index, response] of variants.entries()) {
      const variation = createStudioLetterVariation(() => 0);
      variation[field] = (index + .1) / variants.length;
      const letter = createStudioLetter('Editorial Example', () => 0, {
        ...baseDetails, [field]: value, context: { ...baseContext, [field]: context },
      }, variation);
      const prose = letter.paragraphs.join('\n');
      assert.ok(prose.includes(value), `Selected ${category} choice lost`);
      assert.ok(prose.includes(response), `Selected ${category} response lost`);
      assert.doesNotMatch(prose, /undefined|null|  |\.wav|\.mp3|a a |an an /);
      assert.ok(prose.length < 2600, 'Letter exceeds the verified text budget');
      assert.equal(letter.editorialReview.includes(field), context.needsReview);
      checkedLetters++;
    }
  }
}
const gaps = [];
const rows = ['# Private Studio letter coverage', '', `Audited ${new Date().toISOString()} using the existing server-side hosted catalogue loader.`,
  '', 'This is the current selectable non-name catalogue, not the public promotional subset. No names or recording locations are included.',
  '', '## Editorial policy', '',
  '- Exact selected display labels are retained; activities and achievements are quoted so noun phrases and gerunds remain grammatical.',
  '- “Extra celebration” is the existing achievement choice, never a birthday or date field.',
  '- Age bands: month-labelled ages; years 0–5, 6–12, 13–17, 18, 19+. No universal “already!” or age comparisons.',
  '- No claims about a recipient’s health, feelings, location, family structure or relative ability are inferred.',
  '- All route anecdotes are explicitly fictional workshop rehearsals. No factual cultural, weather or customary claims are used; no external factual references are needed.',
  '- Destination choice means the selected route, not a claim about where the recipient lives.',
  '- Alcohol is adults-only after flying; rum cake is ingredient-qualified. Energy drinks are not offered to children or reindeer. Reindeer food is checked by their keeper.',
  '- Joke offerings are not eaten or sincerely thanked as food. Practical gifts, messages, amusements, ordinary food and drinks have separate groups.',
  '- Original spelling, recording labels and choices are unchanged. “Enviromental awareness”, “Playing playdough”, “Tt rocksstars”, “Us Virgin Islands” remain display labels, not newly asserted facts.',
  '- “Stagecoach” is ambiguous without owner confirmation (organisation or literal vehicle); no performance assumption is made.',
  '- “T-B-L” is not expanded. The owner-approved “Falkland Islands” display correction preserves the original recording filename and identity.',
  '', '## Coverage matrix', '', '| Category | Selected display value | Response group | Status |',
  '| --- | --- | --- | --- |'];
for (const [category, records] of Object.entries(catalogue.categories)) {
  for (const record of records) {
    const { group, needsReview } = record.letterContext;
    const selected = selectedValue(category, record);
    rows.push(`| ${category} | ${selected.replace(/\|/g, '\\|')} | ${group} | ${needsReview ? 'Neutral; owner clarification needed' : 'Reviewed'} |`);
    if (needsReview) gaps.push({ category, label: record.label });
  }
}
rows.push('', '## Totals', '', ...Object.entries(catalogue.counts).map(([category, count]) =>
  `- ${category}: ${count} selectable; ${catalogue.needsReviewCounts[category]} source records held out by the existing catalogue parser (not letter editorial flags).`),
  '', '## Remaining semantic unknowns', '', ...gaps.map(({ category, label }) => `- ${category}: ${label} — retained exactly with neutral response and needsReview flag.`));
await writeFile(`${output}/coverage.md`, `${rows.join('\n')}\n`);

// Invented sample recipients only. These are never sourced from the name list.
const cases = [
  ['Robin', ['3 months old', 'Learning to talk', 'Being brave', 'Beautiful note', 'England']],
  ['Alex', ['2 years old', 'Art', 'Starting nursery', 'Smelly socks', 'Wonderland — Fantasy place']],
  ['Jamie', ['10 years old', 'Playing your musical instrument', 'Completing a jigsaw puzzle', 'Your rubbish', 'The Moon — Space destination']],
  ['Sam', ['18 years old', 'Coding', 'Doing well in your exams', 'Glass whisky', 'Japan']],
  ['Taylor', ['50 years old', 'Personal hygiene', 'Being brave', 'Map', 'Falkland Islands']],
];
const examples = [];
for (const [name, labels] of cases) {
  const details = {}, context = {};
  for (const [index, category] of Object.keys(mapping).entries()) {
    const record = catalogue.categories[category].find(record => record.label === labels[index]);
    if (!record) throw new Error(`Representative editorial choice changed in ${category}; update the private samples.`);
    const field = mapping[category];
    details[field] = category === 'treat' ? workshopTreatWording(record.label) : record.label.replace(/ — (?:Fantasy place|Space destination)$/, '');
    context[field] = record.letterContext;
  }
  const letter = createStudioLetter(name, () => 0, { ...details, context }, createStudioLetterVariation(() => (examples.length % 3) / 3));
  examples.push(`## ${name}\n\n${letter.paragraphs.join('\n\n')}\n\nSanta Claus\n\n${letter.closing.join('\n\n')}`);
}
await writeFile(`${output}/representative-letters.md`, `# Complete editorial samples (invented recipients)\n\n${examples.join('\n\n---\n\n')}\n`);
const escape = text => String(text).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let bundle;
try {
  bundle = JSON.parse(await readFile('generated-artifacts/studio-editorial/bundle-sizes.json', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contextual Santa letters: editorial samples</title>
<style>body{margin:0;background:#f2ead8;color:#19392d;font:17px/1.6 Georgia,serif}main{max-width:820px;margin:auto;padding:32px 20px}
h1,h2{line-height:1.2}article{background:#fffdf5;padding:clamp(20px,5vw,48px);margin:32px 0;border:1px solid #b89d60}small{font-family:system-ui,sans-serif}p{margin:0 0 1em}li{margin-bottom:8px}</style>
<main><h1>Contextual Santa letters</h1><p>Editorial review samples with invented recipients. These are not paid bundle documents, and do not create a PDF or deliver a message.</p>
<h2>Coverage</h2><p>The hosted catalogue was read successfully: ${Object.entries(catalogue.counts).map(([category, count]) => `${count} ${escape(category)} choices`).join(', ')}.
Every selectable non-name choice was audited, with ${checkedLetters} complete letters checked across its response alternatives.
The public promotional choices remain a deliberately small subset, not a representation of the full catalogue.</p>
<p>Semantic questions remain for ${gaps.map(({ label }) => escape(label)).join(', ')}. These keep neutral, grammatical responses and an editorial review flag; their meaning has not been invented.</p>
<p>All route anecdotes are explicitly fictional. No cultural traditions, local weather or personal circumstances are asserted.
Alcohol remains adults-only after flying, reindeer food is checked by their keeper, and joke offerings are not eaten.</p>
<h2>Runtime impact</h2><p>${bundle ? `Measured client JavaScript increase: ${bundle.added.raw.toLocaleString('en-GB')} bytes minified, ${bundle.added.gzip.toLocaleString('en-GB')} bytes gzip, across the client chunks using identical build settings.` : 'Bundle impact has not yet been measured in this workspace.'}
No runtime AI calls, new dependencies, recording changes, new personal-data storage or fulfilment changes.</p>
<h2>Complete representative letters</h2>${examples.map(example => `<article>${example.split('\n\n').map((paragraph, index) =>
  index === 0 ? `<h2>${escape(paragraph.replace(/^## /, ''))}</h2>` : `<p>${escape(paragraph)}</p>`).join('')}</article>`).join('')}
<small>The private coverage matrix remains outside the public build. To repeat the audit, run node scripts/audit-studio-letter.mjs in the authorised workspace.</small></main></html>`;
await mkdir('generated-artifacts/studio-editorial', { recursive: true });
await writeFile('generated-artifacts/studio-editorial/editorial-samples.html', html);
console.log(JSON.stringify({ counts: catalogue.counts, checkedLetters, editorialGaps: gaps, privateOutput: output }, null, 2));
