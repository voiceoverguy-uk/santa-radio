import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseMusicRows, reconcileMusic } from '../scripts/import-music-catalogue.js';
import { repair } from '../scripts/import-mugshots.js';
import findSong from '../src/data/findSong.js';

const songs = JSON.parse(fs.readFileSync('src/data/songs.json', 'utf8'));
const rows = parseMusicRows(fs.readFileSync('attached_assets/cl57-thesongs_1791303552293.sql', 'utf8'));
const historical = JSON.parse(fs.readFileSync('reports/music-import.json', 'utf8'));

test('all source records are matched and every historical route still resolves', () => {
  expect(rows).toHaveLength(454);
  expect(songs).toHaveLength(455);
  const result = reconcileMusic(songs, rows);
  expect(result.output).toEqual(songs);
  expect(result.report.matched).toBe(454);
  expect(result.report.databaseOnly).toEqual([]);
  expect(result.report.unresolved.map(r => r.url)).toEqual(['422-r-kelly-world-christmas']);
  for (const row of rows) {
    const song = songs.find(s => s.id === Number(row[0]));
    expect(song.info).toBe(repair(row[4]).replace(/\r\n?/g, '\n').trim());
    expect(song.lyrics).toBe(repair(row[6]).replace(/\r\n?/g, '\n').trim());
    expect(findSong(`${song.id}-${song.link}`)).toEqual(song);
  }
  expect(historical.matches).toHaveLength(433);
  for (const match of historical.matches) {
    const song = findSong(match.url);
    expect(song).toBeTruthy();
    if (match.databaseId) expect(song.id).toBe(match.databaseId);
  }
  expect(findSong('134-michael-buble-ave-maria').id).toBe(328);
});

test('parser rejects incomplete data and reconciliation refuses ID-only guesses', () => {
  expect(() => parseMusicRows("INSERT INTO `messages2` VALUES (1,'unfinished")).toThrow();
  expect(() => parseMusicRows("INSERT INTO `messages2` VALUES (1,'short');")).toThrow();
  expect(repair('Itâ€™s NoÃ«l')).toBe('It’s Noël');
  const source = [[1, 'Song', 'Artist', '', 'Info', '', 'Line one\nLine two', '']];
  const old = { id: 1, artist: 'Someone Else', song: 'Different', link: 'someone-else-different', lyrics: 'Keep', image: '/old.jpg' };
  expect(reconcileMusic([old], source).output).toEqual([old]);
  const verified = { ...old, id: 99, artist: 'Artist', song: 'Song', link: 'historic-link' };
  const result = reconcileMusic([verified], source);
  expect(result.output[0]).toMatchObject({ id: 99, link: 'historic-link', image: '/old.jpg', lyrics: 'Line one\nLine two' });
  expect(result.report.matches[0].conflictingId).toBe(99);
});

test('Andy Williams lyrics toggle and karaoke share readable source text', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  const slug = '82-andy-williams-do-you-hear-what-i-hear';
  const song = findSong(slug);
  await page.goto(`/christmas-artist/${slug}`);
  await expect(page.locator('.song-detail-artist')).toHaveText('Andy Williams');
  await expect(page.locator('.song-detail-info')).toHaveText(song.info);
  const toggle = page.getByRole('button', { name: 'Show Lyrics', exact: true });
  await toggle.click();
  await expect(page.locator('.song-lyrics-content pre')).toHaveText(song.lyrics);
  await expect(page.locator('.song-lyrics-content pre')).toHaveCSS('white-space', 'pre-wrap');
  await page.getByRole('button', { name: 'Hide Lyrics' }).click();
  await expect(page.locator('.song-lyrics-content')).toHaveCount(0);
  await page.getByRole('link', { name: 'View Karaoke Lyrics' }).click();
  await expect(page.locator('.karaoke-lyrics-text')).toHaveText(song.lyrics);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('corrected, conflicting and unavailable routes render honestly', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  for (const slug of ['134-michael-buble-ave-maria', '12-12', '549-bon-jovi-christmas-isna-tmt-christmas']) {
    await page.goto(`/christmas-artist/${slug}`);
    const song = findSong(slug);
    await expect(page.locator('.song-detail-artist')).toHaveText(song.artist);
    await page.getByRole('button', { name: 'Show Lyrics', exact: true }).click();
    await expect(page.locator('.song-lyrics-content pre')).toHaveText(song.lyrics);
  }
  await page.goto('/christmas-artist/422-r-kelly-world-christmas');
  await expect(page.locator('.song-detail-info')).toContainText('not yet available');
  await expect(page.getByRole('button', { name: 'Show Lyrics' })).toHaveCount(0);
  await page.goto('/christmas-karaoke-lyrics/422-r-kelly-world-christmas');
  await expect(page.locator('.karaoke-no-lyrics')).toContainText('not yet available');
});

test('Elvis Presley Blue Christmas page uses the requested YouTube video', async ({ page }) => {
  await page.route('**/youtube.com/**', route => route.abort());
  await page.goto('/christmas-artist/399-elvis-presley-blue-christmas');
  await expect(page.locator('.song-detail-artist')).toHaveText('Elvis Presley');
  await expect(page.locator('.song-youtube-embed iframe'))
    .toHaveAttribute('src', 'https://www.youtube.com/embed/3KK6sMo8NBY');
});

test.describe('song artwork enlargement', () => {
  const slug = '82-andy-williams-do-you-hear-what-i-hear';
  const song = findSong(slug);
  const triggerName = `Enlarge artwork for ${song.song} by ${song.artist}`;
  const dialogName = `Artwork for ${song.song} by ${song.artist}`;

  test.beforeEach(async ({ page }) => {
    await page.route('**/*youtube.com/**', route => route.abort());
    await page.goto(`/christmas-artist/${slug}`);
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
  });

  test('pointer opens the same image and all dismissal methods restore the song page', async ({ page }) => {
    const trigger = page.getByRole('button', { name: triggerName });
    const dialog = page.getByRole('dialog', { name: dialogName });
    const thumbnail = trigger.locator('img');
    await expect.poll(() => thumbnail.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const original = await thumbnail.evaluate(img => ({ src: img.currentSrc, alt: img.alt }));
    const overflow = await page.evaluate(() => document.body.style.overflow);
    for (const dismissal of ['close', 'escape', 'backdrop']) {
      await trigger.click();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('img')).toHaveAttribute('src', original.src);
      await expect(dialog.locator('img')).toHaveAttribute('alt', original.alt);
      await dialog.locator('img').click();
      await expect(dialog).toBeVisible();
      if (dismissal === 'close') await dialog.getByRole('button', { name: 'Close enlarged artwork' }).click();
      if (dismissal === 'escape') await page.keyboard.press('Escape');
      if (dismissal === 'backdrop') await page.mouse.click(4, 4);
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe(overflow);
      await expect(page).toHaveURL(new RegExp(`/christmas-artist/${slug}$`));
    }
    await page.locator('.song-lyrics-section summary').click();
    await expect(page.locator('.song-lyrics-content pre')).toBeVisible();
    await expect(page.locator('.song-lyrics-content pre')).toHaveText(song.lyrics);
    const next = page.getByRole('link', { name: /^Next song:/ });
    const nextUrl = await next.getAttribute('href');
    await next.click();
    await expect(page).toHaveURL(new RegExp(`${nextUrl}$`));
    await expect(page.locator('.song-artwork-dialog')).not.toBeVisible();
  });

  test('keyboard activation contains focus and returns it on dismissal', async ({ page }) => {
    const trigger = page.getByRole('button', { name: triggerName });
    const dialog = page.getByRole('dialog', { name: dialogName });
    // Move from a neighbouring link with Tab, rather than activating by pointer.
    await trigger.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(trigger).toBeFocused();
    for (const key of ['Enter', 'Space']) {
      await page.keyboard.press(key);
      await expect(dialog).toBeVisible();
      const close = dialog.getByRole('button', { name: 'Close enlarged artwork' });
      await expect(close).toBeFocused();
      for (const direction of ['Tab', 'Shift+Tab']) {
        await page.keyboard.press(direction);
        expect(await dialog.evaluate(el => el.contains(document.activeElement) ||
          document.activeElement === document.body)).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.getByRole('link', { name: 'Open the full sing-along lyrics page' }).click();
    await expect(page.locator('.karaoke-lyrics-text')).toHaveText(song.lyrics);
  });

  for (const [width, height] of [[1200, 600], [600, 1200]]) {
    test(`non-square ${width}×${height} artwork keeps its proportions`, async ({ page }) => {
      const src = await page.locator('.song-artwork-img').getAttribute('src');
      await page.route(`**${src}`, route => route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="green"/></svg>`,
      }));
      await page.reload();
      const trigger = page.getByRole('button', { name: triggerName });
      await expect.poll(() => trigger.locator('img').evaluate(img => img.naturalWidth)).toBe(width);
      await page.setViewportSize({ width: 390, height: 844 });
      await trigger.click();
      const image = page.getByRole('dialog', { name: dialogName }).locator('img');
      await expect.poll(() => image.evaluate(img => img.naturalHeight)).toBe(height);
      const bounds = await image.boundingBox();
      expect(bounds.width / bounds.height).toBeCloseTo(width / height, 2);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);
    });
  }

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    test(`image stays contained at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.getByRole('button', { name: triggerName }).click();
      const dialog = page.getByRole('dialog', { name: dialogName });
      const image = dialog.locator('img');
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
      const metrics = await image.evaluate(img => {
        const rect = img.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          ratio: img.naturalWidth / img.naturalHeight };
      });
      expect(metrics.x).toBeGreaterThanOrEqual(0);
      expect(metrics.y).toBeGreaterThanOrEqual(0);
      expect(metrics.x + metrics.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(metrics.y + metrics.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(metrics.width / metrics.height).toBeCloseTo(metrics.ratio, 2);
      const close = await dialog.getByRole('button', { name: 'Close enlarged artwork' }).boundingBox();
      expect(close.y).toBeGreaterThanOrEqual(0);
      expect(close.y + close.height).toBeLessThanOrEqual(viewport.height);
      await page.mouse.click(4, 4);
      await expect(dialog).not.toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
});
