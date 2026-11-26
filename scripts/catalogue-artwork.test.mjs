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
