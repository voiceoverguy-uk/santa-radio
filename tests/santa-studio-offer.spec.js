import { test, expect } from '@playwright/test';

async function expectRegularPromotion(promotion) {
  // Check live text only, not document artwork, script overlays or watermarks.
  const weights = await promotion.evaluate(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const result = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!node.textContent.trim() || element.closest(
        '.studio-certificate, .studio-letter__paper, .studio-santa-picture, .studio-gifts__watermark'
      )) continue;
      result.push({ text: node.textContent.trim(), weight: getComputedStyle(element).fontWeight });
    }
    for (const input of root.querySelectorAll('input')) {
      result.push({ text: 'Voucher input', weight: getComputedStyle(input).fontWeight });
      result.push({ text: 'Voucher placeholder', weight: getComputedStyle(input, '::placeholder').fontWeight });
    }
    return result;
  });
  expect(weights.length).toBeGreaterThan(20);
  expect(weights.filter(item => item.weight !== '400')).toEqual([]);
}

for (const path of ['/', '/free-santa-message']) {
  for (const width of [320, 390, 1440]) {
    test(`neutral Studio price and smaller picture fit ${path} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.clock.setFixedTime(new Date('2026-11-03T12:00:00Z'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
      await page.route('**/api/radio-metadata*', route => route.fulfill({
        json: { available: false, current: null, upcoming: [] },
      }));
      await page.route('**/api/santa-studio-checkout', route => route.fulfill(
        route.request().method() === 'GET'
          ? { json: { available: true, sandbox: true } }
          : { status: 503, json: { error: 'Controlled checkout refusal' } }
      ));
      await page.route('**/api/santa-workshop-access', route => route.fulfill({
        status: 401, json: { authorized: false },
      }));
      await page.goto(path);
      const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
      if (await decline.isVisible()) await decline.click();
      await page.evaluate(() => document.fonts.ready);
      const promotion = page.locator('.santa-studio-promotion');
      await expect(promotion.locator('.santa-studio-promotion__launch-countdown-remaining')).toHaveText('2 days, 12 hours, 0 minutes.');
      await expectRegularPromotion(promotion);
      for (const selector of ['#santa-studio-title', '.santa-studio-promotion__subheading',
        '.santa-studio-promotion__offer-price', '.studio-gifts h4']) {
        await expect(promotion.locator(selector)).toHaveCSS('font-weight', '400');
      }
      const price = promotion.locator('.santa-studio-promotion__offer');
      await expect(price).toHaveText('Price£6.50');
      await expect(price.getByText('£6.50', { exact: true })).toBeVisible();
      await expect(price).toMatchAriaSnapshot('- text: Price £6.50');
      const staleOffer = /Black Friday|£4\.50/i;
      await expect(promotion).not.toContainText(staleOffer);
      expect(await promotion.ariaSnapshot()).not.toMatch(staleOffer);
      const accessibleLabels = await promotion.evaluate(root =>
        [root, ...root.querySelectorAll('[aria-label], [title], [alt]')]
          .flatMap(element => ['aria-label', 'title', 'alt'].map(attr => element.getAttribute(attr) || ''))
          .join('\n'));
      expect(accessibleLabels).not.toMatch(staleOffer);
      await expect(promotion.getByRole('button', { name: 'Enlarge certificate', exact: true })).toBeVisible();
      await expect(promotion.getByRole('button', { name: 'Enlarge letter to read', exact: true })).toBeVisible();
      const picture = promotion.getByRole('button', { name: 'Enlarge Santa’s Nice List picture', exact: true });
      const box = await picture.boundingBox();
      expect(box.width).toBeLessThanOrEqual(280);
      expect(box.width).toBeGreaterThan(100);
      expect(await promotion.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const bounds = await promotion.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await promotion.screenshot({ path: testInfo.outputPath('studio-price.jpg'), animations: 'disabled' });
      await picture.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').locator('.studio-santa-picture')).toBeVisible();
      await expectRegularPromotion(promotion);
      await expect(page.getByRole('dialog').locator('.studio-gifts__watermark span').first()).toHaveCSS('font-weight', '800');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await promotion.getByLabel('Voucher code', { exact: true }).fill('invalid-test-only');
      await promotion.getByRole('button', { name: 'Create your bespoke message', exact: true }).click();
      await expect(promotion.getByRole('alert')).toContainText('not recognised');
      await promotion.getByRole('button', { name: 'Purchase — £6.50 (test)', exact: true }).click();
      await expect(promotion.getByRole('alert').filter({ hasText: 'Controlled checkout refusal' })).toBeVisible();
      await expectRegularPromotion(promotion);
    });
  }
}
