import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const replacements = [
  { slug: '551-cher-dj-play-a-christmas-song', artist: 'Cher', video: '-Z6AnCRjWX0' },
  { slug: '252-burl-ives-rudolph-the-red-nosed-reindeer', artist: 'Burl Ives', video: 'lVFWMNrYpQo' },
  { slug: '163-shane-macgowan-popes-christmas-lullaby', artist: 'Shane MacGowan & Popes', video: 'l3HTMknXacU' },
];

for (const section of ['christmas-artist', 'christmas-karaoke-lyrics']) {
  for (const { slug, artist, video } of replacements) {
    test(`${artist} uses the supplied replacement and preserves consent on ${section}`, async ({ page }) => {
      const song = findSong(slug);
      expect(song).toMatchObject({ artist, youtube: video });
      // Provider isolation verifies link assignment/consent, not real playback.
      await page.route('https://www.youtube.com/embed/**', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
      }));
      await page.goto(`/${section}/${slug}`);
      await expect(page.locator('h1')).toContainText(song.song);
      await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
      const consent = page.getByRole('group', { name: 'YouTube content is off' });
      await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
        .toHaveAttribute('href', `https://www.youtube.com/watch?v=${video}`);
      await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
      await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
      await expect(page.locator('iframe[src*="youtube"]'))
        .toHaveAttribute('src', `https://www.youtube.com/embed/${video}`);
      if (section === 'christmas-artist') await page.locator('details summary').click();
      await expect(page.locator(section === 'christmas-artist' ? '#song-lyrics pre' : '.karaoke-lyrics-text'))
        .toHaveText(song.lyrics);
    });
  }
}
