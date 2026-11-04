import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { regionalEditorialContext, regionalEditorialInventory, regionalAliases } from '../server/studio-regional-stories.js';
import { workshopRegionalFolders, selectedWorkshopRegion } from '../src/lib/workshopDestinations.js';
import { parseWorkshopCatalogue, createWorkshopCatalogueHandler } from '../server/santa-workshop-catalogue.js';
import { studioEditorialContext } from '../server/studio-letter-editorial.js';
import { createStudioLetter, createStudioLetterVariation } from '../src/lib/santaStudioLetter.js';

const record = file => ({ file, bytes: 500, id: `c-${createHash('sha256').update(file).digest('hex')}` });
function fixture() {
  const categories = { age: [record('AGES/10-years-old.wav')], activity: [record('Trying Hard at/art.wav')],
    achievement: [record('Achievment/being-brave.wav')], treat: [record('treats/beautiful-note.wav')],
    place: Object.values(workshopRegionalFolders).map(record) };
  for (const [folder, entries] of Object.entries(regionalEditorialInventory)) {
    categories[folder] = Object.values(entries).map(entry => record(`${folder}/${entry.label}.wav`));
  }
  categories['usa-states'].push(record('usa-states/Unreviewed County.wav'));
  return parseWorkshopCatalogue({ version: 1, categories,
    excludedAudioCounts: Object.fromEntries(Object.keys(categories).map(key => [key, 0])) });
}
const base = { age: '10 years old', activity: 'Art', achievement: 'Being brave', treats: 'a beautiful note' };
test('every private canonical region has two distinct concise family-safe alternatives reachable with the existing slot', () => {
  const all = [];
  for (const [folder, entries] of Object.entries(regionalEditorialInventory)) {
    for (const entry of Object.values(entries)) {
      const context = regionalEditorialContext(folder, workshopRegionalFolders[folder], entry.label);
      assert.equal(context.needsReview, false);
      assert.equal(context.passages.length, 2);
      assert.equal(new Set(context.passages).size, 2);
      for (const [i, passage] of context.passages.entries()) {
        assert.ok(passage.split(/\s+/).length < 55, entry.label);
        assert.match(passage, /pretend rehearsal/);
        assert.doesNotMatch(passage, /\b(pub|alcohol|beer|wine|whisky|you live|you visited|your home)\b/i);
        const variation = createStudioLetterVariation(() => .42);
        variation.destination = (i + .1) / 2;
        const details = { ...base, destination: `${entry.label}, selected parent`, context: { destination: context } };
        const initial = createStudioLetter('Example', () => { throw Error('Must not reroll'); }, details, variation);
        const edited = createStudioLetter('Spelling Edit', () => 0, { ...details, age: '18 years old', activity: 'Reading' }, variation);
        assert.equal(initial.paragraphs[6], edited.paragraphs[6]);
        assert.ok(initial.paragraphs[6].startsWith(`My route: ${details.destination}.`));
        assert.ok(initial.paragraphs[6].endsWith(passage));
        assert.equal(initial.paragraphs.length, 12);
        assert.match(initial.paragraphs[10], /do you like jokes/);
        assert.ok(!initial.editorialReview.includes('destination'));
        all.push(passage);
      }
    }
  }
  assert.equal(all.length, 316);
  assert.equal(new Set(all).size, all.length);
});

test('aliases are explicitly parent-qualified, including hosted shortened labels, and all wrong parents fail neutral', () => {
  for (const [folder, aliases] of Object.entries(regionalAliases)) {
    for (const [alias, canonical] of Object.entries(aliases)) {
      assert.deepEqual(regionalEditorialContext(folder, workshopRegionalFolders[folder], ` ${alias.toUpperCase()} `),
        regionalEditorialContext(folder, workshopRegionalFolders[folder], canonical));
    }
  }
  for (const folder of Object.keys(workshopRegionalFolders)) {
    const own = Object.keys(regionalEditorialInventory[folder])[0];
    assert.deepEqual(regionalEditorialContext(folder, 'countries/ireland.wav', own), { group: 'neutral', needsReview: true });
    assert.deepEqual(regionalEditorialContext(folder, workshopRegionalFolders[folder], 'Unreviewed County'), { group: 'neutral', needsReview: true });
    assert.deepEqual(regionalEditorialContext(folder, workshopRegionalFolders[folder], 'constructor'), { group: 'neutral', needsReview: true });
  }
  assert.equal(regionalEditorialContext('usa-states', workshopRegionalFolders['usa-states'], 'Georgia').group, 'real');
  assert.deepEqual(studioEditorialContext('place', { label: 'Georgia' }), { group: 'neutral', needsReview: true });
  assert.deepEqual(regionalEditorialContext('countries', 'countries/georgia.wav', 'Georgia'), { group: 'neutral', needsReview: true });
  assert.notDeepEqual(studioEditorialContext('place', { label: 'Ireland' }), studioEditorialContext('place', { label: 'Northern Ireland' }));
});

test('parent-qualified selection preserves recording identities, unreviewed named fallback and country-only behaviour', () => {
  const catalogue = fixture();
  const us = catalogue.regionalGroups['usa-states'];
  const florida = us.records.find(r => r.label === 'Florida');
  assert.equal(selectedWorkshopRegion(catalogue, us.parentId, florida.id), florida);
  assert.equal(selectedWorkshopRegion(catalogue, catalogue.regionalGroups['england-counties'].parentId, florida.id), null);
  const unknown = us.records.find(r => r.label === 'Unreviewed County');
  const letter = createStudioLetter('Example', () => 0, { ...base, destination: `${unknown.label}, United States`,
    context: { destination: unknown.letterContext } });
  assert.match(letter.paragraphs[6], /Unreviewed County, United States/);
  assert.match(letter.paragraphs[6], /No guessing/);
  assert.ok(letter.editorialReview.includes('destination'));
  const country = catalogue.categories.place.find(r => r.label === 'United States');
  assert.deepEqual(country.letterContext, studioEditorialContext('place', { label: 'United States' }));
  assert.equal(country.letterContext.passages.length, 8);
  assert.equal(florida.id, record(florida.file).id);
});

async function request(handler, query = '', method = 'GET') {
  const response = { headers: {} };
  await handler({ method, url: `/${query}` }, {
    setHeader(key, value) { response.headers[key] = value; },
    writeHead(status) { response.status = status; },
    end(body) { response.data = JSON.parse(body); },
  });
  return response;
}
test('protected API never exports the regional library; only trusted selected parent/region returns passages', async () => {
  const catalogue = fixture(), handler = createWorkshopCatalogueHandler(async () => catalogue, () => true);
  const index = await request(handler);
  assert.equal(index.status, 200);
  for (const group of Object.values(index.data.regionalGroups)) {
    assert.ok(group.records.every(record => !record.letterContext.passages));
  }
  for (const group of Object.values(catalogue.regionalGroups)) {
    for (const record of group.records) {
      const query = `?parentId=${group.parentId}&regionId=${record.id}`;
      const response = await request(handler, query);
      assert.equal(response.status, 200);
      assert.deepEqual(response.data.letterContext, record.letterContext);
      assert.deepEqual(Object.keys(response.data).sort(), ['letterContext', 'parentId', 'regionId']);
      assert.equal(response.headers['Cache-Control'], 'no-store');
      assert.equal(response.headers['X-Robots-Tag'], 'noindex, nofollow');
    }
  }
  const us = catalogue.regionalGroups['usa-states'], uk = catalogue.regionalGroups['england-counties'];
  for (const query of ['?parentId=forged&regionId=forged', `?parentId=${uk.parentId}&regionId=${us.records[0].id}`,
    `?parentId=${us.parentId}`, '?regionId=__proto__', '?parentId=constructor&regionId=constructor']) {
    assert.equal((await request(handler, query)).status, 400);
  }
  let loads = 0;
  const locked = createWorkshopCatalogueHandler(async () => { loads++; return catalogue; }, () => false);
  assert.equal((await request(locked, `?parentId=${us.parentId}&regionId=${us.records[0].id}`)).status, 403);
  assert.equal(loads, 0);
});

test('regional library has no browser imports, recipient seeds, audio changes or public export', () => {
  for (const file of ['src/lib/santaStudioLetter.js', 'src/lib/studioLetterResponses.js', 'src/hooks/useStudioRegionalEditorial.js']) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /from ['"].*server|studio-regional-stories|(?:localStorage|sessionStorage)\s*\./);
  }
  assert.match(readFileSync('src/pages/SantaMessageWorkshop.jsx', 'utf8'), /useState\(createStudioLetterVariation\)/);
});
