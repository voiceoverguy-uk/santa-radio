import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { render } from '../dist/server/entry-server.js';

test('built Node SSR exposes the query-selected song contract and shared canonical metadata', () => {
  const page = render('/submit-a-song?mode=song');
  assert.equal(page.status, 200);
  for (const field of ['FIRSTNAME', 'LASTNAME', 'EMAIL', 'COMPANY:name', 'criteriaMet', 'email_address_check']) {
    assert.ok(page.markup.includes(`name="${field}"`), field);
  }
  assert.ok(page.markup.includes('name="locale" value="en"'));
  assert.match(page.markup, /maxlength="500"/i);
  assert.ok(!page.markup.includes('name="SMS"'));
  assert.ok(!page.markup.includes('name="SMS__COUNTRY_CODE"'));
  assert.ok(page.markup.includes('Have you met the criteria?'));
  assert.ok(page.markup.includes('Submit song'));
  assert.ok(page.markup.includes('A link to any promotion of Santa Radio'));
  assert.ok(page.head.includes('https://www.santaradio.co.uk/submit-a-song'));
  assert.ok(!page.markup.includes('songs@santaradio.co.uk'));
});

test('production pre-rendered shared page defaults to general enquiry with accurate privacy disclosure', async () => {
  const html = await readFile('dist/submit-a-song/index.html', 'utf8');
  assert.ok(html.includes('name="COMPANY:name"'));
  assert.ok(html.includes('Your name, email and message are sent to Brevo'));
  assert.ok(html.includes('General enquiry'));
  assert.ok(html.includes('Send enquiry'));
  assert.ok(!html.includes('name="criteriaMet"'));
  assert.ok(!html.includes('Have you met the criteria?'));
  assert.ok(!html.includes('songs@santaradio.co.uk'));
  const privacy = render('/privacy-policy');
  assert.ok(privacy.markup.includes('Song submissions'));
  assert.ok(privacy.markup.includes('do not open the message maker or give consent for marketing'));
  assert.ok(privacy.markup.includes('same dedicated Brevo form'));
  assert.ok(privacy.markup.includes('not verified delivery to our inbox'));
});
