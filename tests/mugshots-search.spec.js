import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { matchesMugshot, mugshotSuggestions } from '../src/data/mugshot-search.js';

const { catalogue } = buildCatalogue(JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8')));

test('selected names outrank other matches while each group keeps relevance and alphabetical ties', () => {
  const fixture = [
    { song: 'other-substring', artist: 'Barry Other', homepage: false },
    { song: 'selected-substring-z', artist: 'Terry Selected', homepage: true },
    { song: 'other-prefix', artist: 'Ryan Other' },
    { song: 'selected-prefix-z', artist: 'Rylan Selected', homepage: true },
    { song: 'selected-substring-a', artist: 'Harry Selected', homepage: true },
    { song: 'other-exact', artist: 'Ry', homepage: false },
    { song: 'selected-alias', artist: 'Alias Selected', searchNames: ['Ry Alias', 'Ry Alias'], homepage: true },
    { song: 'selected-exact', artist: 'Selected Exact', searchNames: ['Ry'], homepage: true },
  ].map(profile => ({ link: 'Presenter', ...profile }));
  const options = mugshotSuggestions(fixture, ' RY ');
  expect(options.map(item => item.slug)).toEqual([
    'selected-exact', 'selected-alias', 'selected-prefix-z', 'selected-substring-a',
    'selected-substring-z', 'other-exact', 'other-prefix', 'other-substring',
  ]);
  expect(new Set(options.map(item => item.id)).size).toBe(options.length);
  expect(fixture.filter(profile => matchesMugshot(profile, options[1].label, options[1]))
    .map(profile => profile.song)).toEqual(['selected-alias']);
});

test('selected matches are ranked before truncation without taking reserved talent slots', () => {
  const ordinary = Array.from({ length: 12 }, (_, index) => ({
    song: `ordinary-${index}`, artist: `Dan ${String(index).padStart(2, '0')}`,
    link: index % 2 ? 'Dancer' : 'Dance Teacher',
    ...(index % 2 ? { homepage: false } : {}),
  }));
  const selected = Array.from({ length: 9 }, (_, index) => ({
    song: `selected-${index}`, artist: `Zed ${index}`, searchNames: ['Aidan Alias'],
    link: 'Dancer', homepage: true,
  }));
  for (const count of [1, selected.length]) {
    const options = mugshotSuggestions([...ordinary, ...selected.slice(0, count)], 'dan');
    const names = options.filter(item => item.type === 'name');
    const talents = options.filter(item => item.type === 'talent');
    expect(options).toHaveLength(8);
    expect(talents.map(item => item.family)).toEqual(['dance']);
    expect(names.slice(0, Math.min(count, names.length)).map(item => item.slug))
      .toEqual(selected.slice(0, Math.min(count, names.length)).map(item => item.song));
    expect(names.slice(count).every(item => item.slug.startsWith('ordinary-'))).toBe(true);
  }
  const twoTalents = mugshotSuggestions(ordinary.map(profile => ({
    ...profile, artist: profile.artist.replace('Dan', 'Actor'), link: 'Actor / Presenter',
  })).concat({ song: 'selected', artist: 'Zed', searchNames: ['An Actor'], link: 'Actor', homepage: true }), 'actor');
  expect(twoTalents).toHaveLength(8);
  expect(twoTalents.filter(item => item.type === 'name')).toHaveLength(6);
  expect(twoTalents[0].slug).toBe('selected');
  expect(twoTalents.filter(item => item.type === 'talent').map(item => item.label))
    .toEqual(['Actor', 'Actor / Presenter']);
});

test('the real ry query puts matching selected names ahead of unselected prefixes', () => {
  const nameMatches = catalogue.filter(profile =>
    [profile.artist, ...profile.searchNames].some(name => name.toLowerCase().includes('ry')));
  const selected = nameMatches.filter(profile => profile.homepage === true);
  const ordinary = nameMatches.filter(profile => profile.homepage !== true);
  expect(selected.some(profile => !profile.artist.toLowerCase().startsWith('ry'))).toBe(true);
  expect(ordinary.some(profile => profile.artist.toLowerCase().startsWith('ry'))).toBe(true);
  const options = mugshotSuggestions(catalogue, 'ry');
  const names = options.filter(item => item.type === 'name');
  expect(names.slice(0, Math.min(names.length, selected.length)).every(item =>
    selected.some(profile => profile.song === item.slug))).toBe(true);
  expect(names).toHaveLength(Math.min(nameMatches.length, 8 - options.filter(item => item.type === 'talent').length));
  expect(names[0].slug).toBe(selected.find(profile => profile.artist === 'Rylan').song);
  expect(options.some(item => item.type === 'talent')).toBe(true);
});

test('catalogue matching includes canonical names, retained aliases and role variants without changing facts', () => {
  for (const query of ['dan', 'sing', 'actor', ' DANCE ', 'singers']) {
    const options = mugshotSuggestions(catalogue, query);
    expect(options.length).toBeLessThanOrEqual(8);
    expect(new Set(options.map(item => item.id)).size).toBe(options.length);
    for (const option of options) {
      const matches = catalogue.filter(profile => matchesMugshot(profile, option.label, option));
      expect(matches.length).toBeGreaterThan(0);
      if (option.type === 'name') expect(matches.map(profile => profile.song)).toEqual([option.slug]);
    }
  }
  const dan = mugshotSuggestions(catalogue, 'dan');
  expect(dan[0].label).toMatch(/^Dan/i);
  expect(dan.some(item => item.family === 'dance')).toBe(true);
  expect(mugshotSuggestions(catalogue, 'sing').some(item => item.family === 'singer')).toBe(true);
  for (const profile of catalogue) {
    for (const name of [profile.artist, ...profile.searchNames]) {
      expect(matchesMugshot(profile, `  ${name.toUpperCase()}  `), name).toBe(true);
    }
  }
  expect(mugshotSuggestions(catalogue, '  ')).toEqual([]);
  expect(mugshotSuggestions(catalogue, 'no-such-famous-face-1099')).toEqual([]);
  expect(mugshotSuggestions(catalogue, 'Bernie Clifton').filter(item => item.type === 'name')).toHaveLength(1);
  const fixture = [
    { song: 'dan', artist: 'Dan Example', searchNames: ['Old Name'], link: 'Singer' },
    { song: 'dancer', artist: 'Other Person', searchNames: [], link: 'Dancers' },
    { song: 'singers', artist: 'The Singers', searchNames: [], link: 'Singers' },
    { song: 'dance', artist: 'Couple', searchNames: [], link: 'Dance Couple' },
  ];
  expect(mugshotSuggestions(fixture, 'sing').map(item => item.type)).toEqual(['name', 'talent']);
  expect(fixture.filter(profile => matchesMugshot(profile, 'Dancer')).map(item => item.song)).toEqual(['dancer', 'dance']);
  expect(fixture.filter(profile => matchesMugshot(profile, 'Singers')).map(item => item.song)).toEqual(['dan', 'singers']);
  expect(mugshotSuggestions(fixture, 'old name')[0].label).toBe('Dan Example');
  const ranked = mugshotSuggestions([
    { song: 'incidental', artist: 'Aidan Example', link: 'TV Presenter' },
    { song: 'prefix', artist: 'Dan Example', link: 'TV Presenter' },
    { song: 'alias', artist: 'Another Person', searchNames: ['Danny Alias'], link: 'tv presenter' },
  ], 'dan');
  expect(ranked.map(item => item.slug)).toEqual(['alias', 'prefix', 'incidental']);
  const roleOptions = mugshotSuggestions([
    { song: 'one', artist: 'One', link: 'TV Presenter' },
    { song: 'two', artist: 'Two', link: 'tv presenter' },
  ], 'present');
  expect(roleOptions).toHaveLength(1);
  expect(roleOptions[0].id).not.toMatch(/\s/);
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
  await page.goto('/mugshots/all');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
});

const searchOn = page => page.getByRole('combobox', { name: 'Find a famous face', exact: true });
const cardsOn = page => page.locator('.mugshots-grid .mugshot-card');

test('live queries, mouse selection, role selection, aliases, no matches and clearing', async ({ page }) => {
  const search = searchOn(page);
  const cards = cardsOn(page);
  const original = await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await search.fill('dan');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option').first()).toHaveText(`Name${mugshotSuggestions(catalogue, 'dan')[0].label}`);
  await expect(page.getByRole('option', { name: 'Talent Dance / Dancer' })).toBeVisible();
  const danMatches = catalogue.filter(profile => matchesMugshot(profile, 'dan'));
  await expect(cards).toHaveCount(danMatches.length);
  const name = mugshotSuggestions(catalogue, 'dan')[0];
  await page.getByRole('option', { name: `Name ${name.label}`, exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('href', `/mugshots/${name.slug}`);
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/\/mugshots\/all$/);
  await search.fill('dan');
  await page.getByRole('option', { name: 'Talent Dance / Dancer' }).click();
  const dancers = catalogue.filter(profile => /\bdanc(?:e|er)s?\b/i.test(profile.link));
  await expect(cards).toHaveCount(dancers.length);
  await expect(page.getByRole('status')).toContainText(`${dancers.length} results`);
  await page.getByRole('button', { name: 'A–Z', exact: true }).click();
  await expect(cards).toHaveCount(dancers.length);
  await search.fill('sing');
  await page.getByRole('option', { name: 'Talent Singer / Singers' }).click();
  const singers = catalogue.filter(profile => /\bsingers?\b/i.test(profile.link));
  await expect(cards).toHaveCount(Math.min(100, singers.length));
  if (singers.length > 100) {
    await page.getByRole('button', { name: /Load More/ }).click();
    await expect(cards).toHaveCount(Math.min(200, singers.length));
  }
  await search.fill('  DAN WALLKER  ');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Name Dan Walker', exact: true })).toBeVisible();
  await search.fill('  Angry Ginge  ');
  await expect(cards).toHaveCount(1);
  await search.fill('no-such-famous-face-1099');
  await expect(cards).toHaveCount(0);
  await expect(page.getByText('No matching names or talents.', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('0 results');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
  await expect(cards).toHaveCount(100);
  expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(original);
  await expect(page.locator('.seo-directory, #mug-directory-heading')).toHaveCount(0);
  await expect(page.getByText('All celebrity mug photographs — A–Z', { exact: true })).toHaveCount(0);
});

test('keyboard selection announces the prioritised active option, dismisses and leaves normal Tab navigation', async ({ page }) => {
  const search = searchOn(page);
  await search.fill('ry');
  await search.press('ArrowDown');
  const firstOption = page.getByRole('option').first();
  await expect(firstOption).toHaveAttribute('aria-selected', 'true');
  await expect(search).toHaveAttribute('aria-activedescendant', await firstOption.getAttribute('id'));
  await search.press('ArrowUp');
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  await search.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(search).not.toHaveAttribute('aria-activedescendant');
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(cardsOn(page)).toHaveCount(1);
  await expect(cardsOn(page).first()).toHaveAttribute('href', `/mugshots/${mugshotSuggestions(catalogue, 'ry')[0].slug}`);
  await search.fill('sing');
  await search.press('ArrowUp');
  await search.press('Enter');
  await expect(search).toHaveValue('Singer / Singers');
  await search.fill('radio');
  await search.press('ArrowUp');
  const roleId = await search.getAttribute('aria-activedescendant');
  expect(roleId).not.toMatch(/\s/);
  expect(await page.evaluate(id => document.getElementById(id)?.getAttribute('role'), roleId)).toBe('option');
  await search.press('Enter');
  await expect(cardsOn(page).first()).toBeVisible();
  await search.fill('dan');
  await search.press('Tab');
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Shuffle', exact: true })).toBeFocused();
});

for (const width of [320, 1440]) {
  test(`dropdown touch, bounds and enlarged text at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.goto('/mugshots/all');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const search = searchOn(page);
    await search.fill('ry');
    const ryOptions = mugshotSuggestions(catalogue, 'ry');
    await expect(page.getByRole('option')).toHaveText(ryOptions.map(item =>
      `${item.type === 'name' ? 'Name' : 'Talent'}${item.label}`));
    await page.getByRole('option').first().tap();
    await expect(cardsOn(page)).toHaveCount(1);
    await expect(cardsOn(page).first()).toHaveAttribute('href', `/mugshots/${ryOptions[0].slug}`);
    for (const scale of [100, 200]) {
      await page.addStyleTag({ content: `html { font-size: ${scale}% !important; scroll-behavior: auto !important; }` });
      await search.fill('dan');
      await search.scrollIntoViewIfNeeded();
      const list = page.getByRole('listbox');
      await expect(list).toBeVisible();
      const bounds = await list.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(await list.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo({
        top: document.querySelector('#mugshots-search').getBoundingClientRect().top + window.scrollY - 150,
        behavior: 'instant',
      }));
      fs.mkdirSync('generated-artifacts', { recursive: true });
      await page.screenshot({ path: `generated-artifacts/mugshots-suggestions-${width}-${scale}.jpg`, animations: 'disabled' });
      await page.getByRole('option', { name: 'Talent Dance / Dancer' }).tap();
      await expect(search).toHaveValue('Dance / Dancer');
      await expect(search).toHaveAttribute('aria-expanded', 'false');
      await expect(cardsOn(page)).toHaveCount(catalogue.filter(profile => /\bdanc(?:e|er)s?\b/i.test(profile.link)).length);
    }
    await context.close();
  });
}

test('rendered gallery removes the directory while profile routes and sitemap discovery remain', async ({ request }) => {
  const response = await request.get('/mugshots/all');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).not.toContain('mug-directory-heading');
  expect(html).not.toContain('Every retained profile is linked below');
  expect(html).not.toContain('All celebrity mug photographs');
  expect(html).toContain('aria-label="A–Z"');
  const profile = catalogue.find(item => item.artist === 'Dan Walker');
  const detail = await request.get(`/mugshots/${profile.song}`);
  expect(detail.ok()).toBe(true);
  expect(await detail.text()).toContain(`https://www.santaradio.co.uk/mugshots/${profile.song}`);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain(`/mugshots/${profile.song}`);
});
