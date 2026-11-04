import test from 'node:test';
import assert from 'node:assert/strict';
import { workshopNamePreviewUrl, refreshWorkshopNamePreview } from '../src/lib/workshopNamePreview.js';

const root = 'https://stagcommunications.com/santaradio/names/';
test('previews use only same-origin server capabilities, never origin filenames or written spellings', () => {
  for (const token of ['payload.signature', 'other_scoped-token.signature']) {
    const previewUrl = `/api/santa-name-preview?token=${token}`;
    assert.equal(workshopNamePreviewUrl({ id: 'irrelevant-id', name: 'Different written spelling', previewUrl }), previewUrl);
  }
});
test('missing or unsafe preview locations cannot start playback', () => {
  for (const previewUrl of [undefined, '', 'javascript:alert(1)', 'http://stagcommunications.com/santaradio/names/name.wav',
    root + '../private.wav', root + 'folder/name.wav', root + '%2Fname.wav', root + 'name.wav?q=child',
    root + 'name.wav#fragment', root + 'name.wav%0A', root + 'name.php', root + '.hidden.wav',
    'https://stagcommunications.com.evil.test/santaradio/names/name.wav', root + '%ZZ.wav',
    root + 'valid.wav', '/api/santa-name-preview?token=x&file=private.wav',
    '//evil.test/api/santa-name-preview?token=x', '/api/santa-name-preview?token=x#fragment']) {
    assert.equal(workshopNamePreviewUrl({ previewUrl }), null, String(previewUrl));
  }
  assert.equal(workshopNamePreviewUrl(null), null);
});

test('refresh uses private search and preserves the exact recording among same-name variants', async () => {
  const record = { id: 'danny-2', name: 'Danny', previewUrl: '/api/santa-name-preview?token=expired' };
  const controller = new AbortController();
  const url = await refreshWorkshopNamePreview(record, {
    signal: controller.signal,
    request: async (url, options) => {
      assert.equal(url, '/api/santa-names');
      assert.equal(options.method, 'POST');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.signal, controller.signal);
      assert.deepEqual(JSON.parse(options.body), { query: 'Danny', exact: true });
      return Response.json({ records: [
        { id: 'danny-1', name: 'Danny', previewUrl: '/api/santa-name-preview?token=wrong-recording' },
        { id: 'danny-2', name: 'Danny', previewUrl: '/api/santa-name-preview?token=fresh' },
      ] });
    },
  });
  assert.equal(url, '/api/santa-name-preview?token=fresh');
  assert.equal(record.previewUrl, '/api/santa-name-preview?token=expired');
});

test('refresh fails explicitly for missing recordings, unsafe URLs and rate limits', async () => {
  const record = { id: 'danny', name: 'Danny' };
  for (const records of [
    [],
    [{ id: 'other', name: 'Danny', previewUrl: '/api/santa-name-preview?token=other' }],
    [{ id: 'danny', name: 'Different', previewUrl: '/api/santa-name-preview?token=wrong' }],
    [{ id: 'danny', name: 'Danny', previewUrl: 'https://origin.invalid/private.mp3' }],
  ]) {
    await assert.rejects(refreshWorkshopNamePreview(record, {
      request: async () => Response.json({ records }),
    }), /choose the recorded name again/i);
  }
  await assert.rejects(refreshWorkshopNamePreview(record, {
    request: async () => Response.json({ error: 'Limited' }, { status: 429 }),
  }), /wait a minute/i);
});
