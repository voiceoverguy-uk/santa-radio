import { test, expect } from '@playwright/test';
import { unlockWorkshop } from './helpers/workshop-access.js';

test('shared guide extraction keeps the Workshop heading, equal desktop cards and hidden phone guide', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await unlockWorkshop(page);
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/santa-message-workshop');
  await expect(page.locator('#smw-explainer-title')).toHaveText('A little Christmas magic, in three steps');
  await expect(page.locator('.smw-explainer-card')).toHaveCount(3);
  await expect(page.locator('.smw-explainer')).toBeVisible();
  await expect(page.locator('.smw-explainer-card h3')).toHaveText([
    'Start with their name', 'Add the little details', 'Check your Christmas creation',
  ]);
  const cards = await page.locator('.smw-explainer-card').evaluateAll(nodes => nodes.map(node => {
    const { top, height, width } = node.getBoundingClientRect();
    return { top, height, width, color: getComputedStyle(node.querySelector('h3')).color };
  }));
  for (const card of cards) {
    expect(card.top).toBe(cards[0].top);
    expect(card.height).toBe(cards[0].height);
    expect(card.width).toBeCloseTo(cards[0].width, 0);
    expect(card.color).toBe('rgb(255, 248, 231)');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.smw-explainer')).toBeHidden();
  await expect(page.locator('.smw-footer-note')).toBeHidden();
});
