import { test, expect } from '@playwright/test';

test('homepage tracker enlarges the full-world map on desktop and stacks within smaller viewports', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00Z'));
  await page.addInitScript(() => sessionStorage.setItem('radio-minimized', 'true'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const banner = page.locator('.home-page > .tracker-banner');
  const map = banner.locator('.tracker-map');
  await expect(map).toBeVisible();
  await expect(banner).not.toContainText('Countdown to Christmas Eve');
  await expect(banner.locator('.tracker-countdown-value')).toHaveCount(0);
  await expect(page.locator('.hero-countdown .countdown-unit')).toHaveCount(4);
  for (const width of [1440, 1280, 1024, 820, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const mapBox = await map.boundingBox();
    const svg = map.locator('svg');
    const svgBox = await svg.boundingBox();
    const copyBox = await banner.locator('.tracker-banner-copy').boundingBox();
    expect(mapBox.width).toBeGreaterThanOrEqual(Math.min(400, width - 32));
    expect(mapBox.width).toBeLessThanOrEqual(560);
    expect(mapBox.x).toBeGreaterThanOrEqual(0);
    expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(width);
    expect(svgBox.width / svgBox.height).toBeCloseTo(2, 2);
    await expect(svg).toHaveAttribute('viewBox', '0 0 1000 500');
    await expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    await expect(svg.locator('text')).toHaveText('🎅');
    await expect(map.locator('.tracker-map-caption')).toBeVisible();
    await expect(map).toHaveCSS('border-top-width', '1px');
    if (width >= 1024) {
      expect(mapBox.width).toBeGreaterThanOrEqual(width >= 1280 ? 550 : 470);
      expect(copyBox.width).toBeGreaterThanOrEqual(400);
      expect(copyBox.x + copyBox.width + 31).toBeLessThanOrEqual(mapBox.x);
      expect(mapBox.y).toBeLessThan(copyBox.y + copyBox.height);
    } else {
      expect(mapBox.y).toBeGreaterThanOrEqual(copyBox.y + copyBox.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280 || width === 390) {
      await banner.evaluate(node => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top - 100, behavior: 'instant' }));
      await banner.screenshot({ path: testInfo.outputPath(`homepage-tracker-${width}.png`), animations: 'disabled' });
    }
  }
});

test('homepage keeps its desktop and mobile section order without the paused video promotion', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const desktop = ['hero', 'santa-message-section', 'tracker-banner', 'santa-dash-promo', 'soundboard', 'mugshots-preview', 'christmas-pairs', 'youtube-section', 'partnership-strip', 'contact-section'];
  const mobile = ['hero', 'santa-message-section', 'tracker-banner', 'santa-dash-promo', 'soundboard', 'christmas-pairs', 'youtube-section', 'mugshots-preview', 'partnership-strip', 'contact-section'];
  for (const width of [1280, 768, 767, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const order = await page.locator('.home-page > section').evaluateAll(sections =>
      sections.map(section => ({ name: section.classList[0], top: section.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top).map(section => section.name));
    expect(order).toEqual(width >= 768 ? desktop : mobile);
    await expect(page.locator('.home-page > .partnership-strip')).toHaveCount(1);
    await expect(page.locator('.home-page > .partnership-strip + .contact-section')).toHaveCount(1);
    await expect(page.locator('.home-page > .santa-dash-promo')).toHaveCount(1);
    await expect(page.locator('.home-page > .soundboard')).toHaveCount(1);
    await expect(page.locator('.tracker-banner + .santa-dash-promo + .soundboard')).toHaveCount(1);
    const bounds = await page.locator('.home-page > .tracker-banner, .home-page > .santa-dash-promo, .home-page > .soundboard')
      .evaluateAll(sections => sections.map(section => {
        const rect = section.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      }));
    expect(bounds[1].top).toBeCloseTo(bounds[0].bottom, 0);
    expect(bounds[2].top).toBeCloseTo(bounds[1].bottom, 0);
    expect(await page.locator('.home-page > section').evaluateAll(sections =>
      sections.slice(0, 4).map(section => section.classList[0]))).toEqual(['hero', 'santa-message-section', 'tracker-banner', 'santa-dash-promo']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('personalised video promotion is temporarily absent while free audio messages remain', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Personalised Santa Video', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore Santa Videos', exact: true })).toHaveCount(0);
  await expect(page.locator('.santa-video-section')).toHaveCount(0);
  await expect(page.locator('.santa-message-section')).toHaveCount(1);
});

test.beforeEach(async ({ context }) => {
  // No live radio streams or external signups are needed for these UI checks.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(test.info().project.use.baseURL).hostname
      ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
});

test('mobile player starts minimised, can expand, and starts minimised again after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('radio-minimized', 'false'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).toHaveClass(/is-minimized/);
  await expect(dock.getByRole('button', { name: 'Listen Live', exact: true })).toBeVisible();
  await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await expect(dock).not.toHaveClass(/is-minimized/);
  await expect(dock.getByRole('slider', { name: 'Radio volume' })).toBeVisible();
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await expect(dock).toHaveClass(/is-minimized/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(dock).toHaveClass(/is-minimized/);
});

test('mobile player starts minimised when preference storage is unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('complementary', { name: 'Santa Radio player' })).toHaveClass(/is-minimized/);
});

test('desktop player keeps its existing expanded default and remembers minimising', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock).not.toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(dock).toHaveClass(/is-minimized/);
});

test('homepage keeps the countdown in the hero and plain Santa text in Contact Santa Radio', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('.hero');
  await expect(page.locator('.welcome-section')).toHaveCount(0);
  await expect(page.locator('.hero + .santa-message-section + .tracker-banner')).toHaveCount(1);
  await expect(page.locator('.radio-listening-section, .santa-note-section, .hero-scroll')).toHaveCount(0);
  await expect(page.locator('.soundboard')).toHaveCount(1);
  await expect(hero.getByRole('heading', { name: 'Christmas is on its way' })).toHaveCount(0);
  await expect(hero.getByText('The most wonderful day', { exact: true })).toHaveCount(0);
  await expect(hero.getByText('Closer to the magic, every day.', { exact: true })).toHaveCount(0);
  await expect(hero.locator('.hero-countdown')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(hero.locator('.hero-countdown')).toHaveCSS('border-top-width', '0px');
  await expect(hero.locator('.countdown-unit')).toHaveCount(4);
  const contact = page.locator('.contact-section');
  await expect(hero.locator('.santa-note, .hero-santa-note')).toHaveCount(0);
  await expect(contact.locator('.santa-note')).toBeVisible();
  await expect(contact.locator('.santa-note-text')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(contact.locator('.santa-note-text')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.santa-note-sender, .santa-note-caption')).toHaveCount(0);
  await expect(page.getByText('Sent with Elfie', { exact: true })).toHaveCount(0);
  await expect(contact.getByRole('heading', { name: 'Contact Santa Radio' })).toBeVisible();
  await expect(contact).toContainText('For press and corporate enquiries, feedback or suggestions, please get in touch.');
  await expect(contact).toContainText('You can also choose Song submission on our contact form');
  await expect(contact.getByRole('link', { name: 'Get in touch', exact: true })).toHaveAttribute('href', '/submit-a-song');
  await expect(page.locator('.footer-links').getByRole('link', { name: 'Submit your song', exact: true })).toHaveAttribute('href', '/submit-a-song?mode=song');
  await expect(page.locator('.santa-note')).toHaveCount(1);
  await expect(hero.getByRole('link', { name: 'FREE Santa Message', exact: true })).toHaveAttribute('href', '#santa-messages');
  const before = await hero.locator('.countdown-unit').last().textContent();
  await expect.poll(() => hero.locator('.countdown-unit').last().textContent()).not.toBe(before);
  for (const width of [1280, 768, 767, 430, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const countdown = await hero.locator('.countdown').boundingBox();
    expect(countdown.x).toBeGreaterThanOrEqual(0);
    expect(countdown.x + countdown.width).toBeLessThanOrEqual(width);
    expect(countdown.width).toBeLessThanOrEqual(401);
    expect(countdown.height).toBeLessThanOrEqual(75);
    const numberSize = await hero.locator('.countdown-unit strong').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(numberSize).toBeLessThanOrEqual(24);
    if (width < 768) {
      expect(countdown.width).toBeLessThanOrEqual(281);
      expect(countdown.height).toBeLessThanOrEqual(57);
      expect(numberSize).toBeLessThanOrEqual(18);
    } else {
      expect(countdown.width).toBeCloseTo(400, 0);
      await expect(hero.locator('.countdown-unit').first()).toHaveCSS('padding-top', '9px');
    }
    const unitBounds = await hero.locator('.countdown-unit').evaluateAll(units => units.map(unit => {
      const box = unit.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(unit.querySelector('span'));
      const label = range.getBoundingClientRect();
      return { top: box.top, fits: label.left >= box.left - 0.5 && label.right <= box.right + 0.5 };
    }));
    expect(unitBounds.every(unit => unit.top === unitBounds[0].top && unit.fits)).toBe(true);
    const tagline = await hero.locator('.hero-note').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = range.getBoundingClientRect();
      return { lines: range.getClientRects().length, left: bounds.left, right: bounds.right };
    });
    expect(tagline.lines).toBe(1);
    expect(tagline.left).toBeGreaterThanOrEqual(-0.5);
    expect(tagline.right).toBeLessThanOrEqual(width + 0.5);
    const note = await contact.locator('.santa-note-text').boundingBox();
    const email = await contact.getByRole('link', { name: 'Get in touch', exact: true }).boundingBox();
    expect(note.y).toBeGreaterThanOrEqual(email.y + email.height);
    expect(note.x).toBeGreaterThanOrEqual(0);
    expect(note.x + note.width).toBeLessThanOrEqual(width);
  }
});

test('compact player opens from its information area or blank padding, not its play/pause button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.mediaCalls = [];
    window.savedAudio = document.querySelector('audio');
    for (const method of ['play', 'pause', 'load']) {
      window.savedAudio[method] = () => { window.mediaCalls.push(method); return Promise.resolve(); };
    }
  });
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  await expect(dock.getByRole('button', { name: 'Show radio details' })).toHaveAccessibleDescription('Christmas music, all year');
  await dock.getByRole('button', { name: 'Show radio details' }).click();
  await expect(dock).not.toHaveClass(/is-minimized/);
  expect(await page.evaluate(() => window.mediaCalls)).toEqual([]);
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await dock.click({ position: { x: 5, y: 5 } });
  await expect(dock).not.toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await dock.getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  await expect(dock).toHaveClass(/is-minimized/);
  await dock.getByRole('button', { name: 'Pause Radio', exact: true }).click();
  await expect(dock).toHaveClass(/is-minimized/);
  const calls = await page.evaluate(() => window.mediaCalls);
  await dock.getByRole('button', { name: 'Show radio details' }).focus();
  await page.keyboard.press('Enter');
  await expect(dock).not.toHaveClass(/is-minimized/);
  await expect(dock.getByRole('button', { name: 'Minimise radio player' })).toBeFocused();
  expect(await page.evaluate(() => window.mediaCalls)).toEqual(calls);
  expect(await page.evaluate(() => window.savedAudio === document.querySelector('audio'))).toBe(true);
});
