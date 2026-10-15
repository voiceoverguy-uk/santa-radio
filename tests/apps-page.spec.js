import { test, expect } from '@playwright/test';

const slideLabels = ['Radio', 'Artists', 'MugShots', 'Tracker'];
async function openSlideshow(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  const carousel = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  for (const label of slideLabels) {
    await expect(carousel.getByRole('button', { name: `Show ${label} screenshot` })).toBeEnabled();
  }
  await page.mouse.move(0, 0);
  return carousel;
}

async function expectSlide(carousel, label) {
  await expect(carousel.getByRole('button', { name: `Show ${label} screenshot` })).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('.app-screenshots-caption')).toHaveText(`${label} · ${slideLabels.indexOf(label) + 1} of 4`);
}

test('current iOS screenshots are local, optimised, ordered and loop every five seconds', async ({ page }) => {
  const carousel = await openSlideshow(page);
  const images = carousel.locator('img');
  await expect(images).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const image = images.nth(i);
    expect(await image.getAttribute('src')).toMatch(/^\/.*\.webp/);
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([660, 1434]);
    const response = await page.request.get(await image.getAttribute('src'));
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeLessThan(250000);
  }
  await expectSlide(carousel, 'Radio');
  await page.clock.fastForward(4999);
  await expectSlide(carousel, 'Radio');
  await page.clock.fastForward(1);
  await expectSlide(carousel, 'Artists');
  for (const label of ['MugShots', 'Tracker', 'Radio']) {
    await page.clock.fastForward(5000);
    await expectSlide(carousel, label);
  }
  await expect(carousel).toContainText('iOS screenshots only');
  await expect(page.locator('.app-store-notice')).toContainText('Other app screenshots');
});

test('manual selection, pause, hover, keyboard focus and hidden tabs suspend rotation', async ({ page }) => {
  const carousel = await openSlideshow(page);
  await carousel.getByRole('button', { name: 'Show Tracker screenshot' }).click();
  await expectSlide(carousel, 'Tracker');
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Tracker');
  await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Tracker');
  await carousel.getByRole('button', { name: 'Resume slideshow' }).click();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Tracker'); // focused controls still suspend it
  await page.locator('h1').click();
  await carousel.hover();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Tracker');
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Tracker');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 'Radio');
  await carousel.getByRole('button', { name: 'Show Radio screenshot' }).focus();
  await page.keyboard.press('Tab');
  const artists = carousel.getByRole('button', { name: 'Show Artists screenshot' });
  await expect(artists).toBeFocused();
  expect(await artists.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expectSlide(carousel, 'Artists');
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Artists');
});

test('reduced motion starts static and all slides share an uncropped stable responsive frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await openSlideshow(page);
  await expect(carousel.getByRole('button', { name: 'Resume slideshow' })).toBeVisible();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 'Radio');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await carousel.boundingBox();
    for (const label of slideLabels) {
      await carousel.getByRole('button', { name: `Show ${label} screenshot` }).click();
      await expectSlide(carousel, label);
      const after = await carousel.boundingBox();
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
      const image = await carousel.locator('.is-active').evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration };
      });
      expect(image.ratio).toBeCloseTo(660 / 1434, 3);
      expect(image.fit).toBe('contain');
      expect(image.transition).toBe('0s');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('an unloaded next screenshot never replaces the ready image', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/santa-radio-ios-artists*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue();
    await held;
    await route.continue();
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const carousel = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  await expect(carousel.getByRole('button', { name: 'Show Radio screenshot' })).toBeEnabled();
  await expect(carousel.getByRole('button', { name: 'Show Artists screenshot' })).toBeDisabled();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Radio');
  release();
  await expect(carousel.getByRole('button', { name: 'Show Artists screenshot' })).toBeEnabled();
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 'Artists');
});

test('Apps has six complete sections, real local images and app-specific downloads', async ({ page }) => {
  await page.goto('/apps');
  const titles = ['Santa Radio App', 'Santa Voicemail', 'Santa Messages', 'Christmas Radio', 'Santa Text', 'Santa Dash'];
  const ids = ['1021183593', '586387813', '1062532143', '1157967613', '1024535991', '1057048397'];
  const amazon = ['B0158MYRBM', 'B00QFP4B18', 'B019MRFDDK', 'B01M18XUXV'];
  await expect(page.locator('.app-section')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Sleeps til Santa', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="949843943"], a[href*="B00R2PU0BA"]')).toHaveCount(0);
  for (let i = 0; i < titles.length; i++) {
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: titles[i], exact: true }) });
    await expect(section).toHaveCount(1);
    const image = section.locator('img').first();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    expect(await image.getAttribute('src')).toMatch(/^\//);
    await expect(section.locator('.feature-item')).toHaveCount(6);
    await expect(section.getByRole('link', { name: /on iOS/i })).toHaveAttribute('href', new RegExp(ids[i]));
    if (amazon[i]) await expect(section.getByRole('link', { name: /on Amazon/i })).toHaveAttribute('href', new RegExp(amazon[i]));
    else await expect(section.getByRole('link', { name: /on Amazon/i })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Santa Text and Santa Voicemail show complete optimised owner artwork at desktop and phone widths', async ({ page }) => {
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  for (const id of ['santatext', 'santavoicemail']) {
    const section = page.locator(`#${id}`);
    const image = section.locator('img');
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*santa-${id === 'santatext' ? 'text' : 'voicemail'}-promo.*\\.webp`));
    await expect(image).toHaveAttribute('width', '851');
    await expect(image).toHaveAttribute('height', '1849');
    await expect(image).toHaveAttribute('alt', /promotional artwork/);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(500000);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([851, 1849]);
      const bounds = await image.boundingBox();
      expect(bounds.width / bounds.height).toBeCloseTo(851 / 1849, 3);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await image.evaluate(el => getComputedStyle(el).objectFit)).toBe('contain');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await image.screenshot({ path: `generated-artifacts/apps-${id}-new-artwork.jpg` });
  }
  await expect(page.locator('.app-store-notice')).toContainText('Santa Text and Santa Voicemail also use owner-supplied promotional artwork');
});

test('Mac app listing shows its supplied interface and Coming soon without a store link', async ({ page }) => {
  await page.goto('/apps');
  const section = page.getByRole('region', { name: 'Santa Radio for Mac' });
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Santa Radio for Mac', exact: true })).toBeVisible();
  await expect(section.getByRole('status')).toHaveText('Coming soon');
  await expect(section).toContainText('Play Santa Radio and see the current song and artist.');
  await expect(section.getByRole('link')).toHaveCount(0);
  await expect(section.getByRole('button')).toHaveCount(0);

  const image = section.getByRole('img', {
    name: 'Screenshot of the Santa Radio Mac app interface showing the current track, song and artist, and a Play button.',
  });
  const imageUrl = await image.getAttribute('src');
  expect(imageUrl).toMatch(/\.webp/);
  const response = await page.request.get(imageUrl);
  expect(response.ok()).toBe(true);
  expect((await response.body()).length).toBeLessThan(250000);

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([788, 1328]);
    const bounds = await image.boundingBox();
    expect(bounds.width).toBeGreaterThan(200);
    expect(bounds.width / bounds.height).toBeCloseTo(788 / 1328, 2);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const appList = graph['@graph'].find(node => node['@type'] === 'ItemList');
  expect(appList.numberOfItems).toBe(7);
  expect(appList.itemListElement.at(-1)).toMatchObject({
    name: 'Santa Radio for Mac',
    url: 'https://www.santaradio.co.uk/apps#santa-radio-mac',
    description: 'Play Santa Radio and see the current song and artist.',
  });
  expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|SoftwareApplication|MobileApplication|"offers"/);
  await expect(page.locator('.app-section')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Available FREE on Apple TV' })).toBeVisible();
});

test('Apple TV has its own free big-screen section and a responsive supplied screenshot', async ({ page }) => {
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  const section = page.getByRole('region', { name: 'Available FREE on Apple TV' });
  await expect(section).toBeVisible();
  await expect(section).toContainText('Find Santa Radio in the App Store on your Apple TV.');
  await expect(section.getByRole('link')).toHaveCount(0);
  const image = section.getByRole('img', { name: /Santa Radio on Apple TV/i });
  await expect(image).toHaveAttribute('width', '1920');
  await expect(image).toHaveAttribute('height', '1080');
  const imageUrl = await image.getAttribute('src');
  expect(imageUrl).toMatch(/^\//);
  expect(imageUrl).toMatch(/\.webp/);
  const response = await page.request.get(imageUrl);
  expect(response.ok()).toBe(true);
  expect((await response.body()).length).toBeLessThan(500000);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) {
      // A fresh phone visit starts with the radio dock minimised.
      await page.reload();
      await expect(page.locator('.radio-dock')).toHaveClass(/is-minimized/);
    }
    await section.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    if (width === 1280) await page.evaluate(() => window.scrollBy({ top: 90, behavior: 'instant' }));
    await expect.poll(() => image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1920, 1080]);
    const bounds = await image.boundingBox();
    expect(bounds.width).toBeGreaterThan(250);
    expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 1);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const dock = await page.locator('.radio-dock').boundingBox();
    const overlap = bounds.y + bounds.height - dock.y;
    if (overlap > 0) {
      await page.evaluate(distance => window.scrollBy({ top: distance, behavior: 'instant' }), overlap + 24);
    }
    const visibleImage = await image.boundingBox();
    expect(visibleImage.y + visibleImage.height).toBeLessThanOrEqual(dock.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `generated-artifacts/apps-apple-tv-${width}.jpg` });
  }
  await expect(page.locator('.app-section')).toHaveCount(6);
  await expect(page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' })).toBeVisible();
});

test('shared menus omit Stories and Video and Apps navigation preserves audio', async ({ page }) => {
  await page.goto('/mugshots/a1-singers');
  const menu = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(menu.getByRole('link', { name: 'Santa Stories' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Santa Video' })).toHaveCount(0);
  await page.evaluate(() => window.savedAudio = document.querySelector('audio'));
  await menu.getByRole('link', { name: 'Apps', exact: true }).click();
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.getByRole('button', { name: 'Open menu' }).click();
  await expect(menu.getByRole('link', { name: 'Santa Stories' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Santa Video' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Music', exact: true })).toBeVisible();
});
