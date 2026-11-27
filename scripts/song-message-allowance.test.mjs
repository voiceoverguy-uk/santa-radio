import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySongFields, buildSongDetails, validateSongFields, submitSong } from '../src/lib/songSubmission.js';
import {songMediaSlug,songMediaLink,songDownloadFilename} from '../src/lib/songMediaName.js';
const base={...emptySongFields,FIRSTNAME:'Test',LASTNAME:'Only',EMAIL:'test@example.com',SONG_ARTIST:'Bob Davies',SONG_TITLE:'I Love Christmas',criteriaMet:true,noAi:true,hostPermission:true,
 audioLink:'https://www.santaradio.co.uk/api/song-media?file='+'a'.repeat(32)+'.mp3',artworkLink:'https://www.santaradio.co.uk/api/song-media?file='+'b'.repeat(32)+'.png'};
test('500 message characters accepted independently of artist, title, uploads and confirmations',async()=>{
 const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async(_url,{body})=>{requests++;assert.equal(body.get('SONG_REQUEST'),'x'.repeat(500));assert.equal(body.get('SONG_ARTIST'),base.SONG_ARTIST);assert.equal(body.get('SONG_TITLE'),base.SONG_TITLE);assert.equal(body.get('SONG_DETAILS'),buildSongDetails(base));assert.ok(body.get('SONG_DETAILS').length<=500);return {ok:true,type:'cors',json:async()=>({success:true})};};
 try {
  await submitSong({...base,SONG_REQUEST:'x'.repeat(500)},new AbortController().signal);
  await assert.rejects(submitSong({...base,SONG_REQUEST:'x'.repeat(501)},new AbortController().signal),e=>Boolean(e.fieldErrors.SONG_REQUEST));
  assert.equal(requests,1);
 }finally{globalThis.fetch=original;}
});
test('artist and title are required only for songs; maximum labels and download names fit provider fields',()=>{
 const f={...base,SONG_REQUEST:'Hi'};
 assert.ok(validateSongFields({...f,SONG_ARTIST:''}).SONG_ARTIST);
 assert.ok(validateSongFields({...f,SONG_TITLE:''}).SONG_TITLE);
 assert.deepEqual(validateSongFields({...f,SONG_ARTIST:'',SONG_TITLE:''},'general'),{});
 const maximum={...f,SONG_ARTIST:'a'.repeat(200),SONG_TITLE:'b'.repeat(200),SONG_REQUEST:'x'.repeat(500)};
 assert.deepEqual(validateSongFields(maximum),{});
 assert.ok(buildSongDetails(maximum).length<=500);
});
test('readable filenames use the latest artist and title and reject header injection',()=>{
 const slug=songMediaSlug(base.SONG_ARTIST,base.SONG_TITLE);
 assert.equal(slug,'bob-davies-i-love-christmas');
 const url=new URL(songMediaLink(base.audioLink,base.SONG_ARTIST,base.SONG_TITLE));
 assert.equal(songDownloadFilename(url.searchParams.get('file'),url.searchParams.get('name')),slug+'.mp3');
 assert.equal(songDownloadFilename('b'.repeat(32)+'.png',slug),slug+'.png');
 assert.equal(songMediaSlug('Bób / Davies','I ♥ Christmas'),'bob-davies-i-christmas');
 assert.equal(songDownloadFilename('a'.repeat(32)+'.mp3','bad\r\nheader'),'Santa-Radio-'+'a'.repeat(32)+'.mp3');
 assert.equal(songDownloadFilename('a'.repeat(32)+'.mp3',undefined),'Santa-Radio-'+'a'.repeat(32)+'.mp3');
});
