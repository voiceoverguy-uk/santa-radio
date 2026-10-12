import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicRequest, canonicalPaths } from '../src/seo/routes.js';
import { santaMessageRequestedName } from '../src/seo/santaMessageLinks.js';

test('legacy catalogue links permanently redirect in one hop on the current host', () => {
  for (const path of ['/personalised-santa-message', '/personalised-santa-message/', '/personalised-santa-message/all', '/personalised-santa-message/ALL/']) {
    assert.deepEqual(resolvePublicRequest(path), { status: 308, location: '/free-santa-message' });
  }
  assert.deepEqual(resolvePublicRequest('/personalised-santa-message/all?name=Skyla&utm_source=google'), {
    status: 308, location: '/free-santa-message?utm_source=google',
  });
});

test('old name links carry their names safely, preserve tracking and resolve to the canonical maker', () => {
  for (const name of ['Cooper', 'Skyla', 'Robert', 'Isla', 'Jack', 'Dixie3', "O'Brien", 'Mary-Anne', 'Élodie']) {
    const result = resolvePublicRequest(`/personalised-santa-message/${encodeURIComponent(name)}/?utm_source=google&name=wrong`);
    assert.equal(result.status, 308);
    assert.ok(result.location.startsWith('/free-santa-message?'));
    const target = new URL(result.location, 'https://preview.example');
    assert.equal(target.origin, 'https://preview.example');
    assert.equal(target.searchParams.get('name'), name);
    assert.equal(target.searchParams.getAll('name').length, 1);
    assert.equal(target.searchParams.get('utm_source'), 'google');
    assert.equal(resolvePublicRequest(result.location).status, 200);
  }
  assert.ok(!canonicalPaths.some(path => path.includes('personalised-santa-message')));
});

test('untrusted names cannot add routes, HTML, control characters or open redirects', () => {
  for (const name of ['<script>', 'https://evil.example', 'Cooper/extra', 'Alice\r\nLocation: https://evil.example', '\0', 'A'.repeat(81)]) {
    assert.equal(santaMessageRequestedName(name), '');
    assert.equal(resolvePublicRequest('/personalised-santa-message/' + encodeURIComponent(name)).status, 404);
  }
  assert.equal(resolvePublicRequest('/personalised-santa-message/%ZZ').status, 400);
  assert.equal(santaMessageRequestedName(null), '');
  assert.equal(santaMessageRequestedName('  Ｏｌｉｖｉａ  '), 'Olivia');
});
