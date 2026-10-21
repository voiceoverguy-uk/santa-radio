import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render } from '../dist/server/entry-server.js';

// Run after npm run build. Rendering is read-only: no live form submissions.
for (const [path, song] of [
  ['/submit-a-song', false],
  ['/submit-a-song?mode=song', true],
  ['/submit-a-song?mode=invalid', false],
]) {
  test(`built contact SSR selects the mode and keeps canonical metadata: ${path}`, () => {
    const result = render(path);
    assert.equal(result.status, 200);
    assert.match(result.head, /Contact Santa Radio \| General Enquiries &amp; Song Submissions/);
    assert.match(result.head, /href="https:\/\/www.santaradio.co.uk\/submit-a-song"/);
    assert.match(result.head, /shared contact form/);
    assert.match(result.markup, /What are you contacting us about\?/);
    assert.match(result.markup, song ? /Submit song/ : /Send enquiry/);
    assert.equal(result.markup.includes('song-requirements-checklist'), song);
    for (const name of ['FIRSTNAME', 'LASTNAME', 'EMAIL', 'SONG_REQUEST']) {
      assert.match(result.markup, new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*required=""`));
    }
    assert.match(result.markup, /<textarea[^>]*name="SONG_REQUEST"[^>]*maxLength="500"/i);
    assert.match(result.markup, /id="song-message-count">0(?:<!-- -->)? \/ 500 characters/);
    assert.match(result.markup, /name="email_address_check"/);
    assert.match(result.markup, /name="locale" value="en"/);
    assert.doesNotMatch(result.markup, /name="(?:MESSAGE|COMPANY:name|SMS|SMS__COUNTRY_CODE)"/);
  });
}

test('pre-rendered contact page opens as a general enquiry', async () => {
  const html = await readFile('dist/submit-a-song/index.html', 'utf8');
  assert.match(html, /Send enquiry/);
  assert.doesNotMatch(html, /song-requirements-checklist/);
  assert.match(html, /Contact Santa Radio \| General Enquiries &amp; Song Submissions/);
  assert.match(html, /<textarea[^>]*name="SONG_REQUEST"[^>]*required=""[^>]*maxLength="500"/i);
  assert.doesNotMatch(html, /name="(?:MESSAGE|COMPANY:name|SMS|SMS__COUNTRY_CODE)"/);
});
