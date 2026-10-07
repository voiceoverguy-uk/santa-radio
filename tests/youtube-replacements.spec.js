import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import findSong from '../src/data/findSong.js';

const replacements = JSON.parse(execFileSync('python3', ['-c', `
import csv,json
print(json.dumps(list(csv.DictReader(open('attached_assets/youtube-links-to-review_1791360559870.csv',encoding='utf-8-sig')))))
`], { encoding: 'utf8' }));

test('all 50 supplied video changes match their exact song pages', () => {
  expect(replacements).toHaveLength(50);
  for (const row of replacements) {
    const song = findSong(row['Page path'].split('/').pop());
    expect(song.artist).toBe(row.Artist);
    expect(song.song).toBe(row.Song);
    const url = row['NEW YT LINK'].trim();
    expect(song.youtube).toBe(url === 'REMOVE VIDEO OPTION' ? '' : new URL(url).searchParams.get('v'));
  }
  expect(findSong('60-chris-rea-driving-home-for-christmas').youtube)
    .not.toBe(findSong('176-michael-ball-driving-home-for-christmas').youtube);
});

test('replacement embeds render and requested video removal preserves the song page', async ({ page }) => {
  await page.route('https://www.youtube.com/**', route => route.abort());
  await page.goto(replacements[0]['Page path'], { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.song-youtube-embed iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/WM7M7zSMJcw');
  const removed = replacements.find(row => row['NEW YT LINK'] === 'REMOVE VIDEO OPTION');
  await page.goto(removed['Page path'], { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toHaveText(removed.Song);
  await expect(page.locator('.song-youtube-embed')).toHaveCount(0);
});
