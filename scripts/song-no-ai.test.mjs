import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySongFields, validateSongFields, buildSongMessage, submitSong } from '../src/lib/songSubmission.js';
const fields = { ...emptySongFields, FIRSTNAME: 'Test', LASTNAME: 'Only', EMAIL: 'test@example.com', SONG_REQUEST: 'Test song', criteriaMet: true, instrumental: true, audioLink: 'https://example.com/song.mp3', artworkLink: 'https://example.com/art.png', hostPermission: true };

test('song submission requires explicit no-A.I. confirmation before contacting Brevo', async () => {
  let requests = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected request'); };
  try {
    for (const noAi of [undefined, false, 'true']) {
      await assert.rejects(submitSong({ ...fields, noAi }, new AbortController().signal), error => Boolean(error.fieldErrors?.noAi));
    }
    assert.equal(requests, 0);
    assert.deepEqual(validateSongFields({ ...fields, noAi: true }), {});
  } finally { globalThis.fetch = original; }
});

test('confirmation reaches the existing Brevo message field and counts toward its limit', async () => {
  const confirmed = { ...fields, noAi: true };
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => {
    assert.equal(body.get('SONG_REQUEST'), buildSongMessage(confirmed));
    assert.match(body.get('SONG_REQUEST'), /No A.I. used: confirmed/);
    assert.equal(body.has('noAi'), false);
    return { ok: true, type: 'cors', json: async () => ({ success: true }) };
  };
  try { await submitSong(confirmed, new AbortController().signal); }
  finally { globalThis.fetch = original; }
  const remaining = 500 - buildSongMessage({ ...confirmed, SONG_REQUEST: '' }).length;
  assert.equal(validateSongFields({ ...confirmed, SONG_REQUEST: 'x'.repeat(remaining) }).SONG_REQUEST, undefined);
  assert.ok(validateSongFields({ ...confirmed, SONG_REQUEST: 'x'.repeat(remaining + 1) }).SONG_REQUEST);
});

test('general enquiries do not require the song-only declaration', () => {
  assert.deepEqual(validateSongFields(fields, 'general'), {});
  assert.equal(emptySongFields.noAi, false);
});
