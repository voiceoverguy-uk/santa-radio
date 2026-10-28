import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTrackerPath, isTrackingRequest } from '../src/privacy/trackerPrivacy.js';

test('tracker policy includes every subroute, encoded paths and case variants, not other public pages', () => {
  for (const path of ['/santa-tracker', '/santa-tracker/', '/santa-tracker/preview', '/santa-tracker/a/b', '/SANTA-TRACKER', '/%73anta-tracker']) {
    assert.equal(isTrackerPath(path), true, path);
  }
  for (const path of ['/', '/apps', '/privacy-policy', '/santa-tracker-news']) assert.equal(isTrackerPath(path), false, path);
});

test('network policy covers tracking transports but not radio, fonts or site resources', () => {
  for (const url of [
    'https://www.googletagmanager.com/gtag/js', 'https://region1.google-analytics.com/g/collect',
    'https://connect.facebook.net/en_US/fbevents.js', 'https://www.facebook.com/tr/?ev=PageView',
    'https://www.googleadservices.com/pagead/conversion/test', 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/test',
    'https://www.hotjar.com/api/event', 'https://www.santaradio.co.uk/_vercel/insights/event',
  ]) assert.equal(isTrackingRequest(url), true, url);
  for (const url of [
    'https://fonts.googleapis.com/css2', 'https://fonts.gstatic.com/font.woff2',
    'https://global.citrus3.com:8164/', 'https://www.santaradio.co.uk/api/radio-metadata',
    'https://www.facebook.com/santaradio', 'https://www.santaradio.co.uk/santa-tracker',
  ]) assert.equal(isTrackingRequest(url), false, url);
});
