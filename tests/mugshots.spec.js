import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseRows, reconcile, repair, plainText, socialUrl } from '../scripts/import-mugshots.js';
import { buildCatalogue, normalizeName } from '../src/data/mugshot-catalogue.js';
import { collectionMetadata, mugMetadata } from '../src/seo/catalogue.js';

const catalogue = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
const report = JSON.parse(fs.readFileSync('reports/mugshot-import.json', 'utf8'));
const publicData = buildCatalogue(catalogue);
const overrides = JSON.parse(fs.readFileSync('src/data/mugshot-biographies.json', 'utf8'));

test('homepage and gallery decode the same-origin Mug Shots logo without the retired remote request', async ({ page }) => {
  const remoteRequests = [];
  page.on('request', request => {
    if (request.url().includes('/santa-radio-celebrity-mugshots.png')) remoteRequests.push(request.url());
  });
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '' }));
  for (const [path, selector, alt] of [
    ['/', '.mugshots-header-img', 'Celebrity Mugshots'],
    ['/mugshots/all', '.mugshots-page-logo', 'Mug Shots'],
  ]) {
    const responsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/mugshot-images/santa-mugshots-logo-1.png');
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\/png/);
    const logo = page.locator(selector);
    await expect(logo).toHaveAttribute('src', '/mugshot-images/santa-mugshots-logo-1.png');
    await expect(logo).toHaveAttribute('alt', alt);
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(async image => {
      await image.decode();
      return image.naturalWidth > 0 && image.naturalHeight > 0 &&
        new URL(image.currentSrc).origin === location.origin;
    })).toBe(true);
  }
  expect(remoteRequests).toEqual([]);
});

test('canonical catalogue excludes empty profiles and preserves retained details', () => {
  expect(publicData.catalogue).toHaveLength(664);
  expect(new Set(publicData.catalogue.map(m => normalizeName(m.artist))).size).toBe(664);
  expect(publicData.removed).toHaveLength(37);
  expect(publicData.catalogue.every(m => m.info.trim())).toBe(true);
  for (const old of catalogue) {
    const kept = publicData.catalogue.find(m => m.song === publicData.aliases[old.song]);
    if (!kept) {
      expect((old.info || '').trim()).toBe('');
      continue;
    }
    expect(kept).toBeTruthy();
    if (old.info) expect(kept.info).toBe(overrides[kept.song] || old.info);
    if (old.image) {
      expect(kept.image).toBeTruthy();
      expect(fs.existsSync(`public${kept.image}`)).toBe(true);
    }
  }
  const rows = parseRows(fs.readFileSync('attached_assets/cl57-mugshots_1791308171421.sql', 'utf8'));
  const imported = buildCatalogue(reconcile(catalogue, rows).output);
  const withoutSearchNames = records => records.map(({ searchNames, ...profile }) => profile);
  expect(withoutSearchNames(imported.catalogue)).toEqual(withoutSearchNames(publicData.catalogue));
  for (const [slug, sourceName] of [
    ['angry-ginge-celeb-winner', 'AngryGinge'],
    ['rylan-tv-star', 'Rylan Clark'],
  ]) expect(imported.catalogue.find(profile => profile.song === slug).searchNames).toContain(sourceName);
  expect(imported.aliases).toEqual(publicData.aliases);
  expect(imported.conflicts).toEqual(publicData.conflicts);
  expect(imported.removed).toEqual(publicData.removed);
  const audit = JSON.parse(fs.readFileSync('reports/mugshot-audit.json'));
  expect(audit.review).toHaveLength(636);
  expect(audit.review.find(r => r.name === 'Johannes Radebe').words).toBeGreaterThan(35);
  expect(audit.review.find(r => r.name === 'Jack Dee').reason).toContain('Jason Tindall');
});

test('reported duplicate searches show one photo card and old links show full details', async ({ page }) => {
  for (const [name, alias] of [['Batman', 'batman-super-hero'], ['Bernie Clifton', 'bernie-clifton'], ['Bobby Ball', 'bobby-ball']]) {
    await page.goto('/mugshots/all');
    await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill(name);
    await expect(page.locator('.mugshot-card')).toHaveCount(1);
    const img = page.locator('.mugshot-photo');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`/mugshots/${alias}`);
    const kept = publicData.catalogue.find(m => m.song === publicData.aliases[alias]);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(kept.info);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.santaradio.co.uk/mugshots/${kept.song}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await expect(page.locator('.mugshots-preview')).toContainText('664');
});

test('import preserves routes and images and safely handles source text', () => {
  expect(catalogue).toHaveLength(762);
  expect(report.matched).toBe(672);
  expect(new Set(catalogue.map(m => m.song)).size).toBe(762);
  for (const entry of report.matches) {
    const m = catalogue.find(m => m.song === entry.slug);
    expect(m.image).toBe(entry.image);
    expect(m.socialUrl === '' || /^https:\/\/x\.com\/[a-z0-9_]{1,15}$/i.test(m.socialUrl)).toBe(true);
  }
  expect(repair('UKâ€™s cafÃ©')).toBe('UK’s café');
  expect(plainText('<script>alert(1)</script><a href="javascript:x">Photo: A &amp; B</a>')).toBe('Photo: A & B');
  expect(socialUrl('https://evil.example/person')).toBe('');
  expect(socialUrl('@Valid_Name')).toBe('https://x.com/Valid_Name');
  expect(socialUrl('@Broken handle')).toBe('');
  expect(() => parseRows("INSERT INTO `messages2` VALUES (1,'broken")).toThrow();
  const rows = parseRows(fs.readFileSync('attached_assets/cl57-mugshots_1791308171421.sql', 'utf8'));
  expect(rows).toHaveLength(664);
  const { output } = reconcile(catalogue, rows);
  expect(output).toEqual(catalogue);
});

test('full biographies, photo credits, safe social links and mobile layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const slug of ['steve-davis-snoker-player', 'jeremy-kyle-tv-personality']) {
    const m = catalogue.find(m => m.song === slug);
    await page.goto(`/mugshots/${slug}`);
    await expect(page.locator('.mugshot-detail-desc')).toHaveText(overrides[publicData.aliases[m.song]] || m.info);
    await expect(page.locator('.mugshot-photo-credit')).toContainText('Bruce Davis');
    await expect(page.getByRole('link', { name: `Follow ${m.artist} on X` })).toHaveAttribute('href', m.socialUrl);
    await expect(page.locator('.mugshot-detail-photo')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/mugshots/alesha-santa');
  await expect(page.getByRole('heading', { name: 'Celebrity Not Found' })).toBeVisible();
  await expect(page.locator('.mugshot-social')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Davina has one complete profile and zero-word URLs are unavailable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/mugshots/all');
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Davina');
  await expect(page.locator('.mugshot-card')).toHaveCount(1);
  await expect(page.locator('.mugshot-card')).toContainText('Davina McCall');
  await page.locator('.mugshot-card').click();
  await expect(page).toHaveURL(/davina-mccall-tv-presenter$/);
  await expect(page.locator('.mugshot-detail-desc')).toContainText('Big Brother');
  await expect.poll(() => page.locator('.mugshot-detail-photo').evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  for (const m of publicData.removed) {
    await page.goto(`/mugshots/${m.song}`);
    await expect(page.getByRole('heading', { name: 'Celebrity Not Found' })).toBeVisible();
  }
});

test('gallery pagination, search, hover, focus and motion preferences', async ({ page }) => {
  await page.goto('/mugshots/all');
  const cards = page.locator('.mugshot-card');
  await expect(cards).toHaveCount(100);
  await page.getByRole('button', { name: /Load More/ }).click();
  await expect(cards).toHaveCount(200);
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).fill('Jeremy Kyle');
  await expect(cards).toHaveCount(1);
  const card = cards.first(), frame = card.locator('.mugshot-photo-frame');
  const animation = () => frame.evaluate(el => getComputedStyle(el, '::after').animationName);
  expect(await animation()).toBe('none');
  await card.hover();
  expect(await animation()).toBe('mugshot-edge-shimmer');
  await page.getByRole('switch', { name: 'Snow', checked: true }).click();
  await card.hover();
  expect(await animation()).toBe('none');
  await expect(card).toHaveCSS('transform', 'none');
  await page.getByRole('switch', { name: 'Snow', checked: false }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.hover();
  expect(await animation()).toBe('none');
  await expect(card).toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0);
  await page.getByRole('textbox', { name: 'Search celebrity names or roles' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Random order', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Alphabetical order', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card).toHaveCSS('outline-style', 'solid');
  await card.click();
  await expect(page).toHaveURL(/mugshots\/jeremy-kyle-tv-personality$/);
});

test('gallery header hides its visible breadcrumb, preserves SEO metadata, and adapts its controls', async ({ page }) => {
  for (const width of [1280, 768, 601, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/mugshots/all', { waitUntil: 'domcontentloaded' });

    const main = page.locator('main');
    const hero = page.locator('.mugshots-page-hero');
    const controls = page.locator('.mugshots-controls');
    const search = page.getByRole('textbox', { name: 'Search celebrity names or roles' });
    const order = page.getByRole('group', { name: 'Mugshot order' });
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
    expect(await main.evaluate(el => el.firstElementChild.classList.contains('mugshots-page-hero'))).toBe(true);

    const graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
      scripts.flatMap(script => JSON.parse(script.textContent)['@graph'] || []));
    expect(graph.find(node => node['@type'] === 'BreadcrumbList')).toEqual(
      collectionMetadata('mugs').graph.find(node => node['@type'] === 'BreadcrumbList'));

    const searchBox = await search.boundingBox();
    const orderBox = await order.boundingBox();
    expect(searchBox).toBeTruthy();
    expect(orderBox).toBeTruthy();
    expect(orderBox.x + orderBox.width).toBeLessThanOrEqual(width);
    if (width > 600) {
      expect(orderBox.x).toBeGreaterThan(searchBox.x + searchBox.width);
      expect(Math.abs(orderBox.y + orderBox.height / 2 - searchBox.y - searchBox.height / 2)).toBeLessThan(1);
    } else {
      expect(orderBox.y).toBeGreaterThan(searchBox.y + searchBox.height);
      for (const button of await order.locator('button').all()) {
        expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    }

    await search.fill('Jeremy Kyle');
    await expect(page.locator('.mugshot-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Alphabetical order', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Alphabetical order', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(hero).toBeVisible();
    await expect(controls).toBeVisible();
  }
});

const breadcrumbFreeProfiles = ['romesh-ranganathan-comedian', 'jeremy-kyle-tv-personality']
  .map(slug => publicData.catalogue.find(profile => profile.song === publicData.aliases[slug]));

test('profile server markup omits the breadcrumb row but retains content and SEO', async ({ request }) => {
  for (const profile of breadcrumbFreeProfiles) {
    const metadata = mugMetadata(profile);
    const response = await request.get(metadata.path);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).not.toMatch(/class="[^"]*(?:seo-breadcrumbs|mugshot-breadcrumb)/);
    expect(html).not.toContain('aria-label="Breadcrumb"');
    expect(html).toMatch(/<main>\s*<div class="mugshot-detail-page starry-bg">/);
    expect(html).toContain(`<title data-rh="true">${metadata.title}</title>`);
    expect(html).toContain(`href="${metadata.url}"`);
    expect(html).toContain('class="mugshot-detail-desc"');
    expect(html).toContain(`src="${profile.image}"`);
    expect(html).toContain('aria-label="Browse Mugshots"');
    expect(html).toContain('Back to all Mug Shots');
    const graph = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .flatMap(([, json]) => JSON.parse(json)['@graph'] || []);
    expect(graph.find(node => node['@type'] === 'BreadcrumbList')).toEqual(
      metadata.graph.find(node => node['@type'] === 'BreadcrumbList'));
  }
});

for (const width of [1280, 390]) {
  test(`profiles have no breadcrumb strip and retain navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const profile of breadcrumbFreeProfiles) {
      const metadata = mugMetadata(profile);
      await page.goto(metadata.path, { waitUntil: 'domcontentloaded' });
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
      await expect(page.locator('.seo-breadcrumbs, .mugshot-breadcrumb')).toHaveCount(0);
      // The profile is the first main child; only its original 40px top padding remains.
      expect(await page.locator('main').evaluate(main =>
        main.firstElementChild.matches('.mugshot-detail-page') &&
        main.children.length === 1)).toBe(true);
      expect(await page.locator('.mugshot-detail-card').evaluate(card =>
        card.getBoundingClientRect().top -
        card.closest('.mugshot-detail-page').getBoundingClientRect().top)).toBeCloseTo(40, 0);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.artist);
      await expect(page.locator('.mugshot-detail-desc')).toHaveText(profile.info);
      const photo = page.locator('.mugshot-detail-photo');
      await expect(photo).toHaveAttribute('src', profile.image);
      await expect.poll(() => photo.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      await expect(page).toHaveTitle(metadata.title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', metadata.url);
      const graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
        scripts.flatMap(script => JSON.parse(script.textContent)['@graph'] || []));
      expect(graph.find(node => node['@type'] === 'BreadcrumbList')).toEqual(
        metadata.graph.find(node => node['@type'] === 'BreadcrumbList'));
      const index = publicData.catalogue.indexOf(profile);
      for (const [direction, neighbour] of [
        ['Previous', publicData.catalogue[index - 1]],
        ['Next', publicData.catalogue[index + 1]],
      ]) {
        const link = page.getByRole('link', { name: `${direction} Mugshot: ${neighbour.artist}` });
        await expect(link).toHaveAttribute('href', `/mugshots/${neighbour.song}`);
        await link.click();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(neighbour.artist);
        await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0);
        await page.goBack();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(profile.artist);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('link', { name: '← Back to all Mug Shots', exact: true }).click();
      await expect(page).toHaveURL(/\/mugshots\/all$/);
      await expect(page.locator('.mugshots-page-hero')).toBeVisible();
    }
  });
}

test('missing photos keep a usable fallback', async ({ page }) => {
  await page.route('**/mugshot-images/**', route => route.abort());
  await page.goto('/mugshots/jeremy-kyle-tv-personality');
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await page.goto('/mugshots/all');
  await expect(page.locator('.mugshot-fallback').first()).toBeVisible();
});
