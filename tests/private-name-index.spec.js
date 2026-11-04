import { test, expect } from '@playwright/test';
import { withNameDatabase } from '../scripts/helpers/private-name-fixture.mjs';
import { createNameSnapshotStore } from '../server/santa-name-snapshot.js';
import { createNameLibrary, parseNameIndex } from '../server/santa-name-library.js';
import { createSantaNamesHandler } from '../server/santa-names.js';
import { consumeNameAccess, issueNameToken } from '../server/santa-name-security.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

for (const snapshotSchema of [true, false]) {
test(`homepage and Studio use real private search on desktop/mobile with ${snapshotSchema ? 'indexed' : 'pre-index'} database`, async ({ page }) => {
  test.setTimeout(120000);
  await withNameDatabase(async pool => {
    let originCalls = 0;
    const key = 'isolated-browser-test-key-not-production';
    const fetchIndex = async () => {
        originCalls++;
        return Buffer.from(JSON.stringify({ version: 1, names: [
          { id: 'anna', name: 'Anna', file: 'anna.mp3' },
          { id: 'annabel', name: 'Annabel', file: 'annabel.mp3' },
        ] }));
      };
    const store = createNameSnapshotStore({ pool: () => pool, parse: parseNameIndex, fetchIndex });
    if (snapshotSchema) await store.refresh({ force: true });
    const handler = createSantaNamesHandler(createNameLibrary({ snapshotStore: store,
      legacySchemaFallback: true, fetcher: async () => new Response(await fetchIndex()) }), {
      limit: (req, scope) => consumeNameAccess(req, scope, { pool, key }),
      token: (id, scope) => issueNameToken(id, scope, Date.now(), key),
    });
    const requests = [];
    await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 2 } }));
    await page.route('**/api/santa-names', async route => {
      const incoming = route.request();
      requests.push({ url: incoming.url(), method: incoming.method(), body: incoming.postDataJSON() });
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, writeHead(code) { this.status = code; },
        end(body) { this.body = body; } };
      await handler({ method: incoming.method(), headers: await incoming.allHeaders(), url: '/api/santa-names',
        body: incoming.postDataJSON(), socket: { remoteAddress: 'browser-fixture' } }, res);
      await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
    });
    await page.route('**/api/santa-workshop-access', route => route.fulfill({
      json: { authorized: true, expiresAt: Date.now() + 3600000 },
    }));
    await page.route('**/api/santa-message-access', route => route.fulfill({
      json: { authorized: true, availableAt: 0 },
    }));
    await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      const hero = page.locator('.hero-name-checker');
      const input = hero.getByRole('combobox');
      const previous = requests.length;
      await input.fill('A');
      await page.waitForTimeout(350);
      expect(requests).toHaveLength(previous);
      await input.fill('Anna');
      await expect(hero.getByRole('option')).toHaveCount(2);
      await input.press('ArrowDown'); await input.press('Enter');
      await expect(hero.getByRole('status')).toContainText('Santa can record for Anna');
      await page.goto('/free-santa-message', { waitUntil: 'domcontentloaded' });
      const free = page.locator('.santa-message-box');
      const freeInput = free.getByRole('combobox');
      await expect(freeInput).toBeVisible();
      await freeInput.fill('Anna');
      await expect(free.getByRole('option')).toHaveCount(2);
      await freeInput.press('ArrowDown'); await freeInput.press('Enter');
      await expect(free.locator('.message-name-hint').filter({ hasText: 'Anna is selected' })).toBeVisible();
      await page.goto('/santa-message-workshop', { waitUntil: 'domcontentloaded' });
      const studio = page.getByRole('combobox', { name: 'Search recorded names', exact: true });
      await expect(studio).toBeVisible();
      await studio.fill('Anna');
      await expect(page.getByRole('listbox', { name: 'Recorded names' }).getByRole('option')).toHaveCount(2);
      await studio.press('ArrowDown'); await studio.press('Enter');
      await expect(page.locator('.smw-name-status')).toContainText('Selected name: Anna');
      expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/anna\.mp3|annabel\.mp3|selectionToken/);
    }
    expect(originCalls).toBe(1, 'both pickers and viewport changes reuse the server-only catalogue cache');
    expect(requests.length).toBeGreaterThanOrEqual(4);
    for (const request of requests) {
      expect(request.method).toBe('POST');
      expect(new URL(request.url).search).toBe('');
      expect(Object.keys(request.body)).toEqual(['query']);
    }
  }, { snapshotSchema });
});
}
