// Run: node scripts/audit-studio-letter.mjs
// Writes a PRIVATE non-name matrix outside the public app and deployment output.
// No recording locations, IDs, names or recipient data are retained.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { workshopCatalogue } from '../server/santa-workshop-catalogue.js';
import { workshopTreatWording } from '../src/lib/workshopTreatWording.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';
import { responseLibraries } from '../src/lib/studioLetterResponses.js';
import { letterNarratives } from '../src/lib/studioLetterNarratives.js';

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
for (const category of Object.keys(mapping)) {
  const records = catalogue.categories[category];
  for (const record of records) {
    const field = mapping[category], value = selectedValue(category, record);
    const context = record.letterContext;
    if (category === 'place' && context.group === 'real') {
      assert.ok(context.passages?.length, 'Real destination lacks dedicated reviewed writing');
    }
    const variants = context.passages || responseLibraries[field][context.group];
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
   '- All route anecdotes are explicitly fictional workshop rehearsals. Landmark anchors are checked in the private source notes; no local weather, customs or residence are inferred.',
  '- Destination choice means the selected route, not a claim about where the recipient lives.',
  '- Alcohol is adults-only after flying; rum cake is ingredient-qualified. Energy drinks are not offered to children or reindeer. Reindeer food is checked by their keeper.',
  '- Joke offerings are not eaten or sincerely thanked as food. Practical gifts, messages, amusements, ordinary food and drinks have separate groups.',
  '- Original spelling, recording labels and choices are unchanged. “Enviromental awareness”, “Playing playdough”, “Tt rocksstars”, “Us Virgin Islands” remain display labels, not newly asserted facts.',
  '- “Stagecoach” is ambiguous without owner confirmation (organisation or literal vehicle); no performance assumption is made.',
  '- “T-B-L” is not expanded. The owner-approved “Falkland Islands” display correction preserves the original recording filename and identity.',
  '', '## Coverage matrix', '', '| Category | Selected display value | Response group | Status |',
  '| --- | --- | --- | --- |'];
for (const category of Object.keys(mapping)) {
  const records = catalogue.categories[category];
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
  ['Sam', ['18 years old', 'Coding', 'Doing well in your exams', 'Glass whisky', 'United States']],
  ['Taylor', ['50 years old', 'Personal hygiene', 'Being brave', 'Map', 'Canada']],
  ['Taylor', ['50 years old', 'Personal hygiene', 'Being brave', 'Map', 'Canada']],
  ['Morgan', ['10 years old', 'Art', 'Being brave', 'Beautiful note', 'Germany']],
  ['Morgan', ['10 years old', 'Art', 'Being brave', 'Beautiful note', 'Germany']],
  ['Casey', ['17 years old', 'Coding', 'Doing well in your exams', 'Christmas cracker', 'France']],
  ['Rowan', ['10 years old', 'Art', 'Being brave', 'Beautiful note', 'Scotland']],
  ['Ellis', ['10 years old', 'Art', 'Being brave', 'Beautiful note', 'Wales']],
  ['Drew', ['50 years old', 'Coding', 'Being brave', 'Map', 'Northern Ireland']],
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
  const letter = createStudioLetter(name, () => 0, { ...details, context }, createStudioLetterVariation(() => (examples.length % 20) / 20));
  examples.push(`## ${name}\n\n${letter.paragraphs.join('\n\n')}\n\nSanta Claus\n\n${letter.closing.join('\n\n')}`);
}
await writeFile(`${output}/representative-letters.md`, `# Complete editorial samples (invented recipients)\n\n${examples.join('\n\n---\n\n')}\n`);
// Measured outputs, not a theoretical uniqueness claim. Fixed choices and name;
// only independent page-local slots vary. Reproducible editorial test PRNG.
let seed = 563;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2 ** 32; };
const distinct = {};
for (const age of ['10 years old', '50 years old']) {
  const outputs = new Set();
  for (let i = 0; i < 1000; i++) outputs.add(JSON.stringify(createStudioLetter('Invented Example', () => 0,
    { ...baseDetails, age, context: { ...baseContext, age: undefined } }, createStudioLetterVariation(random))));
  distinct[age] = { sampled: 1000, distinct: outputs.size };
}
const narrativeCounts = Object.fromEntries(Object.entries(letterNarratives).map(([role, bands]) =>
  [role, Object.fromEntries(Object.entries(bands).map(([band, passages]) => [band, passages.length]))]));
const metrics = { narrativeCounts, distinct, checkedLetters, choices: catalogue.counts };
await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
rows.push('', '## Narrative counts and measured variation', '',
  'Three roles, each with 20 family-safe and 20 adult-only passages: 120 distinct passages. Family prose is safe for unknown ages, infants and teenagers; adult prose starts at 18.',
  ...Object.entries(distinct).map(([age, result]) => `- Fixed ${age} choices: ${result.distinct} distinct complete outputs measured from ${result.sampled} deterministic independent variations. Finite-library variety is not guaranteed uniqueness.`));
await writeFile(`${output}/coverage.md`, `${rows.join('\n')}\n`);
const escape = text => String(text).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let geometry;
try {
  geometry = JSON.parse(await readFile('generated-artifacts/studio-editorial/geometry.json', 'utf8'));
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
<h2>Fuller composition and measured variety</h2><p>120 distinct narrative passages: 20 family-safe and 20 adult-tone alternatives in each of three roles.
Each letter interleaves three short scenes with the selected details; no text is removed or shrunk to fit.
Adult scenes begin at 18; family scenes are also safe for infants, teenagers and unknown ages.</p>
<p>${Object.entries(distinct).map(([age, result]) => `${result.distinct} distinct complete outputs measured from ${result.sampled} deterministic variations with fixed ${escape(age)} selections`).join('; ')}.
These are measured samples, not a promise of global uniqueness.</p>
<p>${geometry ? `${geometry.length} longest-combination browser measurements across seven age bands, desktop and 320-pixel phones, production and fallback fonts. The latest measured closing ends no lower than ${(Math.max(...geometry.map(row => row.end)) * 100).toFixed(1)}% of A4 height, before the artwork's 88% clearance boundary.` : 'The full browser geometry measurements have not yet been generated in this workspace.'}
The canonical body scale remains approximately 11.6 points; no artwork or popup redesign.</p>
<h2>Runtime boundaries</h2><p>No runtime AI calls, new dependencies, recording changes, new personal-data storage or fulfilment changes.
Destination writing travels only with authorised context; the full destination mapping remains server-side.</p>
<h2>Complete representative letters</h2>${examples.map(example => `<article>${example.split('\n\n').map((paragraph, index) =>
  index === 0 ? `<h2>${escape(paragraph.replace(/^## /, ''))}</h2>` : `<p>${escape(paragraph)}</p>`).join('')}</article>`).join('')}
<small>The private coverage matrix remains outside the public build. To repeat the audit, run node scripts/audit-studio-letter.mjs in the authorised workspace.</small></main></html>`;
await mkdir('generated-artifacts/studio-editorial', { recursive: true });
await writeFile('generated-artifacts/studio-editorial/editorial-samples.html', html);
console.log(JSON.stringify({ counts: catalogue.counts, checkedLetters, narrativeCounts, distinct,
  editorialGaps: gaps, privateOutput: output }, null, 2));
