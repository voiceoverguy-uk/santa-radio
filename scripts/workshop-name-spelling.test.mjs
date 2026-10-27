import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWorkshopWrittenName, getWorkshopDownloadName, validateWorkshopSpelling } from '../src/lib/workshopNameSpelling.js';

test('written spelling is separate from recorded identity and follows the download convention', () => {
  assert.equal(getWorkshopWrittenName('Wendi', 'Wendy'), 'Wendy');
  assert.equal(getWorkshopDownloadName('Wendi', 'Wendy'), 'santa-message-for-Wendy.mp3');
  assert.equal(getWorkshopWrittenName('Wendi', ''), 'Wendi');
  assert.equal(getWorkshopDownloadName('Wendi', ''), 'santa-message-for-Wendi.mp3');
});

test('spelling supports accented names, apostrophes and hyphens, normalising whitespace', () => {
  for (const name of ['Élodie', 'Anne-Marie', 'O’Neil', "D'Arcy", '李明']) {
    assert.equal(validateWorkshopSpelling(name), '');
    assert.equal(getWorkshopWrittenName('Example', name), name);
  }
  assert.equal(getWorkshopWrittenName('Example', '  Anne   Marie '), 'Anne Marie');
  assert.equal(getWorkshopWrittenName('Example', 'E\u0301lodie'), 'Élodie');
});

test('invalid or excessive spellings cannot become filenames or output names', () => {
  for (const name of ['', '   ', '../Wendy', 'Wendy.mp3', 'Wendy\\file', 'Wendy\n/evil', '<script>', 'A'.repeat(81), '\u202eWendy']) {
    assert.notEqual(validateWorkshopSpelling(name), '');
    assert.equal(getWorkshopWrittenName('Wendi', name), 'Wendi');
    assert.equal(getWorkshopDownloadName('Wendi', name), 'santa-message-for-Wendi.mp3');
  }
});
