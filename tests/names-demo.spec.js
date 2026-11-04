import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px browser-only names`, () => {
    test.use({ viewport, hasTouch: viewport.width === 390 });
    test('one initial list load, then keyboard/touch searches work offline with zero requests', async ({ page, context }) => {
      await page.addInitScript(() => {
        window.__nameLoad = {};
        const original = window.fetch;
        window.fetch = async function (...args) {
          const timing = window.__nameLoad;
          timing.started = performance.now();
          const response = await original.apply(this, args);
          timing.headers = performance.now();
          const json = response.json.bind(response);
          response.json = async () => {
            timing.parseStarted = performance.now();
            const data = await json();
            timing.parsed = performance.now();
            return data;
          };
          return response;
        };
        new MutationObserver(() => {
          const input = document.getElementById('q');
          if (window.__nameLoad.parsed && input && !input.hasAttribute('aria-busy') && !window.__nameLoad.ready) {
            window.__nameLoad.ready = performance.now();
          }
        }).observe(document, { subtree: true, attributes: true });
      });
      const requests = [];
      const errors = [];
      page.on('request', req => requests.push(req.url()));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/names');
      const input = page.getByRole('combobox', { name: 'Name', exact: true });
      await expect(input).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('button', { name: 'Retry' })).toBeHidden();
      const assetRequests = requests.filter(url => new URL(url).pathname.startsWith('/names-data/'));
      expect(assetRequests).toHaveLength(1);
      expect(requests.filter(url => !['/names', new URL(assetRequests[0]).pathname].includes(new URL(url).pathname))).toEqual([]);
      const initialCount = requests.length;
      console.log(`${viewport.width}px initial load:`, await page.evaluate(() => {
        const t = window.__nameLoad;
        const resource = performance.getEntriesByType('resource').find(x => x.name.includes('/names-data/'));
        return {
          listReadyMs: +(t.ready - t.started).toFixed(2),
          fetchHeadersMs: +(t.headers - t.started).toFixed(2),
          bodyAndParseMs: +(t.parsed - t.parseStarted).toFixed(2),
          prepareIndexMs: +(t.ready - t.parsed).toFixed(2),
          encodedBytes: resource?.encodedBodySize, decodedBytes: resource?.decodedBodySize,
        };
      }));
      await context.setOffline(true);
      await input.fill('d');
      await expect(page.getByRole('option')).toHaveCount(0);
      await input.fill('da');
      await expect(page.getByRole('option').first()).toBeVisible();
      expect(await page.getByRole('option').count()).toBeLessThanOrEqual(10);
      await input.press('ArrowDown');
      await expect(input).toHaveAttribute('aria-activedescendant', 'opt-0');
      await input.press('ArrowUp');
      await expect(input).toHaveAttribute('aria-activedescendant', 'opt-9');
      await input.press('ArrowDown');
      const first = await page.getByRole('option').first().textContent();
      await input.press('Enter');
      await expect(input).toHaveValue(first);
      await expect(page.locator('#chosen')).toHaveText(`Selected: ${first}`);
      await input.fill('ma');
      const option = page.getByRole('option').first();
      await expect(option).toBeVisible();
      const tapped = await option.textContent();
      if (viewport.width === 390) await option.tap();
      else await option.click();
      await expect(input).toHaveValue(tapped);
      await input.fill('jo');
      await input.press('Escape');
      await expect(input).toHaveAttribute('aria-expanded', 'false');
      await input.fill('zzzzzzzzzz');
      await expect(page.getByRole('status')).toHaveText('No names found.');
      await input.fill('');
      await expect(page.getByRole('option')).toHaveCount(0);
      const timings = await page.evaluate(() => {
        const input = document.getElementById('q');
        const times = [];
        for (let i = 0; i < 100; i++) {
          input.value = ['da', 'ma', 'jo', 'an'][i % 4];
          const start = performance.now();
          input.dispatchEvent(new InputEvent('input', { bubbles: true }));
          times.push(performance.now() - start);
        }
        const firstMs = times[0];
        times.sort((a, b) => a - b);
        return { samples: times.length, firstMs, medianMs: times[50], p95Ms: times[95] };
      });
      console.log(`${viewport.width}px local filtering and DOM update:`, timings);
      expect(timings.p95Ms).toBeLessThan(50);
      expect(requests).toHaveLength(initialCount);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}

test('load failure is announced; only explicit retry reloads the list', async ({ page }) => {
  let loads = 0;
  await page.route('**/names-data/*', route => {
    loads++;
    return loads === 1
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ json: ['Daniel', 'Danny', 'Mary'] });
  });
  await page.goto('/names');
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  const input = page.getByRole('combobox');
  await input.fill('da');
  expect(loads).toBe(1);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(input).not.toHaveAttribute('aria-busy', 'true');
  await input.fill('dan');
  await expect(page.getByRole('option')).toHaveCount(2);
  expect(loads).toBe(2);
});

for (const dismissal of ['Escape', 'blur', 'composition']) {
  test(`pending initial load does not undo ${dismissal}`, async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/names-data/*', async route => {
      await gate;
      await route.fulfill({ json: ['Daniel', 'Danny'] });
    });
    await page.goto('/names');
    const input = page.getByRole('combobox');
    await input.fill('da');
    if (dismissal === 'Escape') await input.press('Escape');
    else if (dismissal === 'blur') await input.blur();
    else await input.dispatchEvent('compositionstart');
    release();
    await expect(input).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('option')).toHaveCount(0);
    if (dismissal === 'composition') {
      await input.dispatchEvent('compositionend');
      await expect(page.getByRole('option')).toHaveCount(2);
    }
  });
}

test('invalid catalogue is not rendered; public-file path cannot request audio or private files', async ({ page, request }) => {
  await page.route('**/names-data/*', route => route.fulfill({ json: { names: ['not-an-array'] } }));
  await page.goto('/names');
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  for (const path of ['/server/names-demo/snapshot.json', '/server/names-demo/asset-manifest.json',
    '/@fs/home/runner/workspace/server/names-demo/snapshot.json', '/names-data/private.mp3']) {
    expect((await request.get(path)).status()).toBe(404);
  }
});
