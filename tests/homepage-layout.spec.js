import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // No live radio streams or external signups are needed for these UI checks.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === new URL(test.info().project.use.baseURL).hostname
      ? route.continue() : route.abort();
  });
  await context.route('**/api/radio-metadata', route => route.fulfill({
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
  await expect(page.locator('.hero + .tracker-banner')).toHaveCount(1);
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
  await expect(contact.getByRole('link', { name: 'Send Email' })).toHaveAttribute('href', 'mailto:santa@santaradio.co.uk?subject=Enquiry%20from%20Santa%20Radio');
  await expect(page.locator('.santa-note')).toHaveCount(1);
  await expect(hero.getByRole('link', { name: 'FREE Santa Message', exact: true })).toHaveAttribute('href', '/free-santa-message');
  const before = await hero.locator('.countdown-unit').last().textContent();
  await expect.poll(() => hero.locator('.countdown-unit').last().textContent()).not.toBe(before);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const countdown = await hero.locator('.countdown').boundingBox();
    expect(countdown.x).toBeGreaterThanOrEqual(0);
    expect(countdown.x + countdown.width).toBeLessThanOrEqual(width);
    const note = await contact.locator('.santa-note-text').boundingBox();
    const email = await contact.getByRole('link', { name: 'Send Email' }).boundingBox();
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
