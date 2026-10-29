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

test('photo terms and licensing metadata survive hydrated navigation and reach general contact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/mugshots/a1-singers');
  await expect(page.locator('.mugshot-photo-credit')).toContainText('Photo credit: Bruce Davis');
  await expectPhotographs(page, 'a1-singers');
  await page.evaluate(() => { window.licensingNavigationCheck = true; });
  await page.locator('.mugshot-photo-credit a').click();
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
  expect(await page.evaluate(() => window.licensingNavigationCheck)).toBe(true);
  expect(errors).toEqual([]);
});

test('terms and existing non-Bruce credits remain readable without JavaScript on mobile', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/mugshots/amelia-lily-singer');
  await expect(page.locator('.mugshot-photo-credit')).toContainText('Photo credit: Photo: Matthew Stone');
  await page.locator('.mugshot-photo-credit a').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo usage and licensing');
  await expect(page.locator('article')).toContainText('Except where applicable law permits otherwise');
  // Vite injects CSS through JavaScript; measure our readable article rather
  // than unrelated unstyled navigation when exercising development SSR.
  expect(await page.locator('article').evaluate(article => article.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'general enquiry contact form to request photo permission' }).click();
  await expect(page.getByRole('radio', { name: 'General enquiry', exact: true })).toBeChecked();
  await context.close();
});
