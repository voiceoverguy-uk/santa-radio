import { test, expect } from '@playwright/test';
import { appDownloads, obsoleteStoreCopy } from './fixtures/apps-downloads.js';

const slideLabels = ['Radio', 'Artists', 'MugShots', 'Tracker'];

test('Apps hero starts with Christmas Apps without a logo or leftover space at desktop and phone widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const hero = page.locator('.apps-hero');
    await expect(hero.getByRole('heading', { name: 'Christmas Apps', level: 1, exact: true })).toBeVisible();
    await expect(hero.locator('img, .apps-hero-logo')).toHaveCount(0);
    await expect(hero.locator('.apps-hero-content > :first-child')).toHaveClass('apps-hero-title');
    const heroSpacing = await hero.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const heading = element.querySelector('h1').getBoundingClientRect();
      const description = element.querySelector('.apps-hero-desc').getBoundingClientRect();
      return {
        top: heading.top - bounds.top,
        description: description.top - heading.bottom,
        bottom: bounds.bottom - description.bottom,
      };
    });
    expect(heroSpacing.top).toBeCloseTo(width >= 768 ? 72 : 48, 1);
    expect(heroSpacing.description).toBeCloseTo(22, 1);
    // Includes the hero's one-pixel bottom border.
    expect(heroSpacing.bottom).toBeCloseTo(width >= 768 ? 77 : 53, 1);
  }
});

test('Apps introduction is uncluttered on desktop and phones while navigation and SEO remain intact', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/apps');
    await expect(page.locator('.app-store-notice, .seo-breadcrumbs')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('Amazon has ended Appstore support');
    await expect(page.locator('main')).not.toContainText('Santa Radio’s catalogue screenshots show');
    await expect(page.locator('main')).not.toContainText('The original destination links have been retained.');
    await expect(page.locator('.apps-hero + div > .app-section').first()).toHaveAttribute('id', 'santaradio');
    const gap = await page.locator('#santaradio').evaluate(section => {
      const hero = document.querySelector('.apps-hero').getBoundingClientRect();
      return {
        section: section.getBoundingClientRect().top - hero.bottom,
        heading: section.querySelector('h2').getBoundingClientRect().top - hero.bottom,
      };
    });
    expect(gap.section).toBeCloseTo(0, 1);
    expect(gap.heading).toBeCloseTo(width >= 768 ? 76 : 52, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page).toHaveTitle('Christmas Apps — App Store Downloads | Santa Radio');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.santaradio.co.uk/apps');
    const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(graph['@graph'].find(node => node['@type'] === 'BreadcrumbList').itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.santaradio.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Apps', item: 'https://www.santaradio.co.uk/apps' },
    ]);
    const menu = page.getByRole('navigation', { name: 'Main navigation' });
    if (width < 768) await menu.getByRole('button', { name: 'Open menu' }).click();
    await menu.getByRole('link', { name: 'Music', exact: true }).click();
    await expect(page).toHaveURL(/\/christmas-music$/);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toBeVisible();
    if (width < 768) await menu.getByRole('button', { name: 'Open menu' }).click();
    await menu.getByRole('link', { name: 'Apps', exact: true }).click();
    await expect(page).toHaveURL(/\/apps$/);
    await expect(page.getByRole('heading', { name: 'Christmas Apps', exact: true })).toBeVisible();
    await expect(page.locator('.app-store-notice, .seo-breadcrumbs')).toHaveCount(0);
  }
});

async function openSlideshow(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  const carousel = page.getByRole('region', { name: 'Santa Radio current iOS app screenshots' });
  await expect.poll(() => carousel.locator('img').evaluateAll(images =>
    images.every(image => image.complete && image.naturalWidth > 0)
  )).toBe(true);
  await carousel.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.mouse.move(0, 0);
  return carousel;
}

async function expectSlide(carousel, label) {
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await expect(carousel.locator('img[aria-hidden="false"]')).toHaveCount(1);
  await expect(carousel.locator('.app-screenshots-caption, .app-screenshots-controls, .app-screenshots-dots, .app-screenshots-toggle')).toHaveCount(0);
  await expect(carousel.getByRole('button')).toHaveCount(0);
  const index = slideLabels.indexOf(label);
  await expect(carousel.locator('img').nth(index)).toHaveClass(/is-active/);
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
  await expect(carousel.locator('.app-screenshots-note')).toHaveCount(0);
  await expect(page.locator('.app-store-notice')).toHaveCount(0);
});

test('hover and hidden tabs suspend automatic rotation', async ({ page }) => {
  const carousel = await openSlideshow(page);
  await carousel.hover();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Radio');
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Radio');
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 'Artists');
  await carousel.hover();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Artists');
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 'MugShots');
});

test('reduced motion is static and all slides share an uncropped stable responsive frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await openSlideshow(page);
  await expect(carousel.getByRole('button')).toHaveCount(0);
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 'Radio');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await carousel.boundingBox();
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
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 'Radio');
  release();
  await expect.poll(() => carousel.locator('img').nth(1).evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await carousel.locator('img').nth(1).evaluate(image => image.decode());
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 'Artists');
});

test('Apps has six complete sections, real local images and app-specific downloads', async ({ page }) => {
  await page.goto('/apps');
  await expect(page.locator('.app-section')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Sleeps til Santa', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="949843943"], a[href*="B00R2PU0BA"]')).toHaveCount(0);
  for (const app of appDownloads) {
    const section = page.getByRole('region', { name: app.title, exact: true });
    await expect(section).toHaveCount(1);
    const image = section.locator('img').first();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
    expect(await image.getAttribute('src')).toMatch(/^\//);
    await expect(section.locator('.feature-item')).toHaveCount(6);
    await expect(section.getByRole('link', { name: /Download on the App Store/ })).toHaveAttribute('href', app.apple);
    if (app.amazon) await expect(section.getByRole('link', { name: /Download on Amazon Appstore/ })).toHaveAttribute('href', app.amazon);
    else await expect(section.getByRole('link', { name: /Download on Amazon Appstore/ })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('store panels are removed, copy and metadata are accurate and downloads work by pointer and keyboard at all widths', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await expect(page.locator('.app-store-card, .app-store-details')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(obsoleteStoreCopy);
  await expect(page.locator('.apps-hero-desc')).toContainText('Check the linked stores for current pricing.');
  await expect(page).toHaveTitle('Christmas Apps — App Store Downloads | Santa Radio');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /App Store and Amazon Appstore download links and device showcases/);
  await expect(page.locator('.app-store-notice')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);

  // Test real new-tab activation without depending on external stores' uptime.
  await page.context().route(/https?:\/\/(apps\.apple\.com|itunes\.apple\.com|www\.amazon\.(com|co\.uk))\//, route =>
    route.fulfill({ contentType: 'text/html', body: '<title>Store listing destination</title>' }));
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const app of appDownloads) {
      const section = page.locator(`#${app.id}`);
      const links = section.locator('.app-dl-btn');
      await expect(links).toHaveCount(app.amazon ? 2 : 1);
      const stores = [['the App Store', app.apple], ...(app.amazon ? [['Amazon Appstore', app.amazon]] : [])];
      for (const [index, [store, href]] of stores.entries()) {
        const link = links.nth(index);
        await expect(link).toHaveText(`Download on ${store}`);
        await expect(link).toHaveAttribute('aria-label', `Download on ${store} — ${app.title} (opens in a new tab)`);
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        // Tab from each link to its successor (or back) exercises actual keyboard focus.
        await link.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
        expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
        const bounds = await link.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(48);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
        for (const activate of [() => page.keyboard.press('Enter'), () => link.click()]) {
          const opened = page.waitForEvent('popup');
          await activate();
          const popup = await opened;
          await popup.waitForLoadState();
          expect(popup.url()).toBe(href);
          await popup.close();
          await page.mouse.move(0, 0);
        }
      }
      const gap = await section.evaluate(el => {
        const features = el.querySelector('.app-features-grid').getBoundingClientRect();
        const buttons = el.querySelector('.app-download-btns').getBoundingClientRect();
        const textColumn = el.querySelector('.app-copy');
        return {
          buttonsAfterContent: buttons.top - features.bottom,
          inTextColumn: textColumn.contains(el.querySelector('.app-download-btns')),
          order: Boolean(el.querySelector('.app-features-grid').compareDocumentPosition(el.querySelector('.app-download-btns')) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      });
      expect(gap.buttonsAfterContent).toBeGreaterThanOrEqual(0);
      expect(gap.buttonsAfterContent).toBeLessThanOrEqual(30);
      expect(gap.inTextColumn).toBe(true);
      expect(gap.order).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Santa Text, Santa Voicemail and Santa Messages show complete optimised owner artwork at desktop and phone widths', async ({ page }) => {
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.getByRole('button', { name: 'Minimise radio player', exact: true }).click();
  for (const [id, filename, intrinsicWidth, intrinsicHeight] of [
    ['santatext', 'santa-text', 851, 1849],
    ['santavoicemail', 'santa-voicemail', 851, 1849],
    ['santamessages', 'santa-messages', 941, 1672],
  ]) {
    const section = page.locator(`#${id}`);
    const image = section.locator('img');
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*${filename}-promo.*\\.webp`));
    await expect(image).toHaveAttribute('width', String(intrinsicWidth));
    await expect(image).toHaveAttribute('height', String(intrinsicHeight));
    await expect(image).toHaveAttribute('alt', /promotional artwork/);
    if (id === 'santamessages') {
      await expect(image).toHaveAttribute('alt', /Santa beside a phone showing Arabella.*Pick a name, Hear Santa and Schedule a message/);
      await expect(section.locator('.app-section-sub')).toHaveText('Santa has a personal message just for your child.');
      await expect(section.locator('.feature-label')).toHaveText([
        "Find your child's name", 'Share your message', 'Over 600 names',
        'Download price', 'Schedule a message', 'Santa Radio',
      ]);
      await expect(section.getByRole('button')).toHaveCount(0);
    }
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(500000);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await image.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect.poll(() => image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([intrinsicWidth, intrinsicHeight]);
      const bounds = await image.boundingBox();
      expect(bounds.width / bounds.height).toBeCloseTo(intrinsicWidth / intrinsicHeight, 3);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await image.evaluate(el => getComputedStyle(el).objectFit)).toBe('contain');
      const frame = await section.locator('.app-phone-wrap').boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(frame.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame.y + frame.height);
      // Intrinsic attributes reserve the same full portrait size before decoding.
      const reservedHeight = bounds.width * intrinsicHeight / intrinsicWidth;
      expect(bounds.height).toBeCloseTo(reservedHeight, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (id === 'santamessages') {
        const dock = await page.locator('.radio-dock').boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(85);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
        await image.screenshot({ path: `generated-artifacts/apps-santamessages-${width}.jpg` });
      }
    }
    await image.screenshot({ path: `generated-artifacts/apps-${id}-new-artwork.jpg` });
  }
  await expect(page.locator('.app-store-notice')).toHaveCount(0);
});

test('featured app titles and footer attribution use the Santa Radio script style', async ({ page }) => {
  await page.goto('/apps');
  await page.evaluate(() => document.fonts.ready);
  for (const title of ['Santa Messages', 'Christmas Radio', 'Santa Text']) {
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(heading).toBeVisible();
    const style = await heading.evaluate(element => getComputedStyle(element));
    expect(style.fontFamily).toContain('Dancing Script');
    expect(style.fontWeight).toBe('700');
    expect(style.color).toBe('rgb(230, 206, 134)');
  }
  const attribution = page.locator('.footer-attribution');
  const footerStyle = await attribution.evaluate(element => getComputedStyle(element));
  expect(footerStyle.fontFamily).toContain('Dancing Script');
  expect(footerStyle.fontWeight).toBe('700');
});

test('Mac app listing shows complete promotional artwork and Coming soon without a store link', async ({ page }) => {
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  await page.getByRole('button', { name: 'Minimise radio player', exact: true }).click();
  await expect(page.locator('.radio-dock')).toHaveClass(/is-minimized/);
  const section = page.getByRole('region', { name: 'Santa Radio for Mac' });
  await expect(section).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Santa Radio for Mac', exact: true })).toBeVisible();
  await expect(section.getByRole('status')).toHaveText('Coming soon');
  await expect(section).toContainText('Play Santa Radio and see the current song and artist.');
  await expect(section.getByRole('link')).toHaveCount(0);
  await expect(section.getByRole('button')).toHaveCount(0);

  const image = section.getByRole('img', {
    name: 'Santa Radio for Mac promotional artwork: Festive music for your desktop, with a laptop in a Christmas scene and icons for live Christmas music, snow effect, Xmas lights and playback controls.',
  });
  await expect(image).toHaveAttribute('width', '941');
  await expect(image).toHaveAttribute('height', '1672');
  await expect(section.locator('figcaption')).toHaveText('Santa Radio for Mac promotional artwork');
  const imageUrl = await image.getAttribute('src');
  expect(imageUrl).toMatch(/^\/.*santa-radio-mac.*\.webp/);
  const response = await page.request.get(imageUrl);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/image\/webp/);
  expect((await response.body()).length).toBeLessThan(250000);

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await image.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect.poll(() => image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([941, 1672]);
    const bounds = await image.boundingBox();
    expect(bounds.width).toBeGreaterThan(200);
    expect(bounds.width / bounds.height).toBeCloseTo(941 / 1672, 3);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    const figure = await section.locator('figure').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(figure.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(figure.y + figure.height);
    const dock = await page.locator('.radio-dock').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(85);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(dock.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.screenshot({ path: `generated-artifacts/apps-mac-${width}.jpg` });
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
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
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
