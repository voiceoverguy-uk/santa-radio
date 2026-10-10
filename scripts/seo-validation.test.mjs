import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'vite';
import { songs, mugs, songMetadata, mugMetadata, identity, performers, performanceKind, songPath, mugPath, ORIGIN } from '../src/seo/catalogue.js';
import { canonicalPaths, aliases, legacyMatches, resolvePublicRequest } from '../src/seo/routes.js';
import { sitemap, robots } from '../server/public-html.js';

test('full retained inventories have unique, concise metadata and real image files', async () => {
  assert.equal(songs.length, 450); assert.equal(mugs.length, 649);
  for (const [rows, metadata] of [[songs, songMetadata], [mugs, mugMetadata]]) {
    const titles = new Set(), descriptions = new Set(), urls = new Set();
    for (const row of rows) {
      const m = metadata(row);
      assert.ok(m.description.length <= 180, `${m.url}: description too long`);
      assert.ok(!titles.has(m.title), m.title); titles.add(m.title);
      assert.ok(!descriptions.has(m.description), m.description); descriptions.add(m.description);
      assert.ok(!urls.has(m.url)); urls.add(m.url);
      assert.equal(new URL(m.url).origin, ORIGIN);
      await stat(`public${new URL(m.image).pathname}`);
      assert.ok(!JSON.stringify(m.graph).includes('sameAs'));
      assert.ok(!JSON.stringify(m.graph).match(/ProfilePage|aggregateRating|datePublished|uploadDate/));
      const ids = new Set(m.graph.map(node => node['@id']).filter(Boolean));
      const page = m.graph.find(node => node['@type'] === 'WebPage');
      assert.ok(ids.has(page.isPartOf['@id']));
      assert.ok(ids.has(page.primaryImageOfPage['@id']));
      assert.ok(ids.has(page.mainEntity['@id']));
    }
  }
});
test('all canonical build pages contain initial content, metadata and valid JSON-LD', async () => {
  for (const path of canonicalPaths) {
    const html = await readFile(`dist${path === '/' ? '' : path}/index.html`, 'utf8');
    assert.ok(html.match(/<h1\b/), `${path}: heading`);
    assert.ok(html.includes(`<link data-rh="true" rel="canonical" href="${ORIGIN}${path}"`), `${path}: canonical`);
    assert.equal((html.match(/<title\b/g) || []).length, 1, `${path}: duplicate title`);
    assert.ok(html.includes('property="og:image"'), `${path}: sharing image`);
    const graphs = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(graphs.length, `${path}: structured data`);
    for (const [, json] of graphs) JSON.parse(json);
    const row = songs.find(song => songPath(song) === path) || mugs.find(mug => mugPath(mug) === path);
    const escaped = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[char]));
    if (row?.info) assert.ok(html.includes(escaped(row.info)), `${path}: initial biography missing/changed`);
    if (row?.lyrics) assert.ok(html.includes(escaped(row.lyrics)), `${path}: initial lyrics missing/changed`);
  }
  const music = await readFile('dist/christmas-music/index.html', 'utf8');
  for (const song of songs) assert.ok(music.includes(`href="${songPath(song)}"`));
  const gallery = await readFile('dist/mugshots/all/index.html', 'utf8');
  for (const mug of mugs) assert.ok(gallery.includes(`href="${mugPath(mug)}"`), mug.artist);
});
test('sitemap, aliases, variants, legacy identity mappings and error routes', () => {
  assert.equal(new Set(canonicalPaths).size, canonicalPaths.length);
  const xml = sitemap(); assert.equal((xml.match(/<loc>/g) || []).length, canonicalPaths.length);
  assert.ok(!xml.includes('/preview')); assert.ok(!xml.includes('/artist?'));
  assert.ok(robots().includes(`${ORIGIN}/sitemap.xml`));
  for (const path of canonicalPaths) {
    assert.equal(resolvePublicRequest(path).status, 200);
    assert.ok(!aliases.has(path), `${path} unexpectedly redirects`);
    if (path !== '/') assert.deepEqual(resolvePublicRequest(`${path}/?utm=test`), { status: 308, location: `${path}?utm=test` });
  }
  for (const [old, target] of aliases) {
    assert.equal(resolvePublicRequest(old).location, target);
    assert.equal(resolvePublicRequest(target).status, 200, `${old}: redirect chain/loop`);
  }
  assert.ok(resolvePublicRequest('/artist?s=3').location.includes('pat-benatar'));
  assert.equal(legacyMatches.filter(row => !row.target).length, 0);
  const gladysPath = songPath(songs.find(song => song.artist === 'Gladys Knight & The Pips'));
  assert.deepEqual(resolvePublicRequest('/artist?s=14'), { status: 308, location: gladysPath });
  assert.deepEqual(resolvePublicRequest('/artist?s=14&utm_source=archive'), { status: 308, location: `${gladysPath}?utm_source=archive` });
  assert.equal(resolvePublicRequest('/artist?s=212').status, 404, 'catalogue IDs must not be treated as legacy IDs');
  for (const path of ['/unknown', '/mugshots/unknown', '/christmas-artist/unknown', '/christmas-karaoke-lyrics/unknown', '/artist?s=999']) assert.equal(resolvePublicRequest(path).status, 404);
  assert.equal(resolvePublicRequest('/santa-tracker/preview').noindex, true);
});
test('performers, groups, collaborations, characters and photo credits stay truthful', () => {
  assert.equal(performers(songs.find(s => s.artist === 'Scouting For Girls'))[0]['@type'], 'MusicGroup');
  assert.equal(performers(songs.find(s => s.artist === 'Bing Crosby'))[0]['@type'], 'Person');
  assert.equal(performers(songs.find(s => s.artist === 'Ed Sheeran & Elton John')).length, 2);
  assert.equal(performers(songs.find(s => s.artist === 'Miss Piggy')).length, 0);
  assert.equal(identity('Laurel and Hardy')['@type'], 'PerformingGroup');
  assert.equal(identity('Father Christmas'), null);
  for (const mug of mugs) {
    const photo = mugMetadata(mug).graph.find(n => n['@id'].endsWith('#photograph'));
    assert.equal(photo.contentUrl, `${ORIGIN}${mug.image}`);
    if (mug.credit) assert.equal(photo.creditText, `Photo credit: ${mug.credit}`);
  }
});
test('researched music credits preserve source records and do not reclassify uncertain performers', async () => {
  const rawSongs = JSON.parse(await readFile('src/data/songs.json', 'utf8'));
  const expected = new Map([
    [5, [['Person', 'Tom Jones'], ['Person', 'Cerys Matthews']]],
    [435, [['MusicGroup', 'Madison Fayre']]],
    [439, [['Person', 'Paul Burling'], ['Person', 'Joseph Bell']]],
    [463, [['Person', 'Peter Lemongello']]],
    [464, [['Person', 'Kate Grom']]],
    [466, [['Person', 'Nicholas Wells']]],
    [467, [['Person', 'Kate Neve']]],
    [507, [['Person', 'Trent Cokley']]],
    ...[153, 470, 505].map(id => [id, [['MusicGroup', 'X-mas Donkey & The Glittering Balls']]]),
  ]);
  for (const [id, credits] of expected) {
    const song = songs.find(s => s.id === id);
    assert.deepEqual(song, rawSongs.find(s => s.id === id), 'no source copy changes');
    assert.deepEqual(performers(song).map(entity => [entity['@type'], entity.name]), credits);
    assert.equal(performanceKind(song), credits.length > 1 ? 'Collaboration' : credits[0][0] === 'MusicGroup' ? 'Music group' : 'Individual performer');
    const recording = songMetadata(song).graph.find(entity => entity['@type'] === 'MusicRecording');
    assert.equal(recording.creditText, `Catalogue performer credit: ${song.artist}`);
    assert.deepEqual(recording.byArtist, performers(song));
  }
  for (const id of [459, 462, 522]) {
    const song = songs.find(s => s.id === id);
    assert.deepEqual(performers(song), []);
    assert.equal(performanceKind(song), 'Catalogue performer credit');
    assert.ok(!('byArtist' in songMetadata(song).graph.find(n => n['@type'] === 'MusicRecording')));
  }
  for (const id of [48, 52, 66, 113, 216, 259, 540]) {
    const song = songs.find(s => s.id === id);
    assert.deepEqual(performers(song), []);
    assert.equal(performanceKind(song), 'Character performance');
  }
  // Music research does not classify a shared-name Mugshot with no subject evidence.
  assert.equal(identity('Madison Fayre'), null);
  assert.equal(identity('Trent Cokley'), null);
});
test('Tracker seasons, precise fractional offsets, regional clocks and UK consistency', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const m = await server.ssrLoadModule('/src/tracker/lib/santaRoute.ts');
    const d = await server.ssrLoadModule('/src/tracker/data/santaRouteStops.ts');
    const at = date => new Date(`2026-${date}Z`);
    assert.equal(m.isHolidaySeason(at('11-30T23:59:59')), true);
    assert.equal(m.isHolidaySeason(at('12-01T00:00:00')), false);
    assert.equal(m.isDecemberPrep(at('12-01T00:00:00')), true);
    assert.equal(m.getDashboardData(at('12-24T09:59:59')).mode, 'PREPARING');
    assert.equal(m.getDashboardData(at('12-24T10:00:00')).mode, 'LIVE');
    assert.equal(m.getDashboardData(at('12-25T10:00:00')).mode, 'LIVE');
    assert.equal(m.getDashboardData(at('12-25T10:00:00.001')).mode, 'COMPLETE');
    assert.equal(m.getDashboardData(at('12-26T00:00:00')).mode, 'OFF_SEASON');
    assert.equal(d.santaStops.length, 44);
    const india = d.santaStops.find(s => s.id === 'india');
    assert.equal(d.getStopArrivalDate(india, 2026).toISOString(), '2026-12-24T18:30:00.000Z');
    assert.equal(d.getStopArrivalDate({ ...india, id: 'test-nepal', timeZone: undefined, utcOffset: 5.75 }, 2026).toISOString(), '2026-12-24T18:15:00.000Z');
    for (const [id, offset] of [['new-zealand', 13], ['fiji', 12], ['eastern-europe', 1], ['west-africa', 1], ['caribbean', -5]])
      assert.equal(d.getStopUtcOffset(d.santaStops.find(s => s.id === id), 2026), offset);
    const before = m.getDashboardData(at('12-24T23:59:59'));
    assert.ok(before.statusHeadline.includes('Approaching')); assert.notEqual(before.currentStopName, 'United Kingdom');
    for (const time of ['12-25T00:00:00', '12-25T00:25:00', '12-25T00:49:59']) {
      const now = at(time), data = m.getDashboardData(now);
      assert.equal(data.currentStopName, 'United Kingdom');
      assert.ok(data.statusHeadline.includes('Delivering in the UK'));
      assert.equal(data.mapPosition.lat, 51.5); assert.equal(data.mapPosition.lng, -0.1);
      assert.equal(data.countdownToUK.totalMs, 0);
    }
    assert.notEqual(m.getDashboardData(at('12-25T00:50:00')).state, 'UK_SPECIAL_WINDOW');
    const remaining = m.getCountdownToStart(at('12-24T09:00:00'));
    assert.equal(remaining.totalMs, 3600000);
  } finally { await server.close(); }
});
