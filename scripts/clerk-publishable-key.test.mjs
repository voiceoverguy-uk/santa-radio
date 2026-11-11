import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishableKey, parsePublishableKey } from '@clerk/shared/keys';
import { clerkPublishableKey } from '../src/lib/clerkPublishableKey.js';

test('www website and API use the configured production Clerk domain', () => {
  const key = buildPublishableKey('clerk.santaradio.co.uk');
  for (const host of ['www.santaradio.co.uk', 'santaradio.co.uk', 'preview.vercel.app']) {
    assert.equal(clerkPublishableKey(host, key), key);
    assert.equal(parsePublishableKey(clerkPublishableKey(host, key)).frontendApi, 'clerk.santaradio.co.uk');
  }
});
test('development keys are preserved and legacy host inference remains available', () => {
  const key = buildPublishableKey('example.clerk.accounts.dev');
  assert.equal(clerkPublishableKey('localhost:5000', key), key);
  assert.equal(parsePublishableKey(clerkPublishableKey('legacy.example.com')).frontendApi, 'clerk.legacy.example.com');
});
