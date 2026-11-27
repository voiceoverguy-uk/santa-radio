import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySongFields, songMessageAllowance, buildSongMessage, validateSongFields, submitSong } from '../src/lib/songSubmission.js';
const base = { ...emptySongFields, FIRSTNAME:'Test', LASTNAME:'Only', EMAIL:'test@example.com', criteriaMet:true, noAi:true, hostPermission:true,
  audioLink:'https://www.santaradio.co.uk/api/song-media?id=' + 'a'.repeat(32) + '.mp3',
  artworkLink:'https://www.santaradio.co.uk/api/song-media?id=' + 'b'.repeat(32) + '.png' };
test('visible message allowance matches validation and full payload boundary', async () => {
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async (_url,{body})=>{ requests++; assert.equal(body.get('SONG_REQUEST').length,500); return {ok:true,type:'cors',json:async()=>({success:true})}; };
  try {
    for (const instrumental of [false,true]) {
      const fields={...base,instrumental};
      const allowance=songMessageAllowance(fields);
      fields.SONG_REQUEST='x'.repeat(allowance);
      assert.deepEqual(validateSongFields(fields),{});
      assert.equal(buildSongMessage(fields).length,500);
      assert.doesNotMatch(buildSongMessage(fields),/Full lyrics:/);
      await submitSong(fields,new AbortController().signal);
      const tooLong={...fields,SONG_REQUEST:fields.SONG_REQUEST+'x'};
      assert.match(validateSongFields(tooLong).SONG_REQUEST,/remove 1 characters/);
      await assert.rejects(submitSong(tooLong,new AbortController().signal));
      assert.equal(songMessageAllowance({...fields,noAi:false,hostPermission:false}),allowance);
    }
    assert.equal(requests,2);
  } finally {globalThis.fetch=original;}
});
test('uploads reduce the displayed allowance without truncating the typed message',()=>{
  const fields={...base,SONG_REQUEST:'x'.repeat(421)};
  assert.ok(songMessageAllowance(fields)<421);
  assert.match(validateSongFields(fields).SONG_REQUEST,/Please remove/);
  assert.equal(fields.SONG_REQUEST.length,421);
  assert.ok(songMessageAllowance({...fields,audioLink:'',artworkLink:''})>songMessageAllowance(fields));
  assert.equal(validateSongFields({...fields,SONG_REQUEST:'x'.repeat(500)},'general').SONG_REQUEST,undefined);
});
