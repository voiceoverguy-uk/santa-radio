import { test, expect } from '@playwright/test';
import raw from '../src/data/mugshots.json' with { type: 'json' };
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const { catalogue } = buildCatalogue(raw);
const names = ['Chuckle Brothers', 'Christine Lampard', 'Ben Nealon', 'Juliet Mills',
  'Lorna Fitzgerald', 'Maxwell Caulfield', 'Robert Carlyle', 'Steve Fletcher'];

async function compareProfiles(page, width, baseURL = '') {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let reference;
    for (const name of names) {
      const profile = catalogue.find(row => row.artist === name && row.image);
      const response = await page.goto(`${baseURL}/mugshots/${profile.song}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(name);
      const photo = page.locator('.mugshot-detail-photo');
      await expect(photo).toHaveAttribute('src', profile.image);
      await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      const rejectCookies = page.getByRole('button', { name: 'Reject optional cookies' });
      if (await rejectCookies.isVisible()) await rejectCookies.click();
      const dimensions = await photo.evaluate(img => {
        const rect = img.getBoundingClientRect();
        const frame = img.parentElement.getBoundingClientRect();
        return { width: rect.width, height: rect.height, frameWidth: frame.width,
          frameHeight: frame.height, fit: getComputedStyle(img).objectFit,
          position: getComputedStyle(img).objectPosition,
          naturalRatio: img.naturalWidth / img.naturalHeight };
      });
      expect(dimensions.fit).toBe('contain');
      expect(dimensions.position).toBe('50% 50%');
      // The real loaded images include both 5:6 and 3:4 proportions.
      expect(dimensions.naturalRatio).toBeCloseTo(name === 'Chuckle Brothers' ? 5 / 6 : 3 / 4, 2);
      expect(Math.abs(dimensions.height / dimensions.width - 1.2)).toBeLessThan(0.01);
      expect(Math.abs(dimensions.width - dimensions.frameWidth)).toBeLessThan(1);
      expect(Math.abs(dimensions.height - dimensions.frameHeight)).toBeLessThan(1);
      if (width >= 768) {
        expect(dimensions.frameWidth).toBeCloseTo(300, 1);
        expect(dimensions.frameHeight).toBeCloseTo(360, 1);
      }
      if (!reference) reference = dimensions;
      expect(Math.abs(dimensions.width - reference.width)).toBeLessThan(1);
      expect(Math.abs(dimensions.height - reference.height)).toBeLessThan(1);
      const credit = page.locator('.mugshot-photo-credit');
      await expect(credit).toBeVisible();
      await expect(credit).toHaveText(`Photo credit: ${profile.credit}`);
      const frameBox = await page.locator('.mugshot-detail-figure .mugshot-photo-frame').boundingBox();
      const creditBox = await credit.boundingBox();
      expect(creditBox.y).toBeGreaterThanOrEqual(frameBox.y + frameBox.height - 1);
      const navigation = page.getByRole('navigation', { name: 'Browse Mugshots' });
      await expect(navigation).toBeVisible();
      const navBox = await navigation.boundingBox();
      expect(navBox.y).toBeGreaterThanOrEqual(creditBox.y + creditBox.height - 1);
      for (const label of ['Previous', 'Next']) {
        const link = navigation.getByRole('link', { name: new RegExp(`^${label} Mugshot:`) });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', /^\/mugshots\/.+/);
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
}

for (const width of [320, 390, 1280]) {
  test(`standard and taller profile photos share a frame at ${width}px`, async ({ page }) => {
    await compareProfiles(page, width);
  });
}

test.describe('built public profile pages', () => {
  let server, baseURL;

  test.beforeAll(async () => {
    // Fail explicitly if the production build has not been generated.
    await stat('dist/server/entry-server.js');
    server = spawn(process.execPath, ['index.js', '--port=0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    baseURL = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Production server did not start: ${output}`)), 15000);
      const fail = error => { clearTimeout(timer); reject(error); };
      server.once('error', fail);
      server.once('exit', code => fail(new Error(`Production server exited (${code}): ${output}`)));
      server.stderr.on('data', data => { output += data; });
      server.stdout.on('data', data => {
        output += data;
        const match = output.match(/listening on port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(`http://127.0.0.1:${match[1]}`);
        }
      });
    });
  });

  test.afterAll(async () => {
    if (server && server.exitCode === null) {
      await new Promise(resolve => {
        server.once('exit', resolve);
        server.kill('SIGTERM');
      });
    }
  });

  for (const javaScriptEnabled of [true, false]) {
    test.describe(javaScriptEnabled ? 'hydrated' : 'without JavaScript', () => {
      test.use({ javaScriptEnabled });
      for (const width of [390, 1280]) {
        test(`preserves complete photos, credits and navigation at ${width}px`, async ({ page }) => {
          await compareProfiles(page, width, baseURL);
        });
      }
    });
  }
});
