import test from 'node:test';
import assert from 'node:assert/strict';
import { workshopNamePreviewUrl } from '../src/lib/workshopNamePreview.js';

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
