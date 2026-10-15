import { test, expect } from '@playwright/test';

const labels = ['A festive rooftop adventure', 'Leap across rooftops', 'Join Santa and collect mince pies'];
const button = (carousel, index) => carousel.getByRole('button', { name: `Show ${labels[index]} promotional artwork`, exact: true });

async function open(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Reject optional cookies', exact: true }).click();
  const minimise = page.getByRole('button', { name: 'Minimise radio player', exact: true });
  if (await minimise.isVisible()) await minimise.click();
  const carousel = page.getByRole('region', { name: 'Santa Dash promotional artwork', exact: true });
  for (let index = 0; index < 3; index++) await expect(button(carousel, index)).toBeEnabled();
  await page.mouse.move(0, 0);
  return carousel;
}

async function expectSlide(carousel, index) {
  await expect(button(carousel, index)).toHaveAttribute('aria-pressed', 'true');
  await expect(carousel.locator('.is-active')).toHaveCount(1);
  await expect(carousel.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await expect(carousel.locator('.app-screenshots-caption')).toHaveText(`${labels[index]} · ${index + 1} of 3`);
}

test('Santa Dash serves three full-size ordered local promotions and preserves its listing', async ({ page }) => {
  const carousel = await open(page);
  await expectSlide(carousel, 0);
  await expect(carousel.locator('figcaption')).toHaveText('Santa Dash promotional artwork');
  await expect(carousel.getByRole('group', { name: 'Choose Santa Dash promotional artwork' })).toBeVisible();
  await expect(carousel.locator('.app-screenshots-note')).toHaveCount(0);
  await expect(carousel).not.toContainText('iOS screenshots only');
  await expect(carousel.locator('img')).toHaveCount(3);
  await expect(carousel.getByRole('button')).toHaveCount(4);
  for (let index = 0; index < 3; index++) {
    const image = carousel.locator('img').nth(index);
    const frame = await image.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { ratio: rect.width / rect.height, fit: style.objectFit, x: rect.x, right: rect.right };
    });
    expect(frame.ratio).toBeCloseTo(1672 / 941, 3);
    expect(frame.fit).toBe('contain');
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    const src = await image.getAttribute('src');
    expect(src).toMatch(new RegExp(`^/.*santa-dash-promo-${index + 1}.*\\.webp`));
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1672, 941]);
    await expect(image).toHaveAttribute('width', '1672');
    await expect(image).toHaveAttribute('height', '941');
    await expect(image).toHaveAttribute('alt', /^Santa Dash promotional artwork:/);
    const response = await page.request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image\/webp/);
    expect((await response.body()).length).toBeLessThan(400000);
  }
  const section = page.locator('#santadash');
  await expect(section.locator('.app-section-title')).toHaveText('Santa Dash');
  await expect(section.locator('.app-section-sub')).toHaveText('How far can you go while collecting mince pies?');
  await expect(section.getByRole('link')).toHaveCount(1);
  await expect(section.getByRole('link')).toHaveAttribute('href', 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397');
  await expect(section.locator('.feature-label')).toHaveText(['Fun Game', 'How far can you go?', 'Collect the pies', 'Links to other apps', 'Play with friends', 'Download price']);
  await expect(section.locator('.feature-desc')).toHaveText([
    'A festive jumping game.\nGreat for all ages over Christmas.',
    'See how far you can get,\nthen post your score on Twitter.',
    'Jump over the buildings\nand collect the mince pies. Easy?',
    'It also links out to our other apps.\nHave you got them all yet?',
    'Login to Game Centre and play with friends.\nWhy not send a challenge to others?',
    'Check the linked App Store\nfor current pricing.',
  ]);
  await expect(page.locator('.app-store-notice')).toHaveCount(0);
});

test('Santa Dash holds each artwork for five seconds, fades and wraps without coupling other slideshows', async ({ page }) => {
  const carousel = await open(page);
  await carousel.hover();
  await page.mouse.move(0, 0);
  expect(await carousel.locator('.is-active').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.65s');
  await page.clock.fastForward(4999);
  await expectSlide(carousel, 0);
  await page.clock.fastForward(1);
  await expectSlide(carousel, 1);
  for (const index of [2, 0]) {
    await page.clock.fastForward(5000);
    await expectSlide(carousel, index);
  }
  await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  const others = [
    'Santa Radio current iOS app screenshots',
    'Santa Radio Apple Watch promotional images',
    'Christmas Radio promotional images',
  ].map(name => page.getByRole('region', { name, exact: true }));
  for (const other of others) {
    for (const control of await other.locator('.app-screenshots-dot').all()) await expect(control).toBeEnabled();
    await other.hover();
    await page.mouse.move(0, 0);
  }
  const beforeFrame = await carousel.boundingBox();
  const before = await Promise.all(others.map(other => other.locator('.app-screenshots-caption').textContent()));
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 0);
  expect(await carousel.boundingBox()).toEqual(beforeFrame);
  for (const [index, other] of others.entries()) {
    await expect(other.locator('.app-screenshots-caption')).not.toHaveText(before[index]);
  }
});

test('Santa Dash supports keyboard selection, pause/resume, focus, hover and hidden-tab suspension', async ({ page }) => {
  const carousel = await open(page);
  await button(carousel, 0).focus();
  await page.keyboard.press('Tab');
  await expect(button(carousel, 1)).toBeFocused();
  expect(await button(carousel, 1).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expectSlide(carousel, 1);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await carousel.getByRole('button', { name: 'Pause slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await carousel.getByRole('button', { name: 'Resume slideshow' }).click();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.locator('h1').click();
  await carousel.hover();
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(10000);
  await expectSlide(carousel, 1);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 2);
});

test('Santa Dash reduced motion is static with stable uncropped landscape artwork above feature cards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const carousel = await open(page);
  await expect(carousel.getByRole('button', { name: 'Resume slideshow' })).toBeVisible();
  await page.clock.fastForward(20000);
  await expectSlide(carousel, 0);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const before = await carousel.boundingBox();
    expect(before.width).toBeCloseTo(Math.min(760, width - (width >= 768 ? 48 : 36)), 1);
    for (let index = 0; index < 3; index++) {
      await button(carousel, index).click();
      await expectSlide(carousel, index);
      const after = await carousel.boundingBox();
      expect(after.width).toBeCloseTo(before.width, 1);
      expect(after.height).toBeCloseTo(before.height, 1);
      const image = await carousel.locator('.is-active').evaluate(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration, x: rect.x, right: rect.right };
      });
      expect(image.ratio).toBeCloseTo(1672 / 941, 3);
      expect(image.fit).toBe('contain');
      expect(image.transition).toBe('0s');
      expect(image.x).toBeGreaterThanOrEqual(0);
      expect(image.right).toBeLessThanOrEqual(width);
      const cards = await page.locator('#santadash .app-features-grid').boundingBox();
      expect(cards.y).toBeGreaterThanOrEqual(after.y + after.height + 27);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await carousel.screenshot({ path: `generated-artifacts/apps-santa-dash-${width}.jpg` });
  }
  // Reduced-motion visitors can explicitly opt in; focus and hover still suspend it.
  await carousel.getByRole('button', { name: 'Resume slideshow' }).click();
  await page.locator('h1').click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expectSlide(carousel, 0);
});
