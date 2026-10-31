import { test, expect } from './fixtures/apps-test.js';
import { appDownloads } from './fixtures/apps-downloads.js';

test('all Apps copy remains unclipped with enlarged text at tablet and narrow widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await page.evaluate(() => document.fonts.ready);
    const clipped = await page.locator('.apps-page').evaluate(main => {
      return [...main.querySelectorAll('h1, h2, h3, p, .app-dl-btn')].flatMap(el => {
        const box = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        const lines = [...range.getClientRects()];
        return lines.some(line => line.left < Math.max(0, box.left) - 1 ||
          line.right > Math.min(innerWidth, box.right) + 1) ||
          el.scrollWidth > el.clientWidth + 1 ? [el.textContent] : [];
      });
    });
    expect(clipped).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('phone frames distinguish real UI from complete promotional compositions and scenery loads responsively', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(page.locator('#santaradio .app-screenshots-device')).toHaveCount(1);
  const phone = page.locator('#santaradio .app-screenshots-device');
  await expect(phone.locator('.app-phone-hardware[aria-hidden="true"] > span')).toHaveCount(4);
  await expect(phone.locator('.app-phone-power')).toBeVisible();
  expect(await phone.locator('.app-screenshots-frame').evaluate(el =>
    getComputedStyle(el, '::before').content)).toBe('none');
  for (const selector of ['#christmasradio', '.apple-watch-showcase']) {
    await expect(page.locator(`${selector} .app-screenshots-artwork`)).toHaveCount(1);
    await expect(page.locator(`${selector} .app-screenshots-device`)).toHaveCount(0);
  }
  for (const id of ['santavoicemail', 'santamessages', 'santatext']) {
    await expect(page.locator(`#${id} .app-promo-wrap img`)).toHaveCSS('object-fit', 'contain');
    await expect(page.locator(`#${id} .app-screenshots-device`)).toHaveCount(0);
  }
  await expect(page.locator('#santadash .app-screenshots-landscape')).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const background = await page.locator('#santaradio').evaluate(el => getComputedStyle(el).backgroundImage);
    const url = background.match(/url\("([^"]+)"\)/)[1];
    expect(url).toContain(width > 767 ? 'christmas-room-wide' : 'christmas-room-mobile');
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(width > 767 ? 200000 : 90000);
  }
});

test('Apps is usable on first server render without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('/apps');
    await expect(page.getByRole('heading', { level: 1, name: 'Christmas Apps', exact: true })).toBeVisible();
    for (const app of appDownloads) {
      const section = page.locator(`#${app.id}`);
      await expect(section.locator('h2')).toHaveText(app.title);
      await expect(section.locator('.feature-item')).toHaveCount(6);
      await expect(section.locator('.app-dl-btn').first()).toHaveAttribute('href', app.apple);
      const image = section.locator('img').first();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    await expect(page.locator('#santaradio .is-active')).toHaveAttribute('aria-hidden', 'false');
    const mac = page.getByRole('region', { name: 'Santa Radio for Mac', exact: true });
    await expect(mac.getByRole('heading', { name: 'Santa Radio for Mac', exact: true })).toBeVisible();
    await expect(mac.locator('.mac-app-description')).toHaveText('Play Santa Radio and see the current song and artist.');
    await expect(mac.locator('.mac-app-status, [role="status"]')).toHaveCount(0);
    await expect(mac).not.toContainText(/Coming soon/i);
    await expect(mac.getByRole('link')).toHaveCount(0);
    await expect(mac.getByRole('img')).toHaveCount(1);
    await expect(page.locator('.apple-tv-instruction')).toHaveText('Find Santa Radio in the App Store on your Apple TV.');
  } finally {
    await context.close();
  }
});

test('save representative desktop and mobile showcase review captures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `generated-artifacts/apps-review-page-${width}.jpg`, animations: 'disabled' });
    for (const [name, selector] of [
      ['radio', '#santaradio'], ['watch', '.apple-watch-showcase'],
      ['tv', '.apple-tv-showcase'], ['mac', '#santa-radio-mac'],
      ['messages', '#santamessages'], ['dash', '#santadash'],
    ]) {
      const section = page.locator(selector);
      for (const image of await section.locator('img').all()) {
        await image.evaluate(el => { el.loading = 'eager'; });
        await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      }
      // Isolated section captures omit fixed shell overlays; the page captures
      // above retain the real navigation and persistent radio for review.
      await section.screenshot({
        path: `generated-artifacts/apps-review-${name}-${width}.jpg`,
        animations: 'disabled',
        style: '.radio-dock, .navbar { visibility: hidden !important; }',
      });
    }
  }
});
