import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const path = '/christmas-artist/163-shane-macgowan-popes-christmas-lullaby';
const video = 'l3HTMknXacU';
const oldVideo = 'FqbOCmFQkKQ';

test('Christmas Lullaby uses the supplied video only after external-media permission', async ({ page }) => {
  const song = findSong(path.split('/').at(-1));
  expect(song).toMatchObject({
    id: 163, song: 'Christmas Lullaby', artist: 'Shane MacGowan & Popes', youtube: video,
  });
  const embeds = [];
  // Isolate provider availability: this proves configuration/consent, not playback.
  await page.route('https://www.youtube.com/embed/**', route => {
    embeds.push(route.request().url());
    return route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
    });
  });
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('heading', { level: 1 }))
    .toHaveText('Christmas Lullaby — Shane MacGowan & Popes');
  await expect(page.locator('.song-detail-info p')).toHaveText(song.info);
  await expect(page.locator('.song-detail-artwork img')).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Browse Christmas songs' });
  await expect(navigation.getByRole('link', { name: /^Previous song:/ })).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: /^Next song:/ })).toHaveCount(1);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const consent = page.getByRole('group', { name: 'YouTube content is off' });
  await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
    .toHaveAttribute('href', `https://www.youtube.com/watch?v=${video}`);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
  expect(embeds).toEqual([]);
  await expect(page.locator(`[href*="${oldVideo}"], [src*="${oldVideo}"]`)).toHaveCount(0);
  await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
  const frame = page.locator('.song-youtube-embed iframe');
  await expect(frame).toHaveAttribute('src', `https://www.youtube.com/embed/${video}`);
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(() => embeds).toEqual([`https://www.youtube.com/embed/${video}`]);
  await expect(page.locator(`[href*="${oldVideo}"], [src*="${oldVideo}"]`)).toHaveCount(0);
  await page.locator('details summary').click();
  await expect(page.locator('#song-lyrics pre')).toHaveText(song.lyrics);
  await expect(page.getByRole('link', { name: '← Back to Christmas Music', exact: true }))
    .toHaveAttribute('href', '/christmas-music');
});
