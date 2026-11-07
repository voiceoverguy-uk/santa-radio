import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockSantaNames } from './helpers/message-access.js';

const titles = ['Choose their name', 'Make it personal', 'Listen, download and share'];
const copies = [
  'Pick the name Santa will say in their message.',
  'Add their age and something they’re proud of.',
  'Hear Santa’s message, then save it to play again or share.',
];

async function visit(page, { access = false, width = 1440, enlarged = false } = {}) {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-message-access', route => route.fulfill({
    json: { authorized: access, availableAt: 0 },
  }));
  await page.route('**/api/santa-name-count', route => route.fulfill({ json: { total: 9774 } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({
    json: { available: false, current: null, upcoming: [] },
  }));
  await mockSantaNames(page);
  await page.goto('/free-santa-message?name=Olivia');
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

for (const width of [320, 390, 768, 1440]) {
  for (const access of [false, true]) {
    test(`route layout and exact guide copy at ${width}px with access ${access}`, async ({ page }) => {
      await visit(page, { access, width });
      const intro = page.locator('.message-intro');
      await expect(intro.locator('.eyebrow')).toHaveText('A little North Pole experiment');
      await expect(intro.locator('.message-intro-divider')).toHaveText('★');
      await expect(intro.locator('.eyebrow').evaluate(node => node.nextElementSibling.classList.contains('message-intro-divider'))).resolves.toBe(true);
      await expect(intro.locator('.message-intro-divider').evaluate(node => node.nextElementSibling.classList.contains('santa-message-heading'))).resolves.toBe(true);
      await expect(page.locator('.santa-message-example')).toHaveCount(1);
      await expect(intro.locator('.message-studio-intro + .santa-message-example')).toHaveCount(1);
      await expect(page.locator('.santa-message-aside .santa-message-example')).toHaveCount(0);
      await expect(page.locator('.smw-explainer-card')).toHaveCount(3);
      await expect(page.locator('#smw-explainer-title')).toHaveCount(0);
      await expect(page.locator('.smw-explainer-card h3')).toHaveText(titles);
      await expect(page.locator('.smw-explainer-card p')).toHaveText(copies);
      await expect(page.locator('.smw-card-number')).toHaveText(['01', '02', '03']);
      await expect(page.locator('.smw-card-icon svg')).toHaveCount(3);
      if (access) await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Olivia');
      else await expect(page.locator('.santa-message-access')).toBeVisible();
      const geometry = await page.evaluate(() => {
        const rect = node => {
          const { top, bottom, left, right, width, height } = node.getBoundingClientRect();
          return { top, bottom, left, right, width, height };
        };
        return {
          intro: rect(document.querySelector('.message-intro')),
          kicker: rect(document.querySelector('.message-intro > .eyebrow')),
          maker: rect(document.querySelector('.santa-message-box')),
          aside: rect(document.querySelector('.santa-message-aside')),
          cards: [...document.querySelectorAll('.smw-explainer-card')].map(rect),
          promo: rect(document.querySelector('#santa-studio-promotion')),
          reviews: rect(document.querySelector('.santa-message-reviews')),
        };
      });
      const { intro: left, aside, cards, promo } = geometry;
      expect(cards[0].top).toBeGreaterThanOrEqual(Math.max(left.bottom, aside.bottom));
      expect(promo.top).toBeGreaterThan(cards.at(-1).bottom);
      expect(geometry.reviews.top).toBeGreaterThanOrEqual(promo.bottom);
      if (width > 767) {
        expect(geometry.kicker.top).toBeCloseTo(geometry.maker.top, 0);
        expect(left.right).toBeLessThan(aside.left);
        expect(cards[0].left).toBeCloseTo(left.left, 0);
        expect(cards[2].right).toBeCloseTo(aside.right, 0);
        for (const card of cards) {
          expect(card.top).toBeCloseTo(cards[0].top, 0);
          expect(card.width).toBeCloseTo(cards[0].width, 0);
          expect(card.height).toBeCloseTo(cards[0].height, 0);
        }
      } else {
        expect(aside.top).toBeGreaterThan(left.bottom);
        for (let i = 1; i < cards.length; i++) expect(cards[i].top).toBeGreaterThan(cards[i - 1].bottom);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `generated-artifacts/free-layout-${width}-${access}.jpg`, fullPage: true });
    });
  }
}

for (const width of [390, 1440]) {
  test(`enlarged signup, introduction, guide and Studio stay readable at ${width}px`, async ({ page }) => {
    await visit(page, { width, enlarged: true });
    await expect(page.locator('.santa-message-access')).toBeVisible();
    await expect(page.locator('.smw-explainer-card')).toHaveCount(3);
    for (const selector of ['.message-intro', '.santa-message-box', '.smw-explainer-card', '#santa-studio-promotion']) {
      const bounds = await page.locator(selector).evaluateAll(nodes => nodes.map(node => ({
        left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right,
        scroll: node.scrollWidth, client: node.clientWidth,
      })));
      for (const box of bounds) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`enlarged text, lookup, creation, download and cooldown remain contained at ${width}px`, async ({ page }) => {
    await visit(page, { access: true, width, enlarged: true });
    await page.route('**/api/santa-message', route => route.fulfill({
      contentType: 'audio/mpeg', body: readFileSync('server/santa-audio/sleighbells.mp3'),
    }));
    const input = page.getByLabel('First Name', { exact: true });
    await input.fill('Olivia');
    await expect(page.getByRole('option', { name: 'Olivia', exact: true })).toBeVisible();
    await input.press('Escape');
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'To Olivia from Santa' })).toBeVisible();
    const download = page.getByRole('link', { name: 'Download your audio' });
    await expect(download).toHaveAttribute('download', 'Santa-recorded-message-for-Olivia.mp3');
    const downloading = page.waitForEvent('download');
    await download.click();
    expect((await downloading).suggestedFilename()).toBe('Santa-recorded-message-for-Olivia.mp3');
    await expect(page.locator('.message-cooldown-status')).toBeVisible();
    await expect(page.locator('.santa-message-example')).toHaveCount(0);
    await expect(page.locator('.smw-explainer-card')).toHaveCount(3);
    const bounds = await page.locator('.message-intro, .santa-message-box, .smw-explainer-card, #santa-studio-promotion').evaluateAll(nodes =>
      nodes.map(node => ({ scroll: node.scrollWidth, client: node.clientWidth, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })));
    for (const box of bounds) {
      expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('homepage keeps its existing introduction, example position and no guide', async ({ page }) => {
  await visit(page);
  await page.goto('/');
  await expect(page.locator('.message-intro .eyebrow')).toHaveText('A little North Pole experiment');
  await expect(page.locator('.message-intro .santa-voice-tagline + .santa-message-example + .message-free-intro')).toHaveCount(1);
  await expect(page.locator('#santa-messages .smw-explainer-card')).toHaveCount(0);
});
