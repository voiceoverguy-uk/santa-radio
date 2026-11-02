import { expect } from '@playwright/test';

export async function expectStudioLaunchCopy(promotion) {
  const name = await promotion.locator('.studio-gifts').getAttribute('data-demo-name');
  const recipient = await promotion.getAttribute('data-recipient');
  const possessive = `${name}’s`;
  const copy = promotion.locator('.santa-studio-promotion__copy');
  await expect(promotion.locator('.santa-studio-promotion__subheading')).toHaveText(
    `A little more Christmas magic for ${name}`);
  await expect(copy).toHaveText(`Create a personalised message from Santa, with ${possessive} age, achievements and the things that make them special for an extra personal touch.`);
  await expect(promotion.locator('.santa-studio-promotion__benefits-lead strong')).toHaveText(
    'Your paid package includes personalised gifts from Santa:');
  await expect(promotion.locator('.santa-studio-promotion__benefit-list li')).toHaveText([
    'An official Nice List certificate',
    'A short personal letter from Santa',
    `A picture of Santa celebrating ${possessive} place on the Nice List*`,
  ]);
  await expect(promotion.locator('.santa-studio-promotion__footnote')).toHaveText(
    '*Subject to staying on the Nice List, of course.');
  await expect(promotion.locator('.studio-gifts h4')).toHaveText(`All 3 gifts included for ${name} with the paid version`);
  await expect(promotion).not.toContainText('Coming Early November');
  await expect(promotion).not.toContainText('county**');
  await expect(promotion).not.toContainText('UK and USA only');
  if (recipient) expect(name).toBe(recipient);
  await expect(promotion).not.toContainText(/your child/i);
  const geometry = await promotion.evaluate(node => {
    const selectors = '.santa-studio-promotion__subheading, .santa-studio-promotion__copy, ' +
      '.santa-studio-promotion__benefits-lead, .santa-studio-promotion__benefit-list li, .santa-studio-promotion__footnote, .studio-gifts h4';
    return [...node.querySelectorAll(selectors)].map(element => {
      const bounds = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      return { fits: [...range.getClientRects()].every(rect =>
        rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
      overflow: element.scrollWidth > element.clientWidth + 1 };
    });
  });
  for (const element of geometry) {
    expect(element.fits).toBe(true);
    expect(element.overflow).toBe(false);
  }
  const layout = await promotion.evaluate(node => {
    const details = node.querySelector('.santa-studio-promotion__details').getBoundingClientRect();
    const gifts = node.querySelector('.studio-gifts').getBoundingClientRect();
    return { desktop: innerWidth >= 768, details: details.toJSON(), gifts: gifts.toJSON() };
  });
  if (layout.desktop) expect(layout.details.right).toBeLessThanOrEqual(layout.gifts.left + 1);
  else expect(layout.details.bottom).toBeLessThanOrEqual(layout.gifts.top + 1);
}
