import { test, expect } from '@playwright/test';
import rawProfiles from '../src/data/mugshots.json' with { type: 'json' };
import biographies from '../src/data/mugshot-biographies.json' with { type: 'json' };
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const slugs = [
  'alex-james-musician',
  'gyles-brandreth-tv-personality',
  'angry-ginge-celeb-winner',
  'harry-enfield-tv-personality',
  'sam-ryder-musician',
  'paul-nicholas-actor',
  'steve-bracknall-podcaster',
  'paris-fury-boxing-wife',
  'sharon-marshall-queen-of-soaps',
  'tom-swarbrick-tv-personality',
  'bryony-gordon-author',
  'matt-edmondson-and-mollie-king',
  'rylan-tv-star',
  'emma-willis-tv-personality',
  'chris-ramsey-comedian',
];
const featuredSlugs = [
  'rylan-tv-star',
  'emma-willis-tv-personality',
  'gyles-brandreth-tv-personality',
  'harry-enfield-tv-personality',
  'paul-nicholas-actor',
  'alex-james-musician',
  'sam-ryder-musician',
];
const catalogue = buildCatalogue(rawProfiles).catalogue;

test('A-list profiles precede other Mugshots in the app catalogue and gallery', async ({ page }) => {
  const featuredCount = catalogue.filter(profile => profile.homepage === true).length;
  expect(catalogue.slice(0, featuredCount).every(profile => profile.homepage === true)).toBe(true);
  expect(catalogue.slice(featuredCount).every(profile => profile.homepage !== true)).toBe(true);
  const featuredNames = catalogue.slice(0, featuredCount).map(profile => profile.artist);
  expect(featuredNames).toEqual([...featuredNames].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
  for (const slug of featuredSlugs) {
    expect(catalogue.slice(0, featuredCount).some(profile => profile.song === slug), slug).toBe(true);
  }

  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await expect(cards).toHaveCount(100);
  await page.getByRole('button', { name: /Load More/ }).click();
  await expect(cards).toHaveCount(200);
  const randomPaths = await cards.evaluateAll(elements => elements.map(element => element.getAttribute('href')));
  const byPath = new Map(catalogue.map(profile => [`/mugshots/${profile.song}`, profile]));
  expect(randomPaths.slice(0, featuredCount).every(path => byPath.get(path)?.homepage === true)).toBe(true);
  expect(randomPaths.slice(featuredCount).every(path => byPath.get(path)?.homepage !== true)).toBe(true);
  for (const slug of featuredSlugs) expect(randomPaths.slice(0, featuredCount)).toContain(`/mugshots/${slug}`);

  await page.getByRole('button', { name: 'Alphabetical order' }).click();
  await page.getByRole('button', { name: /Load More/ }).click();
  const alphabeticalPaths = await cards.evaluateAll(elements => elements.map(element => element.getAttribute('href')));
  expect(alphabeticalPaths).toEqual(catalogue.slice(0, 200).map(profile => `/mugshots/${profile.song}`));
});

test('all supplied Mugshots are searchable once and their canonical pages share the right image', async ({ page }) => {
  test.setTimeout(120000);
  for (const slug of slugs) {
    const profile = rawProfiles.find(record => record.song === slug);
    expect(profile, slug).toBeTruthy();
    await page.goto('/mugshots/all');
    const search = page.getByRole('textbox', { name: 'Search celebrity names or roles' });
    await search.fill(profile.artist);
    const card = page.locator(`.mugshot-card[href="/mugshots/${slug}"]`);
    await expect(card, slug).toHaveCount(1);
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(`/mugshots/${slug}`);
    await expect(page.locator('h1')).toHaveText(profile.artist);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(biographies[slug]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://www.santaradio.co.uk/mugshots/${slug}`,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    const image = page.locator('.mugshot-detail-photo');
    await expect(image).toHaveAttribute('src', profile.image);
    await expect(image).toHaveAttribute('alt', slug === 'steve-bracknall-podcaster'
      ? 'Chris McClure as Steve Bracknall with a Santa Radio mug'
      : `${profile.artist} with a Santa Radio mug`);
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(profile.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', new RegExp(profile.image.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  }
});

test('the joint profile has two people in its schema and Steve is not schema-typed as a person', async ({ page }) => {
  await page.goto('/mugshots/matt-edmondson-and-mollie-king');
  let graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
    scripts.flatMap(script => JSON.parse(script.textContent)['@graph'] || []));
  expect(graph.filter(node => node['@type'] === 'Person').map(node => node.name)).toEqual([
    'Matt Edmondson',
    'Mollie King',
  ]);

  await page.goto('/mugshots/steve-bracknall-podcaster');
  graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
    scripts.flatMap(script => JSON.parse(script.textContent)['@graph'] || []));
  expect(graph.some(node => node['@type'] === 'Character' && node.name === 'Steve Bracknall')).toBe(true);
  expect(graph.some(node => node['@type'] === 'Person' && node.name === 'Steve Bracknall')).toBe(false);
});
