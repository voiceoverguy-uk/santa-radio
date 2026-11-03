import { test, expect } from '@playwright/test';
import findSong from '../src/data/findSong.js';

const slug = '462-james-m-caddell-have-yourself-a-merry-little-christmas';

for (const section of ['christmas-artist', 'christmas-karaoke-lyrics']) {
  test(`James Caddell uses the supplied replacement with accurate performance credit on ${section}`, async ({ page }) => {
    const song = findSong(slug);
    expect(song.artist).toBe('James M Caddell');
    expect(song.song).toBe('Have Yourself A Merry Little Christmas');
    expect(song.youtube).toBe('kbQ0p7gDc5E');
    await page.route('https://www.youtube.com/embed/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Isolated video frame</title>',
    }));
    await page.goto(`/${section}/${slug}`);
    await expect(page.locator('h1')).toContainText(song.song);
    await page.getByRole('button', { name: 'Decline optional cookies', exact: true }).click();
    const consent = page.getByRole('group', { name: 'YouTube content is off' });
    await expect(consent.getByRole('link', { name: 'Open on YouTube instead (new tab)' }))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=kbQ0p7gDc5E');
    await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(0);
    await expect(page.getByText('Linked performance:', { exact: false }))
      .toContainText('Have Yourself a Merry Little Christmas — James Taylor');
    await expect(page.getByText('This video’s owner does not allow playback on other websites.')).toHaveCount(0);
    await expect(page.getByText("You're a Mean One Mr. Grinch", { exact: false })).toHaveCount(0);
    await consent.getByRole('button', { name: 'Enable external media', exact: true }).click();
    await expect(page.locator('iframe[src*="youtube"]'))
      .toHaveAttribute('src', 'https://www.youtube.com/embed/kbQ0p7gDc5E');
    const lyrics = page.locator(section === 'christmas-artist'
      ? '#song-lyrics pre' : '.karaoke-lyrics-text');
    if (section === 'christmas-artist') await page.locator('details summary').click();
    await expect(lyrics).toHaveText(song.lyrics);
  });
}
