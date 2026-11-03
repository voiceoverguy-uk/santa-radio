import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';
import { songNeighbours } from '../src/seo/catalogue.js';

const slug = '551-cher-dj-play-a-christmas-song';
const video = '-Z6AnCRjWX0';
const oldVideo = 'pzJltQjuibA';

test('Cher’s exact song route uses the replacement only after external-media consent', async ({ page }) => {
  const song = findSong(slug);
  expect(song).toMatchObject({
    id: 551, artist: 'Cher', song: 'DJ Play a Christmas Song', youtube: video,
  });
  const embedRequests = [];
  // Isolate YouTube availability; these assertions do not verify real playback.
  await page.route('https://www.youtube.com/embed/**', route => {
    embedRequests.push(route.request().url());
    return route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
    });
  });
  await page.goto(`/christmas-artist/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/christmas-artist/${slug}$`));
  await expect(page.locator('h1')).toHaveText('DJ Play a Christmas Song — Cher');
  await expect(page.locator('.song-detail-info p')).toHaveText(song.info);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
  expect(embedRequests).toEqual([]);
  await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
  const consent = page.getByRole('group', { name: 'YouTube content is off' });
  await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
    .toHaveAttribute('href', `https://www.youtube.com/watch?v=${video}`);
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
  expect(embedRequests).toEqual([]);
  expect(await page.content()).not.toContain(oldVideo);

  await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
  const frame = page.locator('iframe[src*="youtube"]');
  await expect(frame).toHaveAttribute('src', `https://www.youtube.com/embed/${video}`);
  await frame.scrollIntoViewIfNeeded();
  await expect.poll(() => embedRequests).toEqual([`https://www.youtube.com/embed/${video}`]);
  expect(await page.content()).not.toContain(oldVideo);

  await page.locator('details summary').click();
  await expect(page.locator('#song-lyrics pre')).toHaveText(song.lyrics);
  const { previous, next } = songNeighbours(song);
  await expect(page.locator('.song-navigation-previous'))
    .toHaveAttribute('href', `/christmas-artist/${previous.id}-${previous.link}`);
  await expect(page.locator('.song-navigation-next'))
    .toHaveAttribute('href', `/christmas-artist/${next.id}-${next.link}`);
});
