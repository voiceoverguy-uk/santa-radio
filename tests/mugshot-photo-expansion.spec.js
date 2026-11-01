import { test, expect } from '@playwright/test';
import raw from '../src/data/mugshots.json' with { type: 'json' };
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { spawn } from 'node:child_process';

const { catalogue } = buildCatalogue(raw);
const profiles = ['Chuckle Brothers', 'Christine Lampard'].map(name =>
  catalogue.find(profile => profile.artist === name));
const floating = page => page.locator('.mugshot-photo-floating');
const trigger = page => page.locator('.mugshot-photo-toggle');

async function visit(page, profile = profiles[0]) {
  await page.goto(`/mugshots/${profile.song}`);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await expect(trigger(page)).toBeEnabled();
}

async function settled(page) {
  await expect.poll(() => floating(page).evaluate(node =>
    node.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
}

async function fits(page) {
  await settled(page);
  const geometry = await floating(page).evaluate(node => {
    const rect = node.getBoundingClientRect();
    const image = node.querySelector('img');
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
      ratio: rect.width / rect.height, naturalRatio: image.naturalWidth / image.naturalHeight,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      topmost: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.x).toBeGreaterThanOrEqual(10);
  expect(geometry.y).toBeGreaterThanOrEqual(10);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 10);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight - 10);
  expect(geometry.ratio).toBeCloseTo(geometry.naturalRatio, 3);
  expect(geometry.topmost).toBe(true);
  expect(geometry.overflow).toBe(false);
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 740 },
  { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`full photos float without layout or scroll changes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const profile of profiles) {
      await visit(page, profile);
      await trigger(page).scrollIntoViewIfNeeded();
      const before = await page.locator('.mugshot-detail-figure').boundingBox();
      const caption = await page.locator('.mugshot-photo-credit').textContent();
      const scroll = await page.evaluate(() => scrollY);
      await trigger(page).click();
      await expect(floating(page)).toBeVisible();
      await fits(page);
      await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(floating(page).locator('img')).toHaveAttribute('src', profile.image);
      await expect(floating(page).locator('img')).not.toHaveAttribute('srcset');
      expect(await page.locator('.mugshot-detail-figure').boundingBox()).toEqual(before);
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      expect(await page.locator('.mugshot-photo-credit').textContent()).toBe(caption);
      await page.screenshot({ path: `generated-artifacts/mugshot-${viewport.width}-${profile.song}-expanded.png` });
      await floating(page).click();
      await expect(floating(page)).toHaveCount(0);
      await expect(trigger(page)).toBeFocused();
      expect(await page.locator('.mugshot-detail-figure').boundingBox()).toEqual(before);
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      await page.screenshot({ path: `generated-artifacts/mugshot-${viewport.width}-${profile.song}-collapsed.png` });
    }
  });
}

test('keyboard toggle, focus, repeated use, click-away and ordinary navigation', async ({ page }) => {
  await visit(page);
  // Real keyboard navigation activates :focus-visible.
  await page.locator('a[rel=next]').focus();
  await page.keyboard.press('Tab');
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveCSS('outline-style', 'solid');
  for (const key of ['Enter', 'Space', 'Enter']) {
    await page.keyboard.press(key);
    await expect(floating(page)).toBeFocused();
    await settled(page);
    await expect(floating(page)).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Escape');
    await expect(floating(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await settled(page);
  await page.keyboard.press('Tab');
  await expect(page.locator('.mugshot-detail-info .back-link')).toBeFocused();
  await expect(floating(page)).toHaveCount(0);
  for (const key of ['Enter', 'Space']) {
    await trigger(page).focus();
    await page.keyboard.press(key);
    await settled(page);
    await page.keyboard.press(key);
    await expect(floating(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  }
  await trigger(page).click();
  await settled(page);
  await page.mouse.click(8, 200);
  await expect(floating(page)).toHaveCount(0);
  await trigger(page).click();
  await settled(page);
  // This is not a modal: moving focus to a normal link closes it without trapping focus.
  const next = page.locator('a[rel=next]');
  await next.focus();
  await expect(floating(page)).toHaveCount(0);
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.mugshot-detail-name')).toBeFocused();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
});

test('active expansion clears on history navigation and unmount', async ({ page }) => {
  await page.goto('/mugshots/all');
  await visit(page);
  await trigger(page).click();
  await expect(floating(page)).toBeVisible();
  await page.goBack();
  await expect(floating(page)).toHaveCount(0);
  await page.goForward();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(floating(page)).toHaveCount(0);
});

test('resize, landscape, scrolling and rapid dismissal remain safe', async ({ page }) => {
  await visit(page);
  await trigger(page).click();
  await expect(floating(page)).toBeVisible();
  await page.keyboard.press('Escape'); // Dismiss during the outward animation.
  await expect(floating(page)).toHaveCount(0);
  await trigger(page).click();
  await fits(page);
  await page.setViewportSize({ width: 740, height: 360 });
  await fits(page);
  await page.evaluate(() => scrollBy(0, 150));
  await fits(page);
  await page.keyboard.press('Escape');
  await expect(floating(page)).toHaveCount(0);
});

for (const mode of ['reduced motion', 'effects off']) {
  test(`${mode} removes animation but retains enlargement`, async ({ page }) => {
    if (mode === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit(page);
    if (mode === 'effects off') await page.evaluate(() => { document.documentElement.dataset.effects = 'off'; });
    await trigger(page).click();
    await expect(floating(page)).toBeVisible();
    expect(await floating(page).evaluate(node => node.getAnimations().length)).toBe(0);
    await fits(page);
    await page.keyboard.press('Escape');
    await expect(floating(page)).toHaveCount(0);
  });
}

test('failed portrait keeps its fallback and cannot expand', async ({ page }) => {
  await page.route('**/mugshot-thumbnails/**', route => route.abort());
  await page.route('**/mugshot-images/**', route => route.abort());
  await page.goto(`/mugshots/${profiles[0].song}`);
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await expect(trigger(page)).toBeDisabled();
  await expect(floating(page)).toHaveCount(0);
});

test('failed original never replaces a working thumbnail with a broken enlarged image', async ({ page }) => {
  await page.route('**/mugshot-images/**', route => route.abort());
  await visit(page);
  await trigger(page).click();
  await expect(trigger(page)).toBeDisabled();
  await expect(page.locator('img.mugshot-detail-photo')).toBeVisible();
  await expect(floating(page)).toHaveCount(0);
});

test('an image error during expansion removes the floating image and keeps the fallback', async ({ page }) => {
  await visit(page);
  await trigger(page).click();
  await expect(floating(page)).toBeVisible();
  await page.locator('img.mugshot-detail-photo').dispatchEvent('error');
  await expect(floating(page)).toHaveCount(0);
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await expect(trigger(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(floating(page)).toHaveCount(0);
});

test('an enlarged source failure removes it immediately, retaining the working thumbnail', async ({ page }) => {
  await visit(page);
  await trigger(page).click();
  await expect(floating(page)).toBeVisible();
  await floating(page).locator('img').dispatchEvent('error');
  await expect(floating(page)).toHaveCount(0);
  await expect(page.locator('img.mugshot-detail-photo')).toBeVisible();
  await expect(trigger(page)).toBeDisabled();
});

test('clicking away while the original loads cancels a late opening', async ({ page }) => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  await page.route('**/mugshot-images/**', async route => { await blocked; await route.continue(); });
  await visit(page);
  const started = page.waitForRequest(request => request.url().includes('/mugshot-images/'));
  await trigger(page).click();
  await started;
  await expect(trigger(page)).toHaveAttribute('aria-busy', 'true');
  await page.mouse.click(8, 200);
  await expect(trigger(page)).not.toHaveAttribute('aria-busy');
  const finished = page.waitForEvent('requestfinished', request => request.url().includes('/mugshot-images/'));
  release();
  await finished;
  // Let the image's load callback and React's following paint complete.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(floating(page)).toHaveCount(0);
});

test.describe('built profiles before hydration and without JavaScript', () => {
  let server, base;
  test.beforeAll(async () => {
    server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    base = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 15000);
      server.once('error', reject);
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
      server.stderr.on('data', data => { output += data; });
      server.stdout.on('data', data => {
        output += data;
        const port = output.match(/listening on port (\d+)/);
        if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port[1]}`); }
      });
    });
  });
  test.afterAll(() => { server?.kill('SIGTERM'); });
  test('server HTML retains photo, credit, biography, metadata and links', async ({ request }) => {
    const profile = profiles[0];
    const response = await request.get(`${base}/mugshots/${profile.song}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`src="${profile.image}"`);
    expect(html).toContain(`Photo credit: ${profile.credit}`);
    expect(html).toContain('rel="next"');
    expect(html).toContain(`https://www.santaradio.co.uk/mugshots/${profile.song}`);
    expect(html).not.toContain('class="mugshot-photo-floating"');
  });
  for (const javaScriptEnabled of [true, false]) {
    test(`built geometry and content with JavaScript ${javaScriptEnabled}`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      for (const profile of profiles) {
        await page.goto(`${base}/mugshots/${profile.song}`);
        const image = page.locator('.mugshot-detail-photo');
        await expect(image).toBeVisible();
        const geometry = await image.boundingBox();
        expect(geometry.height / geometry.width).toBeCloseTo(1.2, 2);
        await expect(image).toHaveCSS('object-fit', 'contain');
        await expect(page.locator('.mugshot-photo-credit')).toContainText(profile.credit);
        await expect(page.locator('.mugshot-detail-desc')).toHaveText(profile.info);
        await expect(page.locator('a[rel=next]')).toBeVisible();
        await expect(floating(page)).toHaveCount(0);
        if (javaScriptEnabled) {
          await expect(trigger(page)).toBeEnabled();
          await trigger(page).click();
          await fits(page);
          await page.keyboard.press('Escape');
          await expect(floating(page)).toHaveCount(0);
        } else await expect(trigger(page)).toBeDisabled();
      }
      await context.close();
    });
  }
});
