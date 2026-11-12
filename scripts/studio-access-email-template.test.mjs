import test from 'node:test';
import assert from 'node:assert/strict';
import { studioAccessEmailHtml } from '../server/studio-access-email-template.js';
test('private access links remain direct fragments and markup is escaped', () => {
  const origin='https://www.santaradio.co.uk';
  const link=`${origin}/bespoke-personalised-message-from-santa#studio-return=fixture`;
  const html=studioAccessEmailHtml({origin,link});
  assert.ok(html.includes(`href="${link}"`));
  assert.doesNotMatch(html, /<script|<img|\?token=|£6\.50/i);
  assert.match(html, /two successful creations in total/);
  assert.match(html, /does not reset it/);
  const hostile=studioAccessEmailHtml({origin,link:'"><script>alert(1)</script>'});
  assert.doesNotMatch(hostile, /<script>/);
  assert.match(hostile, /&quot;&gt;&lt;script&gt;/);
});
