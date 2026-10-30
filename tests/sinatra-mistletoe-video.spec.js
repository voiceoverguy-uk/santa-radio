import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const recordings = [
  { slug: '236-frank-sinatra-mistletoe-and-holly', id: 236, artist: 'Frank Sinatra', video: 'UtSUTIc8TM4' },
  { slug: '237-the-moonglows-mistletoe-and-holly', id: 237, artist: 'The Moonglows', video: 'OpN6FP0Iztk' },
];

for (const section of ['christmas-artist', 'christmas-karaoke-lyrics']) {
  for (const { slug, id, artist, video } of recordings) {
    test(`${artist} keeps the assigned Mistletoe And Holly video and consent controls on ${section}`, async ({ page }) => {
      const song = findSong(slug);
      expect(song).toMatchObject({ id, artist, song: 'Mistletoe And Holly', youtube: video });
      // Isolate provider availability: this verifies assignment and consent, not playback.
      await page.route('https://www.youtube.com/embed/**', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
      }));
      await page.goto(`/${section}/${slug}`);
      await expect(page.locator('h1')).toContainText('Mistletoe And Holly');
      await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
      const consent = page.getByRole('group', { name: 'YouTube content is off' });
      await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
        .toHaveAttribute('href', `https://www.youtube.com/watch?v=${video}`);
      await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
      await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
      await expect(page.locator('iframe[src*="youtube"]'))
        .toHaveAttribute('src', `https://www.youtube.com/embed/${video}`);
      const lyrics = page.locator(section === 'christmas-artist'
        ? '#song-lyrics pre' : '.karaoke-lyrics-text');
      if (section === 'christmas-artist') await page.locator('details summary').click();
      await expect(lyrics).toHaveText(song.lyrics);
    });
  }
}
