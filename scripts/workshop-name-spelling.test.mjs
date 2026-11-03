import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWorkshopWrittenName, getWorkshopDownloadName, validateWorkshopSpelling } from '../src/lib/workshopNameSpelling.js';
import { containsWorkshopProfanity, WORKSHOP_LANGUAGE_ERROR } from '../src/lib/workshopSpellingLanguage.js';

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

test('ampersands are allowed in written names without changing recorded identity or weakening validation', () => {
  for (const name of ['Arabella & Doggy', 'Anne-Marie & Élodie', 'Arabella&丫丫']) {
    assert.equal(validateWorkshopSpelling(name), '');
    assert.equal(getWorkshopWrittenName('Arabella', name), name);
    assert.equal(getWorkshopDownloadName('Arabella', name), `santa-message-for-${name}.mp3`);
  }
  assert.equal(getWorkshopWrittenName('Arabella', '  Arabella   &   Doggy '), 'Arabella & Doggy');
  for (const name of ['&', 'Arabella & ../Doggy', 'Arabella & <script>', 'Arabella & Doggy.mp3', 'Arabella & Fuck']) {
    assert.notEqual(validateWorkshopSpelling(name), '');
    assert.equal(getWorkshopWrittenName('Arabella', name), 'Arabella');
  }
});

test('bad language, included words and disguised spellings never become output names', () => {
  for (const name of [
    'Fuck You', 'Anne FUCK Smith', 'motherfucker', 'Shithead', 'Bitch', 'Bastard',
    'Twat', 'Wanker', 'Bollocks', 'Arsehole', 'Asshole', 'Prick', 'Piss off',
    'F-u-c-k You', 'f u c k', 'Fúck', 'Ｆｕｃｋ', 'fuuuck', 'f\u200buck', 'f4ck', 'sh1t',
  ]) {
    // f4ck is invalid name syntax, even though the substitution is not a match.
    assert.notEqual(validateWorkshopSpelling(name), '', name);
    if (name !== 'f4ck') {
      assert.equal(containsWorkshopProfanity(name), true, name);
      assert.equal(validateWorkshopSpelling(name), WORKSHOP_LANGUAGE_ERROR, name);
    }
    assert.equal(getWorkshopWrittenName('Wendi', name), 'Wendi', name);
    assert.equal(getWorkshopDownloadName('Wendi', name), 'santa-message-for-Wendi.mp3', name);
  }
});

test('legitimate names do not fail on partial word matches', () => {
  for (const name of ['Ishita', 'Scunthorpe', 'Hancock', 'Cockburn', 'Dick', 'Fanny', 'Cassie', 'Priscilla', 'Élodie O’Neill', 'Anne-Marie', '李明']) {
    assert.equal(containsWorkshopProfanity(name), false, name);
    assert.equal(validateWorkshopSpelling(name), '', name);
  }
});
