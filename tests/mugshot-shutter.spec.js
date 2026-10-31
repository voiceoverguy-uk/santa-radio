import { test, expect } from '@playwright/test';

const source = '/audio/mugshots/camera.mp3';
const grids = [
  { path: '/', selector: '.mugshots-preview .mug-card' },
  { path: '/mugshots/all', selector: '.mugshot-card' },
];

async function instrument(context) {
  const requests = [];
  context.on('request', request => {
    if (new URL(request.url()).pathname === source) requests.push(request.url());
  });
  await context.addInitScript(source => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    window.shutterAttempts = 0;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (new URL(this.currentSrc || this.src, location.href).pathname !== source) {
        return original.call(this);
      }
      window.shutterAttempts++;
      // Resolve rather than relying on autoplay rejection to keep cards silent.
      return Promise.resolve();
    };
  }, source);
  return requests;
}

async function prepare(page, path) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://www.youtube.com/embed/**', route =>
    route.fulfill({ contentType: 'text/html', body: '' }));
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

async function expectSilent(page, requests) {
  // Allow any asynchronously scheduled interaction sound to attempt playback.
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.shutterAttempts)).toBe(0);
  expect(requests).toEqual([]);
}

for (const { path, selector } of grids) {
  test(`${path} hover and pointer activation stay silent and open the correct profile`, async ({ page, context }) => {
    const requests = await instrument(context);
    await prepare(page, path);
    const cards = page.locator(selector);
    for (const index of [0, 1, 2, 0]) await cards.nth(index).hover();
    await expectSilent(page, requests);
    const card = cards.first();
    const href = await card.getAttribute('href');
    const name = await card.locator('strong').textContent();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expectSilent(page, requests);
  });

  test(`${path} keyboard focus and Enter activation stay silent`, async ({ page, context }) => {
    const requests = await instrument(context);
    await prepare(page, path);
    const card = page.locator(selector).first();
    await card.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(card).toBeFocused();
    await expectSilent(page, requests);
    const href = await card.getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expectSilent(page, requests);
  });

  test(`${path} modified click stays silent and preserves new-tab navigation`, async ({ page, context }) => {
    const requests = await instrument(context);
    await prepare(page, path);
    const card = page.locator(selector).first();
    const href = await card.getAttribute('href');
    const [profile] = await Promise.all([
      context.waitForEvent('page'),
      card.click({ modifiers: ['Control'] }),
    ]);
    try {
      await expect(profile).toHaveURL(new RegExp(`${href}$`));
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/' : path}$`));
      await expectSilent(page, requests);
      await expectSilent(profile, requests);
    } finally {
      await profile.close();
    }
  });

  test(`${path} touch activation stays silent and preserves mobile navigation`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 },
    });
    try {
      const requests = await instrument(context);
      const page = await context.newPage();
      await prepare(page, path);
      const card = page.locator(selector).first();
      await card.scrollIntoViewIfNeeded();
      await expectSilent(page, requests);
      const href = await card.getAttribute('href');
      await card.tap();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expectSilent(page, requests);
    } finally {
      await context.close();
    }
  });
}

test('gallery controls and non-card links remain silent', async ({ page, context }) => {
  const requests = await instrument(context);
  await prepare(page, '/');
  await page.locator('.mugshots-gallery-button').click();
  await expect(page).toHaveURL(/mugshots\/all$/);
  await page.getByRole('button', { name: 'A–Z', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a famous face' }).fill('Jeremy Kyle');
  await page.locator('.seo-directory a[href="/mugshots/jeremy-kyle-tv-personality"]').click();
  await expect(page).toHaveURL(/mugshots\/jeremy-kyle-tv-personality$/);
  await expectSilent(page, requests);
});
