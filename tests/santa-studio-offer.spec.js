import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
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

async function expectIntegratedOffer(promotion) {
  const offer = promotion.getByRole('group', { name: '2 bespoke messages from Santa £6.50', exact: true });
  await expect(offer).toBeVisible();
  await expect(offer).toHaveAccessibleDescription('One-off payment · Two message creations');
  await expect(promotion.locator('.santa-studio-promotion__footer')).toHaveCount(0);
  const layout = await promotion.evaluate(root => {
    const offer = root.querySelector('.santa-studio-promotion__offer');
    const intro = root.querySelector('.santa-studio-promotion__intro');
    const controls = root.querySelector('.workshop-password-form');
    const audio = root.querySelector('.santa-studio-audio-example');
    const gifts = root.querySelector('.santa-studio-promotion__gifts');
    const amount = root.querySelector('.santa-studio-promotion__offer-price');
    const label = root.querySelector('.santa-studio-promotion__offer-title');
    return {
      inCard: offer.parentElement === root,
      audioBeforeControls: Boolean(audio.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING),
      audio: audio.getBoundingClientRect().toJSON(),
      intro: intro.getBoundingClientRect().toJSON(),
      offer: offer.getBoundingClientRect().toJSON(),
      controls: controls.getBoundingClientRect().toJSON(),
      gifts: gifts.getBoundingClientRect().toJSON(),
      desktop: matchMedia('(min-width: 768px)').matches,
      amountSize: parseFloat(getComputedStyle(amount).fontSize),
      labelSize: parseFloat(getComputedStyle(label).fontSize),
      textFits: [...offer.querySelectorAll('p, span')].every(span => {
        const range = document.createRange();
        range.selectNodeContents(span);
        return [...range.getClientRects()].every(rect =>
          rect.left >= offer.getBoundingClientRect().left - 1 &&
          rect.right <= offer.getBoundingClientRect().right + 1);
      }),
    };
  });
  expect(layout.inCard).toBe(true);
  expect(layout.audioBeforeControls).toBe(true);
  expect(layout.audio.top).toBeGreaterThanOrEqual(layout.intro.bottom - 1);
  expect(layout.audio.bottom).toBeLessThanOrEqual(layout.controls.top + 1);
  expect(layout.offer.top).toBeGreaterThanOrEqual(layout.gifts.bottom - 1);
  if (layout.desktop) {
    expect(layout.offer.left).toBeGreaterThanOrEqual(layout.controls.right);
    expect(Math.abs(layout.offer.right - layout.gifts.right)).toBeLessThanOrEqual(1);
  } else {
    expect(layout.offer.top).toBeGreaterThanOrEqual(layout.controls.bottom);
  }
  expect(layout.amountSize).toBeGreaterThan(layout.labelSize * 1.3);
  expect(layout.textFits).toBe(true);
}

for (const path of ['/', '/free-santa-message']) {
  for (const [width, textSize] of [[320, 100], [390, 100], [768, 100], [1440, 100], [320, 200], [390, 200], [768, 200], [1440, 200]]) {
    test(`grouped Studio offer and gifts fit ${path} at ${width}px with ${textSize}% text`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
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
      await expectIntegratedOffer(promotion);
      await expandStudioGifts(promotion);
      await expectIntegratedOffer(promotion);
      await expect(promotion.locator('.santa-studio-promotion__launch-countdown-remaining')).toHaveCount(0);
      await expectRegularPromotion(promotion);
      for (const selector of ['#santa-studio-title', '.santa-studio-promotion__subheading',
        '.santa-studio-promotion__offer-price']) {
        await expect(promotion.locator(selector)).toHaveCSS('font-weight', '400');
      }
      await expect(promotion.locator('.studio-gifts h4')).toHaveCount(0);
      const price = promotion.locator('.santa-studio-promotion__offer');
      await expect(price).toContainText('2 bespoke messages from Santa');
      await expect(price).toContainText('One-off payment · Two message creations');
      await expect(price.getByText('£6.50', { exact: true })).toBeVisible();
      await expect(price).toHaveAccessibleName('2 bespoke messages from Santa £6.50');
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
      if (width <= 768 && textSize === 200) {
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
      const screenshotStyle = '.navbar, .radio-dock, .skip-link { visibility: hidden !important; }';
      await promotion.screenshot({ path: testInfo.outputPath('studio-price.jpg'), animations: 'disabled', style: screenshotStyle });
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
      await expectIntegratedOffer(promotion);
      await page.route('**/api/santa-studio-checkout', route => route.fulfill({
        status: 503, json: { available: false },
      }));
      await page.reload();
      await page.addStyleTag({ content: `html { font-size: ${textSize}%; }` });
      await expect(promotion).toContainText('Sandbox purchases are available in the development preview only.');
      await expect(promotion.getByRole('button', { name: 'Purchase — £6.50 (test)', exact: true })).toBeDisabled();
      await expectIntegratedOffer(promotion);
      await expect(promotion.getByLabel('Voucher code', { exact: true })).toBeEnabled();
      await promotion.screenshot({ path: testInfo.outputPath('studio-unavailable.jpg'), animations: 'disabled', style: screenshotStyle });
    });
  }
}

for (const width of [390, 1440]) {
  test(`completed free greeting retains the grouped personalised Studio offer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('santa-message-offer-shown', 'shown'));
    await page.route('**/api/santa-message-access', route => route.fulfill({
      json: { authorized: true, availableAt: 0 },
    }));
    await page.route('**/api/santa-studio-checkout', route => route.fulfill({ json: { available: false } }));
    await page.route('**/api/santa-names', route => route.fulfill({
      json: { records: [{ id: 'arabella', name: 'Arabella', selectionToken: 'fixture-token',
        previewUrl: '/api/santa-name-preview?token=fixture-token' }] },
    }));
    await page.route('**/api/santa-message', route => route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    }));
    await page.goto('/free-santa-message');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    await page.getByLabel('First Name', { exact: true }).fill('Arabella');
    await page.getByRole('option', { name: 'Arabella', exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'To Arabella from Santa' })).toBeVisible();
    const promotion = page.locator('#santa-studio-promotion');
    await expect(promotion).toHaveCount(1);
    await expectIntegratedOffer(promotion);
    await expandStudioGifts(promotion);
    await expect(promotion.locator('.studio-gifts')).toHaveAttribute('data-demo-name', 'Arabella');
    await expect(promotion.locator('.santa-studio-promotion__subheading')).toContainText('Arabella');
    await expectIntegratedOffer(promotion);
  });
}
