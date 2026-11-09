import { test, expect } from '@playwright/test';
import { expandStudioGifts } from './helpers/studio-promotion.js';

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

async function expectPriceFooter(promotion) {
  const layout = await promotion.evaluate(root => {
    const footer = root.querySelector('.santa-studio-promotion__footer');
    const offer = root.querySelector('.santa-studio-promotion__offer');
    const card = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    return {
      last: root.lastElementChild === footer,
      containsPrice: footer.contains(offer),
      footer: footer.getBoundingClientRect().toJSON(),
      price: offer.getBoundingClientRect().toJSON(),
      content: ['details', 'gifts'].map(name =>
        root.querySelector(`.santa-studio-promotion__${name}`).getBoundingClientRect().toJSON()),
      right: card.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
      bottom: card.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom),
      textFits: [...offer.querySelectorAll('span')].every(span => {
        const range = document.createRange();
        range.selectNodeContents(span);
        return [...range.getClientRects()].every(rect =>
          rect.left >= offer.getBoundingClientRect().left &&
          rect.right <= offer.getBoundingClientRect().right + 1);
      }),
    };
  });
  expect(layout.last).toBe(true);
  expect(layout.containsPrice).toBe(true);
  for (const column of layout.content) {
    expect(layout.footer.top).toBeGreaterThanOrEqual(column.bottom - 1);
    expect(layout.footer.left).toBeLessThanOrEqual(column.left + 1);
    expect(layout.footer.right).toBeGreaterThanOrEqual(column.right - 1);
  }
  expect(Math.abs(layout.price.right - layout.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.price.bottom - layout.bottom)).toBeLessThanOrEqual(1);
  expect(layout.price.left).toBeGreaterThanOrEqual(layout.footer.left - 1);
  expect(layout.textFits).toBe(true);
}

for (const path of ['/', '/free-santa-message']) {
  for (const [width, textSize] of [[320, 100], [390, 100], [768, 100], [1440, 100], [320, 200], [1440, 200]]) {
    test(`neutral Studio price footer and gifts fit ${path} at ${width}px with ${textSize}% text`, async ({ page }, testInfo) => {
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
      await page.addStyleTag({ content: `html { font-size: ${textSize}%; }` });
      const promotion = page.locator('.santa-studio-promotion');
      await expectPriceFooter(promotion);
      await expandStudioGifts(promotion);
      await expectPriceFooter(promotion);
      await expect(promotion.locator('.santa-studio-promotion__launch-countdown-remaining')).toHaveCount(0);
      await expectRegularPromotion(promotion);
      for (const selector of ['#santa-studio-title', '.santa-studio-promotion__subheading',
        '.santa-studio-promotion__offer-price']) {
        await expect(promotion.locator(selector)).toHaveCSS('font-weight', '400');
      }
      await expect(promotion.locator('.studio-gifts h4')).toHaveCount(0);
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
      const certificate = await promotion.locator('.studio-gifts__thumbnail--certificate').boundingBox();
      const letter = await promotion.locator('.studio-gifts__thumbnail--letter').boundingBox();
      if (width === 320 && textSize === 200) {
        // Existing gift container query stacks the pair at enlarged text sizes.
        expect(letter.y).toBeGreaterThanOrEqual(box.y + box.height);
        expect(Math.abs(box.width - letter.width)).toBeLessThanOrEqual(1);
      } else {
        expect(box.width / letter.width).toBeGreaterThan(1.8);
        expect(box.width).toBeLessThan(certificate.width);
      }
      expect(box.width).toBeGreaterThan(100);
      expect(await promotion.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const bounds = await promotion.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      // The free-page hero's existing heading overflows at 200% text on 320px.
      // Keep enlarged-text bounds focused on this card; normal-size checks
      // still guard page-wide overflow on both routes.
      if (textSize === 100 || path === '/') {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
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
      await expectPriceFooter(promotion);
    });
  }
}
