import { test, expect } from './fixtures/apps-test.js';

const labels = ['Home', 'Santa call', 'Home', 'Workshop call', 'Home', 'Naughty List call', 'Home', 'Soundboard'];

async function openPhone(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const phone = page.locator('#santavoicemail .app-screenshots');
  await expect.poll(() => phone.locator('img').evaluateAll(images =>
    images.every(image => image.complete && image.naturalWidth === 1206))).toBe(true);
  await phone.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.mouse.move(0, 0);
  return phone;
}

async function expectScreen(phone, index) {
  await expect(phone.locator('img.is-active')).toHaveCount(1);
  await expect(phone.locator('img').nth(index)).toHaveAttribute('aria-hidden', 'false');
  await expect(phone.locator('.app-voicemail-controls > span')).toHaveText(`${labels[index]} · ${index + 1} of 8`);
}

test('Voicemail alternates Home with all four views, loops and supports pause, focus, hover and visibility safeguards', async ({ page }) => {
  const phone = await openPhone(page);
  await expect(phone).toHaveAttribute('aria-label', 'Santa Voicemail Home, calls and Soundboard previews');
  await expect(phone.locator('img')).toHaveCount(8);
  await expectScreen(phone, 0);
  await page.clock.fastForward(4999);
  await expectScreen(phone, 0);
  await page.clock.fastForward(1);
  await expectScreen(phone, 1);
  for (const index of [2, 3, 4, 5, 6, 7, 0, 1]) {
    await page.clock.fastForward(5000);
    await expectScreen(phone, index);
  }
  const pause = phone.getByRole('button', { name: 'Pause automatic screen previews' });
  await pause.click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.fastForward(15000);
  await expectScreen(phone, 1);
  const resume = phone.getByRole('button', { name: 'Resume automatic screen previews' });
  await resume.focus();
  await page.keyboard.press('Enter');
  await page.clock.fastForward(10000); // focus continues to suspend rotation
  await expectScreen(phone, 1);
  await page.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expectScreen(phone, 2);
  await phone.hover();
  await page.clock.fastForward(10000);
  await expectScreen(phone, 2);
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(10000);
  await expectScreen(phone, 2);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectScreen(phone, 3);
  await expect(phone.locator('img.is-active')).toHaveCSS('transition-duration', '0.65s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(phone.getByRole('button')).toHaveCount(0);
  await page.clock.fastForward(15000);
  await expectScreen(phone, 3);
});

test('Voicemail captures are complete, local, responsive and static with reduced motion; copy and links remain unchanged', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const phone = await openPhone(page);
  await page.clock.fastForward(15000);
  await expectScreen(phone, 0);
  await expect(phone.getByRole('button')).toHaveCount(0);
  const sources = new Set();
  for (const [index, image] of (await phone.locator('img').all()).entries()) {
    await expect(image).toHaveAttribute('alt', new RegExp(`Santa Voicemail app ${labels[index]} screen`));
    await expect(image).toHaveAttribute('width', '1206');
    await expect(image).toHaveAttribute('height', '2622');
    await expect(image).toHaveCSS('transition-duration', '0s');
    const src = await image.getAttribute('src');
    expect(src).toMatch(/^\/.*santa-voicemail-.*\.webp/);
    sources.add(src);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/webp');
    expect((await response.body()).length).toBeLessThan(500000);
  }
  expect(sources.size).toBe(5);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await phone.evaluate(el => {
      const frame = el.querySelector('.app-screenshots-frame').getBoundingClientRect();
      const stack = el.querySelector('.app-screenshots-stack');
      const image = el.querySelector('img');
      const bounds = image.getBoundingClientRect();
      return {
        ratio: bounds.width / bounds.height, fit: getComputedStyle(image).objectFit,
        radius: getComputedStyle(stack).borderRadius,
        contained: bounds.left >= frame.left && bounds.right <= frame.right &&
          bounds.top >= frame.top && bounds.bottom <= frame.bottom,
        fits: frame.left >= 0 && frame.right <= innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(geometry).toMatchObject({ fit: 'contain', radius: '0px', contained: true, fits: true, overflow: false });
    expect(geometry.ratio).toBeCloseTo(1206 / 2622, 3);
    if (width === 1440 || width === 390) {
      await phone.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await phone.screenshot({ path: `generated-artifacts/voicemail-phone-${width}.jpg` });
    }
  }
  const section = page.locator('#santavoicemail');
  await expect(section.locator('.app-section-sub')).toHaveText('Leave Santa a voicemail message.');
  await expect(section.locator('.feature-label')).toHaveText([
    'Leave a message', 'Playback', 'Santa Soundboard', 'Send a message', 'Download price', 'Santa Radio',
  ]);
  for (const link of await section.locator('.app-dl-btn').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  expect(await section.locator('.app-dl-btn').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual([
    'https://itunes.apple.com/us/app/santa-voicemail/id586387813',
  ]);
});

test('Voicemail recovers failed WebP delivery with pixel-matched PNGs', async ({ page }) => {
  await page.route('**/santa-voicemail-*.webp', route =>
    route.request().resourceType() === 'image' ? route.abort() : route.continue());
  const phone = await openPhone(page);
  for (const image of await phone.locator('img').all()) {
    await expect(image).toHaveAttribute('src', /\.png/);
  }
  await page.clock.fastForward(5000);
  await expectScreen(phone, 1);
  await expect(phone.locator('.app-screenshots-note')).toHaveCount(0);
});
