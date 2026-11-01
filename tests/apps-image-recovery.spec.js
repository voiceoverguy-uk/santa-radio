import { test, expect } from './fixtures/apps-test.js';

const sections = ['christmasradio', 'santatext', 'santadash'];
const images = '#christmasradio img, #santatext img, #santadash img';

async function verify(page, extension) {
  await expect(page.locator(images)).toHaveCount(6);
  for (const image of await page.locator(images).all()) {
    await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    if (extension) await expect(image).toHaveAttribute('src', new RegExp(`\\.${extension}$`));
    const src = await image.getAttribute('src');
    const response = await page.request.get(src);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/image\/(webp|png)/);
    // Decode the response body too: a 200 HTML shell or corrupt image must fail.
    const bytes = (await response.body()).toString('base64');
    const bodySize = await page.evaluate(async ({ bytes, type }) => {
      const image = new Image();
      image.src = `data:${type};base64,${bytes}`;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, { bytes, type: response.headers()['content-type'] });
    const painted = await image.evaluate(async el => {
      await el.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const context = canvas.getContext('2d');
      context.drawImage(el, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      return {
        dimensions: [el.naturalWidth, el.naturalHeight],
        colours: new Set(Array.from({ length: 1024 }, (_, i) =>
          `${pixels[i * 4]},${pixels[i * 4 + 1]},${pixels[i * 4 + 2]}`
        )).size,
      };
    });
    expect(bodySize).toEqual(painted.dimensions);
    if (src.includes('santa-dash-screen')) {
      expect(bodySize).toEqual([1488, 676]);
      await expect(image).toHaveAttribute('alt', /Back to the Grotto promotional artwork.*caption: Leap rooftops/);
    }
    expect(painted.colours).toBeGreaterThan(100);
  }
  for (const id of sections) {
    const section = page.locator(`#${id}`);
    await expect(section.locator('[role="status"]')).toHaveCount(0);
    const active = section.locator('img.is-active');
    await active.scrollIntoViewIfNeeded();
    await expect(active).toBeVisible();
    const bounds = await active.evaluate(el => {
      const a = el.getBoundingClientRect();
      const b = el.closest('.app-screenshots-stack').getBoundingClientRect();
      return { fits: a.left >= b.left - .5 && a.right <= b.right + .5 &&
        a.top >= b.top - .5 && a.bottom <= b.bottom + .5, opacity: getComputedStyle(el).opacity };
    });
    expect(bounds.fits).toBe(true);
    await expect(active).toHaveCSS('opacity', '1');
  }
}

for (const width of [1280, 320]) {
  test(`all six displays decode on fresh load and client navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/apps');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    await verify(page, 'webp');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    if (width < 768) await nav.getByRole('button', { name: 'Open menu' }).click();
    await nav.getByRole('link', { name: 'Music', exact: true }).click();
    await expect(page).toHaveURL(/\/christmas-music$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Christmas Song Lyrics & Artists', exact: true })).toBeVisible();
    if (width < 768) await nav.getByRole('button', { name: 'Open menu' }).click();
    await nav.getByRole('link', { name: 'Apps', exact: true }).click();
    await expect(page).toHaveURL(/\/apps$/);
    await verify(page, 'webp');
  });
}

for (const failure of ['delivery', 'decode']) {
  test(`all six displays recover from WebP ${failure} failure without changing their pixels`, async ({ page }) => {
    if (failure === 'delivery') {
      await page.route(/(?:christmas-radio-screen-[1-4]|santa-(?:text|dash)-screen).*\.webp$/, route => route.abort());
    } else {
      await page.addInitScript(() => {
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function () {
          if (/(?:christmas-radio-screen-[1-4]|santa-(?:text|dash)-screen).*\.webp$/.test(this.src))
            return Promise.reject(new DOMException('Simulated unsupported image', 'EncodingError'));
          return decode.call(this);
        };
      });
    }
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto('/apps');
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    await verify(page, 'png');
    const carousel = page.locator('#christmasradio');
    await carousel.hover();
    await page.mouse.move(0, 0);
    for (const index of [1, 2, 3, 0]) {
      await page.clock.fastForward(5000);
      await expect(carousel.locator('img').nth(index)).toHaveClass(/is-active/);
    }
    // Check the reduced-motion startup separately, as in the existing carousel
    // suite; do not race a native media-change event against a paused JS clock.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await verify(page, 'png');
    await page.clock.fastForward(20000);
    await expect(carousel.locator('img').first()).toHaveClass(/is-active/);
  });
}

test('a failed PNG fallback is reported once and never rotated into view', async ({ page }) => {
  let fallbackRequests = 0;
  await page.route(/christmas-radio-screen-2.*\.(?:webp|png)$/, route => {
    if (route.request().url().endsWith('.png')) fallbackRequests++;
    return route.abort();
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/apps');
  const carousel = page.locator('#christmasradio');
  await expect(carousel.getByRole('status')).toHaveText('Some screenshots could not load. Please reload to try again.');
  await page.clock.fastForward(30000);
  await expect(carousel.locator('img').first()).toHaveClass(/is-active/);
  expect(fallbackRequests).toBe(1);
});
