import { expect } from '@playwright/test';

export async function expectStudioHeader(page, sandbox = false) {
  const header = page.locator('.smw-intro');
  await expect(header.locator('h1')).toHaveText('Santa’s Message Maker Studio');
  await expect(header.locator('.smw-intro-copy')).toHaveCount(0);
  await expect(header).not.toContainText(/It['’]s all about the little details/i);
  await expect(header).not.toContainText(/It['’]s the little details that matter/i);
  await expect(header).not.toContainText(/friends.only|friends.only Message Maker|give us some feedback/i);
  const notice = header.getByRole('complementary', { name: 'Sandbox test notice', exact: true });
  if (sandbox) {
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Sandbox test payment confirmed — no real money moved.');
    await expect(notice).toContainText('Family-bundle downloads and email return links are not connected yet.');
  } else {
    await expect(header.locator('.smw-preview-note')).toHaveCount(0);
  }
}
