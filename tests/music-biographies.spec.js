import { test, expect } from '@playwright/test';
import songs from '../src/data/songs.json' with { type: 'json' };
import record from '../docs/editorial/christmas-music-changes.json' with { type: 'json' };
import findSong from '../src/data/findSong.js';

test('all editorial changes resolve without altering historical addresses', () => {
  for (const entry of record.records) {
    expect(entry.wordCount).toBeGreaterThanOrEqual(45);
    expect(entry.wordCount).toBeLessThanOrEqual(70);
    expect(entry.sources.length).toBeGreaterThan(0);
    for (const page of entry.pages) {
      const song = findSong(page.url.split('/').pop());
      expect(song.info).toBe(entry.after);
      expect(song.song).toBe(page.song);
      expect(song.youtube).toBe(page.youtube);
      for (const alias of song.aliases || []) expect(findSong(alias)).toBe(song);
    }
  }
  for (const song of songs.filter(s => s.artist === 'Frank Sinatra')) {
    expect(song.info).not.toMatch(/Francis Wayne|Sinatra Jr/);
  }
});

for (const entry of record.records) {
  test(`${entry.artist}: biography, metadata, lyrics and video render`, async ({ page }) => {
    const target = entry.pages[0];
    const song = songs.find(s => s.id === target.id);
    await page.route('https://www.youtube.com/**', route => route.abort());
    await page.goto(target.url, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.song-detail-info')).toHaveText(entry.after);
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      await expect(page.locator(`${selector}[data-rh="true"]`)).toHaveAttribute('content', entry.after);
    }
    if (song.youtube) await expect(page.locator('.song-detail-main iframe')).toHaveAttribute('src', new RegExp(song.youtube));
    if (song.lyrics) {
      await page.getByRole('button', { name: 'Show Lyrics', exact: true }).click();
      await expect(page.locator('#song-lyrics')).toContainText(song.lyrics);
    }
    await expect(page.getByRole('complementary', { name: 'Santa Radio player' })).toBeVisible();
  });
}
