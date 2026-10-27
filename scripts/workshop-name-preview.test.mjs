import test from 'node:test';
import assert from 'node:assert/strict';
import { workshopNamePreviewUrl } from '../src/lib/workshopNamePreview.js';

const root = 'https://stagcommunications.com/santaradio/names/';
test('previews use the exact supplied recording, never the displayed or written spelling', () => {
  for (const file of ['dixie3.wav', 'Fabian.mp3', 'Gary John.wav', "O’Neil.wav"]) {
    const previewUrl = root + encodeURIComponent(file);
    assert.equal(workshopNamePreviewUrl({ id: 'irrelevant-id', name: 'Different written spelling', previewUrl }), previewUrl);
  }
});
test('missing or unsafe preview locations cannot start playback', () => {
  for (const previewUrl of [undefined, '', 'javascript:alert(1)', 'http://stagcommunications.com/santaradio/names/name.wav',
    root + '../private.wav', root + 'folder/name.wav', root + '%2Fname.wav', root + 'name.wav?q=child',
    root + 'name.wav#fragment', root + 'name.wav%0A', root + 'name.php', root + '.hidden.wav',
    'https://stagcommunications.com.evil.test/santaradio/names/name.wav', root + '%ZZ.wav']) {
    assert.equal(workshopNamePreviewUrl({ previewUrl }), null, String(previewUrl));
  }
  assert.equal(workshopNamePreviewUrl(null), null);
});
