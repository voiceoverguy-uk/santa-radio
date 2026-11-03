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

test('all six app screens use physical phones while Watch, TV and Mac stay separate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(page.locator('#santaradio .app-screenshots-device')).toHaveCount(1);
  const phone = page.locator('#santaradio .app-screenshots-device');
  await expect(phone.locator('.app-phone-hardware[aria-hidden="true"] > span')).toHaveCount(4);
  await expect(phone.locator('.app-phone-power')).toBeVisible();
  expect(await phone.locator('.app-screenshots-frame').evaluate(el =>
    getComputedStyle(el, '::before').content)).toBe('none');
  await expect(page.locator('#christmasradio .app-screenshots-device')).toHaveCount(1);
  for (const selector of ['.apple-watch-showcase']) {
    await expect(page.locator(`${selector} .app-screenshots-artwork`)).toHaveCount(1);
    await expect(page.locator(`${selector} .app-screenshots-device`)).toHaveCount(0);
  }
  for (const id of ['santavoicemail', 'santamessages']) {
    await expect(page.locator(`#${id} .app-screenshots-device img`)).toHaveCSS('object-fit', 'contain');
    await expect(page.locator(`#${id} .app-screenshots-classic`)).toHaveCount(1);
  }
  const textPhone = page.locator('#santatext .app-screenshots-device');
  await expect(textPhone.locator('img')).toHaveCount(4);
  await expect(textPhone.locator('img').first()).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('#santatext .app-screenshots-classic')).toHaveCount(0);
  await expect(page.locator('.app-section .app-screenshots-device')).toHaveCount(6);
  await expect(page.locator('.app-section .app-promo-wrap, .app-section .app-screenshots-artwork')).toHaveCount(0);
  await expect(page.locator('.apple-tv-showcase .app-screenshots-device, .apple-watch-showcase .app-screenshots-device, .mac-app-showcase .app-screenshots-device')).toHaveCount(0);
  await expect(page.locator('#santadash .app-screenshots-landscape')).toHaveCount(1);
  for (const id of ['santaradio', 'santavoicemail', 'santamessages', 'christmasradio', 'santatext', 'santadash']) {
    const phone = page.locator(`#${id} .app-screenshots-device`);
    const background = await phone.locator('.app-screenshots-frame').evaluate(el => getComputedStyle(el).backgroundImage);
    if (id === 'santadash') {
      await expect(phone).toHaveClass(/app-screenshots-dark-landscape/);
      expect(background).toContain('linear-gradient');
      expect(background).not.toContain('phone-landscape');
      expect(background).not.toContain('phone-portrait');
    } else {
      expect(background).toContain('phone-portrait');
      const hardwareUrl = background.match(/url\("([^"]+)"\)/)[1];
      expect((await page.request.get(hardwareUrl)).ok()).toBe(true);
    }
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const bounds = await phone.boundingBox();
      const copy = await page.locator(`#${id} .app-copy`).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      if (width >= 768) expect(copy.x).toBeGreaterThanOrEqual(bounds.x + bounds.width + 20);
      else expect(copy.y).toBeGreaterThanOrEqual(bounds.y + bounds.height + 20);
    }
  }
});

test('all nine Apps sections keep forest-green wrapping backgrounds at every breakpoint', async ({ page }) => {
  const sceneryRequests = [];
  page.on('request', request => {
    if (/christmas-room-(wide|mobile)/.test(request.url())) sceneryRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  const sections = page.locator('.app-section, .apple-watch-showcase, .apple-tv-showcase, .mac-app-showcase');
  await expect(sections).toHaveCount(9);
  for (const width of [1440, 1024, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const section of await sections.all()) {
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveCSS('background-color', 'rgb(9, 36, 25)');
      await expect(section).toHaveCSS('background-image', /apps-wrap-tile|image\/svg\+xml/);
      for (const pseudo of ['::before', '::after']) {
        expect(await section.evaluate((el, pseudo) => {
          const style = getComputedStyle(el, pseudo);
          return { content: style.content, image: style.backgroundImage };
        }, pseudo)).toEqual({ content: 'none', image: 'none' });
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(sceneryRequests).toEqual([]);
});

test('Mac monitor keeps its full artwork, short stand and external caption unclipped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const section = page.locator('#santa-radio-mac');
  const monitor = section.locator('.mac-monitor');
  const image = monitor.getByRole('img');
  await expect(image).toHaveCount(1);
  await expect(section.locator('.mac-monitor-bezel[aria-hidden="true"], .mac-monitor-neck[aria-hidden="true"], .mac-monitor-base[aria-hidden="true"]')).toHaveCount(3);
  await expect(section.locator('.mac-app-figure > figcaption')).toHaveText('Santa Radio for Mac promotional artwork');
  await expect(monitor.locator('figcaption, a, button')).toHaveCount(0);
  await expect(page.locator('.mac-monitor')).toHaveCount(1);
  for (const width of [1440, 1024, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await monitor.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await image.evaluate(el => el.decode());
    const geometry = await section.evaluate(section => {
      const box = selector => section.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        image: box('.mac-monitor img'), screen: box('.mac-monitor-screen'),
        neck: box('.mac-monitor-neck'), base: box('.mac-monitor-base'),
        monitor: box('.mac-monitor'), caption: box('figcaption'),
        section: section.getBoundingClientRect().toJSON(),
        dockTop: document.querySelector('.radio-dock').getBoundingClientRect().top,
      };
    });
    const { image: artwork, screen, neck, base, caption, monitor: hardware } = geometry;
    expect(artwork.width / artwork.height).toBeCloseTo(1672 / 941, 3);
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1672, 941]);
    await expect(image).toHaveCSS('object-fit', 'contain');
    expect(artwork.left).toBeGreaterThan(screen.left);
    expect(artwork.right).toBeLessThan(screen.right);
    expect(artwork.top).toBeGreaterThan(screen.top);
    expect(artwork.bottom).toBeLessThan(screen.bottom);
    expect(screen.width).toBeGreaterThan(screen.height * 1.5);
    expect(neck.top).toBeCloseTo(screen.bottom - 1, 1);
    expect(neck.height).toBeLessThanOrEqual(screen.height * .15);
    expect(base.top).toBeCloseTo(neck.bottom - 1, 1);
    expect(base.height).toBeGreaterThan(0);
    expect(base.width).toBeGreaterThan(neck.width);
    expect(base.width).toBeLessThan(screen.width * .4);
    expect(base.left + base.width / 2).toBeCloseTo(screen.left + screen.width / 2, 1);
    expect(caption.top).toBeGreaterThanOrEqual(base.bottom);
    for (const bounds of [screen, neck, base]) {
      expect(bounds.left).toBeGreaterThanOrEqual(geometry.section.left);
      expect(bounds.right).toBeLessThanOrEqual(Math.min(width, geometry.section.right));
      expect(bounds.bottom).toBeLessThanOrEqual(hardware.bottom);
      expect(bounds.top).toBeGreaterThanOrEqual(85);
      expect(bounds.bottom).toBeLessThanOrEqual(geometry.dockTop);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([1440, 390, 320].includes(width)) {
      await section.screenshot({
        path: `generated-artifacts/apps-mac-monitor-${width}.jpg`,
        animations: 'disabled',
        style: '.radio-dock, .navbar, .skip-link { visibility: hidden !important; }',
      });
    }
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
      const download = section.locator('.app-dl-btn');
      await expect(download).toHaveCount(1);
      await expect(download).toHaveAttribute('href', app.apple);
      const badge = download.getByRole('img', { name: 'Download on the App Store', exact: true });
      await expect(badge).toHaveAttribute('src', '/images/download-on-the-app-store.svg');
      await badge.evaluate(image => image.decode());
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
    await expect(mac.getByRole('link')).toHaveCount(1);
    await expect(mac.getByRole('link')).toHaveAttribute('href', 'https://apps.apple.com/gb/app/santa-radio/id1025312198?mt=12');
    await expect(mac.getByRole('link').getByRole('img')).toHaveAttribute('src', '/images/download-on-the-app-store.svg');
    const macImage = mac.locator('figure img');
    await expect(macImage).toHaveAttribute('width', '1672');
    await expect(macImage).toHaveAttribute('height', '941');
    await macImage.scrollIntoViewIfNeeded();
    await macImage.evaluate(image => image.decode());
    expect(await macImage.evaluate(image => [image.naturalWidth, image.naturalHeight])).toEqual([1672, 941]);
    const tv = page.getByRole('region', { name: 'Available FREE on Apple TV', exact: true });
    await expect(tv.locator('.apple-tv-instruction')).toHaveCount(0);
    const tvDownload = tv.getByRole('link', { name: 'Download Santa Radio for Apple TV on the App Store (opens in a new tab)', exact: true });
    await expect(tvDownload).toHaveAttribute('href', 'https://apps.apple.com/gb/app/santa-radio/id1021183593');
    await expect(tvDownload).toHaveAttribute('target', '_blank');
    await expect(tvDownload).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(tvDownload.getByRole('img')).toHaveAttribute('src', '/images/download-on-the-app-store.svg');
    await expect(tv).not.toContainText('Find Santa Radio in the App Store on your Apple TV.');
    await expect(page.locator('.apps-page a[href*="amazon."]')).toHaveCount(0);
    await expect(page.locator('.apps-page a img[src="/images/download-on-the-app-store.svg"]')).toHaveCount(8);
  } finally {
    await context.close();
  }
});

test('save representative desktop and mobile showcase review captures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `generated-artifacts/apps-review-page-${width}.jpg`, animations: 'disabled' });
    for (const [name, selector] of [
      ['radio', '#santaradio'], ['watch', '.apple-watch-showcase'],
      ['tv', '.apple-tv-showcase'], ['mac', '#santa-radio-mac'],
      ['voicemail', '#santavoicemail'], ['messages', '#santamessages'],
      ['christmas-radio', '#christmasradio'], ['text', '#santatext'], ['dash', '#santadash'],
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
        style: '.radio-dock, .navbar, .skip-link { visibility: hidden !important; }',
      });
    }
  }
});
