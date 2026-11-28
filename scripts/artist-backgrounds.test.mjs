import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createArtistBackgrounds, readBackgrounds, saveBackground } from '../server/artist-backgrounds.js';
import { backgroundArtists, artistBackgroundKey } from '../src/data/artist-backgrounds.js';
import songs from '../src/data/songs.json' with { type: 'json' };

test('artist list groups repeat recordings; Relient K has readable corrected text', () => {
  const john = backgroundArtists.find(a => a.key === 'john legend');
  assert.ok(john.songCount > 1);
  assert.equal(backgroundArtists.filter(a => a.key === john.key).length, 1);
  assert.equal(artistBackgroundKey('  JOHN   LEGEND '), john.key);
  const relient = songs.filter(s => s.artist === 'Relient K');
  assert.ok(relient.length);
  for (const song of relient) {
    assert.match(song.info, /Canton, Ohio, in 1998/);
    assert.doesNotMatch(song.info, /µ|Ë|É|Malone/);
  }
});

test('saving validates identity and length, uses parameters, and detects stale revisions', async () => {
  let calls = 0;
  const pool = { query: async (sql, values) => { calls++; assert.match(sql, /RETURNING revision/);
    assert.deepEqual(values, ['relient k', "An artist's background"]); return { rows: [{ revision: 1 }] }; } };
  assert.deepEqual(await saveBackground({ key: 'relient k', text: "  An artist's background  ", revision: 0 }, pool),
    { key: 'relient k', text: "An artist's background", revision: 1 });
  for (const body of [{ key: 'unknown', text: 'Text', revision: 0 }, { key: 'relient k', text: ' ', revision: 0 },
    { key: 'relient k', text: 'x'.repeat(8001), revision: 0 }, { key: 'relient k', text: 'Text', revision: -1 }]) {
    await assert.rejects(saveBackground(body, pool), { status: 400 });
  }
  assert.equal(calls, 1);
  await assert.rejects(saveBackground({ key: 'relient k', text: 'New', revision: 1 }, { query: async () => ({ rows: [] }) }), { status: 409 });
  const rows = await readBackgrounds({ query: async () => ({ rows: [
    { artist_key: 'john legend', background: 'Saved', revision: 2 },
    { artist_key: 'removed artist', background: 'Ignore', revision: 1 },
  ] }) });
  assert.deepEqual(rows, { 'john legend': { text: 'Saved', revision: 2 } });
});

test('public reads, owner save, origin protection, and persistence across all artist recordings', async t => {
  const state = {}; let writes = 0;
  const app = createArtistBackgrounds({ owner: req => req.headers.authorization === 'Bearer test', read: async () => state,
    save: async body => { writes++; state[body.key] = { text: body.text, revision: 1 }; return { ...body, revision: 1 }; } });
  const server = createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const body = { key: 'john legend', text: 'A new artist background.', revision: 0 };
  const post = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await post({})).status, 401);
  assert.equal((await fetch(url + '?edit=1')).status, 401);
  assert.equal((await post({ authorization: 'Bearer test', origin: 'https://wrong.test' })).status, 403);
  assert.equal(writes, 0);
  assert.equal((await post({ authorization: 'Bearer test', origin: url })).status, 200);
  const publicData = await (await fetch(url)).json();
  for (const song of songs.filter(s => s.artist === 'John Legend')) assert.equal(publicData.backgrounds[artistBackgroundKey(song.artist)], body.text);
  const editor = await (await fetch(url + '?edit=1', { headers: { authorization: 'Bearer test' } })).json();
  assert.equal(editor.artists.find(a => a.key === body.key).text, body.text);
  assert.equal(writes, 1);
});
