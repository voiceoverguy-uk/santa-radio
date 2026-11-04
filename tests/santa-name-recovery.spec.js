import { test, expect } from '@playwright/test';
import { withNameDatabase } from '../scripts/helpers/private-name-fixture.mjs';
import { createNameSnapshotStore } from '../server/santa-name-snapshot.js';
import { createNameLibrary, parseNameIndex } from '../server/santa-name-library.js';
import { createSantaNamesHandler } from '../server/santa-names.js';
import { consumeNameAccess, issueNameToken } from '../server/santa-name-security.js';
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

test('all name pickers separate outages from no matches, keep local choices and retry privately', async ({ page }) => {
  test.setTimeout(150000);
  await withNameDatabase(async pool => {
    let unavailable = true, storageFailure = false;
    const key = 'isolated-browser-recovery-signing-key';
    const store = createNameSnapshotStore({ pool: () => pool, parse: parseNameIndex,
      fetchIndex: async () => {
        if (unavailable) throw Object.assign(new Error('fixture unavailable'), { code: 'UPSTREAM_FETCH' });
        return Buffer.from(JSON.stringify({ version: 1, names: [
          { id: 'anna', name: 'Anna', file: 'anna.mp3' },
        ] }));
      } });
    const handler = createSantaNamesHandler(createNameLibrary({ snapshotStore: store }), {
      limit: (req, scope) => {
        if (storageFailure) throw Object.assign(new Error('fixture storage failure'), { code: '08006' });
        return consumeNameAccess(req, scope, { pool, key });
      },
      token: (id, scope) => issueNameToken(id, scope, Date.now(), key),
    });
    const requests = [];
    let address = 'browser-recovery';
    let missingNameSubmissions = 0;
    await page.route('**/api/santa-name-requests', route => {
      missingNameSubmissions++;
      return route.fulfill({ status: 503, json: { error: 'should not submit during outage' } });
    });
    await page.route('**/api/santa-names', async route => {
      const incoming = route.request();
      requests.push({ url: incoming.url(), method: incoming.method(), body: incoming.postDataJSON() });
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
        writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
      await handler({ method: incoming.method(), headers: await incoming.allHeaders(), url: '/api/santa-names',
        body: incoming.postDataJSON(), socket: { remoteAddress: address } }, res);
      await route.fulfill({ status: res.status, headers: res.headers, body: res.body });
    });
    // Access fixtures only expose the picker, never exercise purchases or writes.
    await page.route('**/api/santa-message-access', route => route.fulfill({ json: { authorized: true, availableAt: 0 } }));
    await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 1 } }));
    await page.route('**/api/santa-workshop-access', route => route.fulfill({
      json: { authorized: true, expiresAt: Date.now() + 3600000 },
    }));
    await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      unavailable = true;
      // Clear only isolated catalogue state to exercise cold failure each time.
      await pool.query(`UPDATE santa_name_catalogue SET version=NULL,payload=NULL,record_count=NULL,
        next_refresh_at=NULL,retry_after=NULL WHERE catalogue_key='recorded-names'`);
      for (const surface of ['hero', 'free', 'studio']) {
        address = `browser-recovery-${width}-${surface}`;
        await page.goto(surface === 'hero' ? '/' : surface === 'free' ? '/free-santa-message' : '/santa-message-workshop',
          { waitUntil: 'domcontentloaded' });
        const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
        if (await decline.isVisible()) await decline.click();
        const panel = page.locator(surface === 'hero' ? '.hero-name-checker'
          : surface === 'free' ? '.santa-message-box' : '.smw-name-picker');
        const input = panel.getByRole('combobox');
        await expect(input).toBeVisible();
        await input.fill('Zzxxyy');
        await expect(panel).toContainText(/could not be checked|temporarily unavailable/);
        await expect(panel).not.toContainText(/haven’t found|has not recorded|No matching recording yet/);
        await expect(panel.getByRole('button', { name: 'Request this name', exact: true })).toHaveCount(0);
        // Limited local results remain selectable despite the hosted failure.
        await input.fill('Arabella');
        await expect(panel.getByRole('option')).toHaveCount(1);
        await input.press('ArrowDown'); await input.press('Enter');
        await expect(panel).toContainText(/selected|Santa can record for Arabella/i);
        await expect(panel).toContainText(/incomplete|could not be checked/);
        storageFailure = true;
        await input.fill('Anna');
        await expect(panel).toContainText('name search is temporarily unavailable');
        await expect(panel).not.toContainText(/haven’t found|has not recorded|No matching recording yet/);
        await expect(panel.getByRole('option')).toHaveCount(0);
        storageFailure = false;
        unavailable = false;
        await store.refresh({ force: true });
        const retry = panel.getByRole('button', { name: 'Retry name search', exact: true });
        await expect(retry).toBeVisible();
        await retry.click();
        await expect(panel.getByRole('option')).toHaveCount(1);
        await input.press('ArrowDown'); await input.press('Enter');
        await expect(panel).toContainText(/selected|Santa can record for Anna/i);
        await input.fill('Zzxxyy');
        await expect(panel).toContainText(surface === 'hero' ? 'haven’t found that spelling'
          : surface === 'studio' ? 'has not recorded' : 'No matching recording yet');
        if (surface === 'free') {
          await expect(panel.getByRole('button', { name: 'Request this name', exact: true })).toBeVisible();
        }
        unavailable = true;
        await pool.query(`UPDATE santa_name_catalogue SET version=NULL,payload=NULL,record_count=NULL,
          next_refresh_at=NULL,retry_after=NULL WHERE catalogue_key='recorded-names'`);
      }
    }
    expect(missingNameSubmissions).toBe(0);
    for (const request of requests) {
      expect(request.method).toBe('POST');
      expect(new URL(request.url).search).toBe('');
      expect(Object.keys(request.body)).toEqual(['query']);
    }
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/selectionToken|anna\.mp3/);
  });
});
