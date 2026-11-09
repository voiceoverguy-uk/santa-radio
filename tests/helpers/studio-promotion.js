import { expect } from '@playwright/test';

export async function expandStudioGifts(promotion) {
  const toggle = promotion.getByRole('button', { name: 'Free gifts include', exact: true });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.click();
  }
}

export async function expectStudioLaunchCopy(promotion) {
  await expandStudioGifts(promotion);
  const name = await promotion.locator('.studio-gifts').getAttribute('data-demo-name');
  const recipient = await promotion.getAttribute('data-recipient');
  const possessive = `${name}’s`;
  const copy = promotion.locator('.santa-studio-promotion__copy');
  await expect(promotion.locator('.santa-studio-promotion__subheading')).toHaveText(
    `A little more Christmas magic for ${name}`);
  await expect(copy).toHaveText(`Create a personalised message from Santa, with ${possessive} age, achievements and the things that make them special for an extra personal touch.`);
  await expect(promotion.locator('.santa-studio-promotion__benefits-lead')).toHaveText(
    'Each message comes with free gifts for one child:');
  await expect(promotion.locator('.santa-studio-promotion__benefit-list li')).toHaveText([
    'An official Nice List certificate',
    'A short personal letter from Santa',
    `Santa celebrating ${possessive} place on the Nice List`,
  ]);
  await expect(promotion.locator('.santa-studio-promotion__footnote')).toHaveCount(0);
  await expect(promotion.locator('.studio-gifts h4')).toHaveCount(0);
  await expect(promotion.locator('.studio-gifts__thumbnail-label')).toHaveText([
    'Santa picture included', 'Letter included', 'Certificate included',
  ]);
  await expect(promotion).not.toContainText('Coming Early November');
  await expect(promotion).not.toContainText('county**');
  await expect(promotion).not.toContainText('UK and USA only');
  if (recipient) expect(name).toBe(recipient);
  await expect(promotion).not.toContainText(/your child/i);
  const geometry = await promotion.evaluate(node => {
    const selectors = '.santa-studio-promotion__subheading, .santa-studio-promotion__copy, ' +
      '.santa-studio-promotion__benefits-lead, .santa-studio-promotion__benefit-list li, .studio-gifts__thumbnail-label';
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
