import { expect } from '@playwright/test';

let sessionCookies;
export async function unlockWorkshop(page) {
  const password = process.env.WORKSHOP_TEST_PASSWORD;
  if (!password) throw new Error('Run workshop checks with playwright.workshop.config.js and its isolated test server.');
  if (sessionCookies) {
    await page.context().addCookies(sessionCookies);
    return;
  }
  const status = await page.request.get('/api/santa-workshop-access');
  const origin = new URL(status.url()).origin;
  const reply = await page.request.post('/api/santa-workshop-access', {
    headers: { Origin: origin }, data: { password },
  });
  expect(reply.status(), 'Test server workshop sign-in').toBe(200);
  sessionCookies = (await page.context().storageState()).cookies.filter(cookie => cookie.name === 'santa-workshop-preview');
}
