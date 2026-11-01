import { test, expect } from './fixtures/apps-test.js';

const screens = ['welcome', 'menu', 'promotion', 'chat'];

async function openText(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const phone = page.locator('#santatext .app-screenshots');
  await phone.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  // Pause/resume starts a fresh interval after all decode callbacks settle.
  await phone.hover();
  await page.mouse.move(0, 0);
  return phone;
}

async function expectScreen(phone, index) {
  await expect(phone.locator('img.is-active')).toHaveCount(1);
  await expect(phone.locator('img[aria-hidden="false"]')).toHaveCount(1);
  await expect(phone.locator('img').nth(index)).toHaveClass(/is-active/);
  await expect(phone.locator('img').nth(index)).toHaveAttribute('aria-hidden', 'false');
}

test('Santa Text uses four native screens in order with a five-second opacity dissolve and stable handset', async ({ page }) => {
  const phone = await openText(page);
  await expect(phone).toHaveAttribute('aria-roledescription', 'carousel');
  await expect(phone.locator('img')).toHaveCount(4);
  await expect(phone).not.toHaveClass(/classic|landscape/);
  await expect(phone.locator('button, .app-screenshots-controls')).toHaveCount(0);
  for (const [index, screen] of screens.entries()) {
    const image = phone.locator('img').nth(index);
    await expect(image).toHaveAttribute('src', new RegExp(`santa-text-screen-${screen}.*\\.webp`));
    await expect(image).toHaveAttribute('width', '603');
    await expect(image).toHaveAttribute('height', '1311');
    expect(await image.evaluate(el => [el.naturalWidth, el.naturalHeight])).toEqual([603, 1311]);
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expect(image).toHaveCSS('transition-property', 'opacity');
    await expect(image).toHaveCSS('transition-duration', '0.65s');
    await expect(image).toHaveCSS('transition-timing-function', 'ease');
    await expect(image).toHaveCSS('transform', 'none');
  }
  await expectScreen(phone, 0);
  const initial = await phone.boundingBox();
  for (const index of [1, 2, 3, 0]) {
    await page.clock.fastForward(4999);
    await expectScreen(phone, (index + 3) % 4);
    await page.clock.fastForward(1);
    await expectScreen(phone, index);
    const bounds = await phone.boundingBox();
    expect(bounds.width).toBeCloseTo(initial.width, 1);
    expect(bounds.height).toBeCloseTo(initial.height, 1);
  }
  await expect(page.locator('#santatext .app-section-sub')).toHaveText('Text Santa and the Father Christmas auto-bot will reply.');
  await expect(page.locator('#santatext .feature-label')).toHaveText([
    'Text Santa', 'Festive Fun', 'Automatic replies', 'Santa Radio', 'No call charges', 'Code Words',
  ]);
  await expect(page.locator('#santatext .app-dl-btn')).toHaveAttribute('href', 'https://itunes.apple.com/gb/app/santa-text/id1024535991');
});

test('Santa Text pauses on hover and hidden tabs, then resumes from the same screen', async ({ page }) => {
  const phone = await openText(page);
  await phone.hover();
  await page.clock.fastForward(15000);
  await expectScreen(phone, 0);
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expectScreen(phone, 1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(15000);
  await expectScreen(phone, 1);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(5000);
  await expectScreen(phone, 2);
});

test('Santa Text reduced motion keeps the welcome still and every complete screen proportional at desktop and narrow widths', async ({ page }) => {
  const phone = await openText(page, 'reduce');
  await page.clock.fastForward(30000);
  await expectScreen(phone, 0);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await phone.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    for (const image of await phone.locator('img').all()) {
      const geometry = await image.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        const stack = el.closest('.app-screenshots-stack').getBoundingClientRect();
        const dock = document.querySelector('.radio-dock').getBoundingClientRect();
        return {
          ratio: bounds.width / bounds.height,
          full: Math.abs(bounds.width - stack.width) < .5 && Math.abs(bounds.height - stack.height) < .5,
          visible: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 85 && bounds.bottom <= dock.top,
          transition: getComputedStyle(el).transitionDuration,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.ratio).toBeCloseTo(1206 / 2622, 3);
      expect(geometry.full).toBe(true);
      expect(geometry.visible).toBe(true);
      expect(geometry.transition).toBe('0s');
      expect(geometry.overflow).toBe(false);
    }
    // There is no synthetic camera/notch layered over these native captures.
    expect(await phone.locator('.app-screenshots-frame').evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
    await page.locator('#santatext').screenshot({
      path: `generated-artifacts/apps-santa-text-${width}.jpg`,
      animations: 'disabled',
      style: '.radio-dock, .navbar, .skip-link { visibility: hidden !important; }',
    });
  }
});

test('Santa Text waits for the next decoded screen before starting its five-second interval', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/santa-text-screen-menu*.webp', async route => {
    if (route.request().resourceType() !== 'image') return route.continue();
    await held;
    await route.continue();
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps', { waitUntil: 'domcontentloaded' });
  const phone = page.locator('#santatext .app-screenshots');
  await phone.locator('img').first().evaluate(image => image.decode());
  await page.mouse.move(0, 0);
  await page.clock.fastForward(20000);
  await expectScreen(phone, 0);
  release();
  await phone.locator('img').nth(1).evaluate(image => image.decode());
  await phone.hover();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(4999);
  await expectScreen(phone, 0);
  await page.clock.fastForward(1);
  await expectScreen(phone, 1);
});
