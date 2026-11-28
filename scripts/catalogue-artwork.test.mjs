import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { artworkTarget, mergeArtworkFeed, readArtworkOverrides } from '../server/catalogue-artwork-store.js';
import { createCatalogueArtwork } from '../server/catalogue-artwork.js';
import { artistArtworkCandidates, songArtworkCandidates } from '../src/data/songArtwork.js';
import * as mapping from '../src/data/artistArtwork.js';
import { buildArtworkFeed } from '../server/artwork-feed.js';
import songs from '../src/data/songs.json' with { type:'json' };

test('artist defaults and recording replacements preserve the other recordings and app feed contract', async () => {
  const song = songs.find(row => row.id === 288), other = songs.find(row => row.id === 559);
  const hash = 'a'.repeat(64), songHash = 'b'.repeat(64);
  const rows = [
    {scope:'artist',target_key:'robbie williams',hash},
    {scope:'song',target_key:'288',artist:song.artist,title:song.song,hash:songHash},
    {scope:'artist',target_key:'the beach boys',hash},
    {scope:'song',target_key:'559',artist:'Another artist',title:other.song,hash},
  ];
  const overrides = await readArtworkOverrides({query: async () => ({rows})});
  const base = await buildArtworkFeed(mapping);
  const feed = mergeArtworkFeed(base,overrides);
  const artist = '/artist-artwork/upload-' + hash + '.webp';
  const recording = '/artist-artwork/upload-' + songHash + '.webp';
  assert.equal(songArtworkCandidates(song,undefined,overrides)[0],recording);
  assert.equal(songArtworkCandidates(other,undefined,overrides)[0],base.recordings[559].image.path);
  assert.equal(songArtworkCandidates({artist:song.artist},undefined,overrides)[0],artist);
  assert.equal(artistArtworkCandidates('Beach Boys',overrides)[0],artist);
  assert.equal(artworkTarget(288,'song').key,'288');
  assert.equal(artworkTarget(288,'artist').key,'robbie williams');
  assert.equal(artworkTarget(288,'both'),null);
  assert.equal(artworkTarget(-1,'song'),null);
  assert.equal(feed.schemaVersion,base.schemaVersion);
  assert.equal(feed.refreshAfterSeconds,base.refreshAfterSeconds);
  assert.deepEqual(feed.fallback,base.fallback);
  assert.deepEqual(feed.recordings[559],base.recordings[559]);
  assert.equal(feed.recordings[288].image.url,recording+'?v='+songHash);
  assert.equal(feed.artists['robbie williams'].url,artist+'?v='+hash);
  assert.deepEqual(feed.artists['beach boys'],feed.artists['the beach boys']);
  const {version,...content} = feed;
  assert.equal(version,createHash('sha256').update(JSON.stringify(content)).digest('hex'));
  assert.equal(mergeArtworkFeed(base,{artists:{},recordings:{}}),base);
});

test('Beverley spelling correction preserves previously assigned recording artwork', async () => {
  const song = songs.find(row => row.id === 493);
  assert.equal(song.artist, 'Beverley Knight');
  const row = { scope: 'song', target_key: '493', artist: 'Beverly Knight', title: song.song, hash: 'c'.repeat(64) };
  const overrides = await readArtworkOverrides({ query: async () => ({ rows: [row] }) });
  assert.equal(overrides.recordings[493].artist, 'Beverley Knight');
  assert.equal(songArtworkCandidates(song, undefined, overrides)[0], '/artist-artwork/upload-' + row.hash + '.webp');
  const wrongTitle = await readArtworkOverrides({ query: async () => ({ rows: [{ ...row, title: 'Different song' }] }) });
  assert.equal(wrongTitle.recordings[493], undefined);
});

test('uploads require the dashboard owner, a matching origin and a real catalogue target', async t => {
  let writes = 0;
  const app = createCatalogueArtwork({owner:req=>req.headers.authorization==='Bearer test',encode:async()=>Buffer.from('test'),
    save:async()=>{ writes++; return '/artist-artwork/upload-example.webp'; }});
  const server = createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (headers, body) => fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const owner = {authorization:'Bearer test',origin:url};
  const body = {scope:'song',id:288,jpeg:'test'};
  assert.equal((await post({},body)).status,401);
  assert.equal((await post({...owner,origin:'https://example.org'},body)).status,403);
  assert.equal((await post(owner,{...body,id:0})).status,400);
  assert.equal(writes,0);
  assert.equal((await post(owner,body)).status,200);
  assert.equal(writes,1);
});

test('gallery-only saves require owner access and do not encode or replace artwork', async t => {
  const saved = [];
  const app = createCatalogueArtwork({ owner: req => req.headers.authorization === 'Bearer test',
    encode: async () => { throw Error('Must not encode for gallery-only save'); },
    saveGallery: async (target, enabled) => saved.push({target, enabled}) });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (body, authenticated = true) => fetch(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', origin: url, ...(authenticated ? {authorization: 'Bearer test'} : {})
  }, body: JSON.stringify(body) });
  assert.equal((await post({id:37, scope:'song', includeInGallery:true}, false)).status, 401);
  assert.equal((await post({id:37, scope:'song', includeInGallery:'true'})).status, 400);
  for (const enabled of [true, false]) {
    const response = await post({id:37, scope:'song', includeInGallery:enabled});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {gallery: {enabled, scope:'song'}});
  }
  assert.equal((await post({id:-1, scope:'song', includeInGallery:false})).status,200);
  assert.equal((await post({id:-999, scope:'song', includeInGallery:false})).status,400);
  assert.equal((await post({id:-1, scope:'artist', includeInGallery:false})).status,400);
  assert.equal((await post({id:-1, scope:'song', jpeg:'invalid'})).status,400);
  assert.deepEqual(saved.map(entry => [entry.target.songId, entry.enabled]), [[37,true],[37,false],[-1,false]]);
});

test('artwork replacement saves gallery selection atomically and reads it back', async () => {
  const {saveArtwork, saveGallerySelection} = await import('../server/catalogue-artwork-store.js');
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({sql,values}); return {rows: sql.includes('FROM santa_catalogue_gallery') ? [{song_id:37,enabled:false,scope:'song'}] : []}; } };
  const target = artworkTarget(37,'song');
  await saveArtwork(target,Buffer.from('image'),pool,true);
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/INSERT INTO santa_catalogue_gallery/);
  assert.equal(calls[0].values[6],true);
  assert.equal(calls[0].values[7],37);
  await saveGallerySelection(target,false,pool);
  assert.deepEqual(calls[1].values,[37,false,'song']);
  const data = await readArtworkOverrides(pool);
  assert.deepEqual(data.gallery[37],{enabled:false,scope:'song'});
});
