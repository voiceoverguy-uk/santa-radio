import { test, expect } from '@playwright/test';
import { mugPhotoLicense, mugPhotoTermsPath, mugs } from '../src/seo/catalogue.js';

async function expectPhotographs(page, slug) {
  const mug = mugs.find(mug => mug.song === slug);
  await expect.poll(async () => {
    const graph = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
      scripts.flatMap(script => JSON.parse(script.textContent)['@graph']));
    return graph.filter(node => node['@type'] === 'ImageObject' && node['@id'].includes(`/mugshots/${slug}#`));
  }).toEqual(expect.arrayContaining([
    expect.objectContaining({ '@id': `https://www.santaradio.co.uk/mugshots/${slug}#image`, license: mugPhotoLicense }),
    expect.objectContaining({ '@id': `https://www.santaradio.co.uk/mugshots/${slug}#photograph`, license: mugPhotoLicense,
      ...(mug.credit ? { creditText: `Photo credit: ${mug.credit}` } : {}) }),
  ]));
}

async function expectCleanProfile(page, mug) {
  const card = page.locator('.mugshot-detail-card');
  await expect(card.getByRole('link', { name: 'Photo usage and licensing' })).toHaveCount(0);
  await expect(card.locator('a[href^="http"], .mugshot-social')).toHaveCount(0);
  await expect(card).not.toContainText('Legacy social link (identity unverified)');
  const caption = card.locator('figcaption');
  if (mug.credit?.trim()) await expect(caption).toHaveText(`Photo credit: ${mug.credit.trim()}`);
  else await expect(caption).toHaveCount(0);
  await expect(card.locator('h1')).toHaveText(mug.artist);
  if (mug.link) await expect(card.locator('.mugshot-detail-role')).toHaveText(mug.link);
  await expect(card.locator('.mugshot-detail-desc')).toHaveText(mug.info?.trim() ||
    `${mug.artist} posing with the iconic Santa Radio mug as part of our Celebrity Mug Shots Hall of Fame!`);
  const photo = card.locator('img');
  await expect(photo).toHaveAttribute('src', mug.image);
  await expect.poll(() => photo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(card.locator('.back-link')).toHaveAttribute('href', '/mugshots/all');
  await expect(page.locator('footer').getByRole('link', { name: 'Privacy Policy', exact: true }))
    .toHaveAttribute('href', '/privacy-policy');
  await expect(page.locator('footer .footer-social a')).toHaveCount(2);
}

test('photo terms and licensing metadata survive hydrated navigation and reach general contact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/mugshots/a1-singers');
  await expect(page.locator('.mugshot-photo-credit')).toContainText('Photo credit: Bruce Davis');
  await expectPhotographs(page, 'a1-singers');
  await page.evaluate(() => { window.licensingNavigationCheck = true; });
  await expectCleanProfile(page, mugs.find(mug => mug.song === 'a1-singers'));
  await page.locator('footer').getByRole('link', { name: 'Photo usage and licensing', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${mugPhotoTermsPath}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo usage and licensing');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', mugPhotoLicense);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await page.getByRole('link', { name: 'general enquiry contact form to request photo permission' }).click();
  await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expectPhotographs(page, 'a1-singers');
  await page.locator('.mugshot-neighbour-next').click();
  await expectPhotographs(page, mugs[mugs.findIndex(mug => mug.song === 'a1-singers') + 1].song);
  await expectCleanProfile(page, mugs[mugs.findIndex(mug => mug.song === 'a1-singers') + 1]);
  expect(await page.evaluate(() => window.licensingNavigationCheck)).toBe(true);
  expect(errors).toEqual([]);
});

test('terms and existing non-Bruce credits remain readable without JavaScript on mobile', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/mugshots/amelia-lily-singer');
  await expect(page.locator('.mugshot-photo-credit')).toContainText('Photo credit: Photo: Matthew Stone');
  await expectCleanProfile(page, mugs.find(mug => mug.song === 'amelia-lily-singer'));
  await page.locator('footer').getByRole('link', { name: 'Photo usage and licensing', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo usage and licensing');
  await expect(page.locator('article')).toContainText('Except where applicable law permits otherwise');
  // Vite injects CSS through JavaScript; measure our readable article rather
  // than unrelated unstyled navigation when exercising development SSR.
  expect(await page.locator('article').evaluate(article => article.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'general enquiry contact form to request photo permission' }).click();
  await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
  await context.close();
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`clean profiles and Previous/Next navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const representatives = [
      mugs.find(mug => mug.artist === 'Mungo Jerry'),
      mugs.find(mug => mug.song === 'a1-singers'),
      mugs.find(mug => mug.song === 'amelia-lily-singer'),
      mugs.find(mug => !mug.credit?.trim()),
    ];
    for (const mug of representatives) {
      await page.goto(`/mugshots/${mug.song}`);
      const declineCookies = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await declineCookies.isVisible()) await declineCookies.click();
      await expectCleanProfile(page, mug);
      await page.evaluate(() => { window.profileNavigationCheck = true; });
      const next = mugs[mugs.indexOf(mug) + 1];
      await page.locator('.mugshot-neighbour-next').evaluate(link =>
        link.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.locator('.mugshot-neighbour-next').click();
      await expect(page).toHaveURL(`/mugshots/${next.song}`);
      await expectCleanProfile(page, next);
      await page.locator('.mugshot-neighbour-previous').evaluate(link =>
        link.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.locator('.mugshot-neighbour-previous').click();
      await expect(page).toHaveURL(`/mugshots/${mug.song}`);
      await expectCleanProfile(page, mug);
      expect(await page.evaluate(() => window.profileNavigationCheck)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator('.back-link').click();
    await expect(page).toHaveURL('/mugshots/all');
  });
}

test('representative profiles render cleanly without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    for (const mug of [
      mugs.find(mug => mug.artist === 'Mungo Jerry'),
      mugs.find(mug => mug.song === 'a1-singers'),
      mugs.find(mug => !mug.credit?.trim()),
    ]) {
      await page.goto(`/mugshots/${mug.song}`);
      await expectCleanProfile(page, mug);
      await expectPhotographs(page, mug.song);
    }
    const nextHref = await page.locator('.mugshot-neighbour-next').getAttribute('href');
    await page.locator('.mugshot-neighbour-next').click();
    await expect(page).toHaveURL(nextHref);
    await expectCleanProfile(page, mugs.find(mug => `/mugshots/${mug.song}` === nextHref));
  } finally {
    await context.close();
  }
});
