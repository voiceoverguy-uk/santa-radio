import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const slug = '252-burl-ives-rudolph-the-red-nosed-reindeer';
const video = 'lVFWMNrYpQo';
const formerVideo = 'bMletImQ_cs';

test('Burl Ives replacement preserves the exact artist route and external-media gate', async ({ page }) => {
  const song = findSong(slug);
  expect(song).toMatchObject({
    id: 252, artist: 'Burl Ives', song: 'Rudolph The Red-Nosed Reindeer', youtube: video,
  });
  expect(song.youtubeEmbed).not.toBe(false);

  const embedRequests = [];
  // Isolate provider availability: this tests configuration and consent, not playback.
  await page.route('https://www.youtube.com/embed/**', route => {
    embedRequests.push(route.request().url());
    return route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
    });
  });
  await page.goto(`/christmas-artist/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/christmas-artist/${slug}$`));
  await expect(page.locator('h1')).toHaveText(`${song.song} — ${song.artist}`);
  await expect(page.locator('.song-detail-info p')).toHaveText(song.info);
  await expect(page.getByRole('navigation', { name: 'Browse Christmas songs' })).toBeVisible();
  await expect(page.locator('.song-detail-artwork img')).toBeVisible();

  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const consent = page.getByRole('group', { name: 'YouTube content is off' });
  await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
    .toHaveAttribute('href', `https://www.youtube.com/watch?v=${video}`);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
  expect(embedRequests).toEqual([]);
  await expect(page.locator(`[href*="${formerVideo}"], [src*="${formerVideo}"]`)).toHaveCount(0);

  await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
  const player = page.locator('iframe[src*="youtube"]');
  await expect(player).toHaveAttribute('src', `https://www.youtube.com/embed/${video}`);
  await expect(player).toHaveAttribute('title', `${song.artist} - ${song.song}`);
  await player.scrollIntoViewIfNeeded();
  await expect.poll(() => embedRequests).toContain(`https://www.youtube.com/embed/${video}`);
  await expect(page.locator(`[href*="${formerVideo}"], [src*="${formerVideo}"]`)).toHaveCount(0);
  expect(embedRequests.some(url => url.includes(formerVideo))).toBe(false);

  await page.locator('details summary').click();
  await expect(page.locator('#song-lyrics pre')).toHaveText(song.lyrics);
});
