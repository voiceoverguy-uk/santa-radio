import { test, expect } from './fixtures/apps-test.js';

async function open(page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const phone = page.getByRole('region', { name: 'Santa Dash app screen', exact: true });
  await expect.poll(() => phone.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await phone.locator('img').evaluate(el => el.decode());
  await page.mouse.move(0, 0);
  return phone;
}

test('Santa Dash uses the approved full gameplay original inside a landscape phone and preserves its listing', async ({ page }) => {
  const phone = await open(page);
  await expect(phone).toHaveClass(/app-screenshots-device.*app-screenshots-landscape.*app-screenshots-classic/);
  await expect(phone.locator('img')).toHaveCount(1);
  await expect(phone).not.toHaveAttribute('aria-roledescription', 'carousel');
  await expect(phone.locator('figcaption')).toHaveText('Santa Dash app screen');
  await expect(phone.locator('.app-screenshots-note')).toHaveCount(0);
  const image = phone.locator('img');
  expect(await image.getAttribute('src')).toMatch(/^\/.*santa-dash-screen.*\.webp/);
  expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([1334, 750]);
  await expect(image).toHaveAttribute('width', '1334');
  await expect(image).toHaveAttribute('height', '750');
  await expect(image).toHaveAttribute('alt', /^Santa Dash gameplay screen/);
  const response = await page.request.get(await image.getAttribute('src'));
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/image\/webp/);
  expect((await response.body()).length).toBeLessThan(400000);
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
});

test('a single approved gameplay capture stays static without affecting the real slideshows', async ({ page }) => {
  const phone = await open(page);
  const radios = [
    page.getByRole('region', { name: 'Santa Radio current iOS app screenshots', exact: true }),
    page.getByRole('region', { name: 'Christmas Radio promotional images', exact: true }),
  ];
  for (const radio of radios) {
    await expect.poll(() => radio.locator('img').evaluateAll(images => images.every(el => el.complete && el.naturalWidth > 0))).toBe(true);
    await radio.hover();
  }
  await phone.hover();
  const sources = await Promise.all(radios.map(radio => radio.locator('.is-active').getAttribute('src')));
  await page.clock.fastForward(5000);
  for (const [index, radio] of radios.entries())
    await expect(radio.locator('.is-active')).not.toHaveAttribute('src', sources[index]);
  await expect(phone.locator('.is-active')).toHaveAttribute('aria-hidden', 'false');
  await page.clock.fastForward(30000);
  await expect(phone.locator('.is-active')).toHaveCount(1);
  await expect(phone.getByRole('button')).toHaveCount(0);
});

test('gameplay failures are reported without silently loading a poster or older substitute', async ({ page }) => {
  await page.route('**/santa-dash-screen*', route => route.request().resourceType() === 'image' ? route.abort() : route.continue());
  await page.goto('/apps');
  const phone = page.getByRole('region', { name: 'Santa Dash app screen', exact: true });
  await expect(phone.getByRole('status')).toHaveText('Some screenshots could not load. Please reload to try again.');
  await expect(phone.locator('img')).toHaveCount(1);
});

test('reduced motion preserves the complete landscape display beside or above the unchanged feature cards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const phone = await open(page);
  await page.clock.fastForward(20000);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const frame = await phone.boundingBox();
    expect(frame.width).toBeGreaterThan(width >= 768 ? 300 : 250);
    const image = await phone.locator('img').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { ratio: rect.width / rect.height, fit: style.objectFit, transition: style.transitionDuration, x: rect.x, right: rect.right, width: rect.width };
    });
    expect(image.ratio).toBeCloseTo(1334 / 750, 3);
    expect(image.fit).toBe('contain');
    expect(image.transition).toBe('0s');
    expect(image.x).toBeGreaterThan(frame.x);
    expect(image.right).toBeLessThan(frame.x + frame.width);
    expect(image.width / frame.width).toBeCloseTo(.769, 2); // Physical speaker/Home-button bezels.
    const copy = await page.locator('#santadash .app-copy').boundingBox();
    if (width >= 768) expect(copy.x).toBeGreaterThanOrEqual(frame.x + frame.width + 20);
    else expect(copy.y).toBeGreaterThanOrEqual(frame.y + frame.height + 20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await phone.screenshot({
      path: `generated-artifacts/apps-santa-dash-${width}.jpg`,
      style: '.radio-dock, .navbar { visibility: hidden !important; }',
    });
  }
});
