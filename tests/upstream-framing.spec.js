import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { browserHeaders } from '../server/browser-security.js';

const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const deploymentHeaders = deployment.routes.find(route => route.src === '/(.*)' && route.headers).headers;

// Intercept both origins: exercise Chromium's real frame-ancestors enforcement
// without making requests to Upstream or needing access to its Studio account.
for (const [label, headers] of Object.entries({ server: browserHeaders, deployment: deploymentHeaders })) {
  for (const [parent, allowed] of [
    ['https://santa.example', true],
    ['https://studio.upstream.so', true],
    ['https://replit.com', true],
    ['https://preview.replit.com', true],
    ['https://preview.replit.dev', true],
    ['https://unrelated.example', false],
    ['https://other.upstream.so', false],
    ['https://studio.upstream.so.unrelated.example', false],
    ['http://studio.upstream.so', false],
  ]) {
    test(`${label}: ${parent} is ${allowed ? 'allowed' : 'blocked'}`, async ({ page }) => {
      const violations = [];
      page.on('console', message => {
        if (message.text().includes('frame-ancestors')) violations.push(message.text());
      });
      await page.route('**/*', route => {
        if (route.request().url() === `${parent}/parent`) {
          return route.fulfill({
            contentType: 'text/html',
            body: '<iframe src="https://santa.example/child"></iframe>',
          });
        }
        return route.fulfill({
          headers: { ...headers, 'Content-Type': 'text/html' },
          body: '<p>Santa frame loaded</p><script>window.santaFrameLoaded = true;</script>',
        });
      });
      await page.goto(`${parent}/parent`);
      if (allowed) {
        await expect(page.frameLocator('iframe').getByText('Santa frame loaded')).toBeVisible();
        expect(violations).toEqual([]);
      } else {
        await expect.poll(() => violations.length).toBeGreaterThan(0);
        expect(await page.frames()[1].evaluate(() => window.santaFrameLoaded).catch(() => false)).toBeFalsy();
      }
    });
  }
}
