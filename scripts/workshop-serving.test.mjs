import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import publicPage from '../api/public-page.js';
import vercelAccess from '../api/santa-workshop-access.js';
import sharedAccess from '../server/santa-workshop-access.js';

test('Vercel access entry exports the exact shared server handler', () => {
  assert.equal(vercelAccess, sharedAccess);
});

test('Vercel workshop document is locked, noindex and never public cached', async () => {
  const headers = {};
  let status, body;
  const res = {
    setHeader(key, value) { headers[key.toLowerCase()] = value; },
    status(value) { status = value; return this; },
    end(value) { body = value; },
  };
  await publicPage({ method: 'GET', url: '/api/public-page?__sr_route=/santa-message-workshop' }, res);
  assert.equal(status, 200);
  assert.match(headers['cache-control'], /private, no-store/);
  assert.equal(headers['vercel-cdn-cache-control'], 'no-store');
  assert.match(headers['x-robots-tag'], /noindex/);
  assert.match(body, /workshop-gate/);
  assert.match(body, /noindex/);
  assert.doesNotMatch(body, /smw-builder|What name should Santa say/);
  assert.doesNotMatch(await readFile('dist/sitemap.xml', 'utf8'), /santa-message-workshop/);
});
