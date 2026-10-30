import { expect } from '@playwright/test';

const launchLines = [
  'When we launch, you’ll be able to personalise with the age, impressive activities and achievements, your country, county** or State** and download festive gifts.',
  'The paid offer will include a digital personalised Nice List certificate, a short personal letter from Santa and a picture confirming your place on the Nice List. *',
  '* subject to you being good this year',
  '** UK and USA only',
];

export async function expectStudioLaunchCopy(promotion) {
  const copy = promotion.locator('.santa-studio-promotion__copy');
  await expect(copy).toBeVisible();
  expect((await copy.innerText()).split('\n').map(line => line.trim()).filter(Boolean)).toEqual(launchLines);
  await expect(copy.locator('small')).toHaveText(launchLines.slice(2));
  await expect(promotion).not.toContainText('When Studio - A launches');
  await expect(promotion).not.toContainText('have you been good this year?');
  const layout = await copy.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    const notes = [...node.querySelectorAll('small')];
    return {
      fits: [...range.getClientRects()].every(rect =>
        rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
      separateNotes: notes[1].getBoundingClientRect().top >= notes[0].getBoundingClientRect().bottom,
      noteSizes: notes.map(note => parseFloat(getComputedStyle(note).fontSize)),
      noOverflow: node.scrollWidth <= node.clientWidth + 1,
    };
  });
  expect(layout.fits).toBe(true);
  expect(layout.noOverflow).toBe(true);
  expect(layout.separateNotes).toBe(true);
  for (const size of layout.noteSizes) expect(size).toBeGreaterThanOrEqual(13);
}
