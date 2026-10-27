import { expect } from '@playwright/test';
import { issueWorkshopToken } from '../../server/santa-workshop-access.js';

let sessionCookies;
export async function unlockWorkshop(page) {
  const password = process.env.WORKSHOP_TEST_PASSWORD;
  if (!password) throw new Error('Run workshop checks with playwright.workshop.config.js and its isolated test server.');
  if (sessionCookies) {
    await page.context().addCookies(sessionCookies);
    return;
  }
  const baseURL = new URL((await page.request.get('/api/santa-workshop-access')).url()).origin;
  const config = {
    codes: [{ id: '1', code: password }],
    signingSecret: process.env.WORKSHOP_TEST_SESSION_SECRET,
    expiresAt: Date.parse(process.env.WORKSHOP_TEST_EXPIRES_AT),
  };
  sessionCookies = [{
    name: 'santa-workshop-preview', value: issueWorkshopToken(config),
    url: baseURL, httpOnly: true, sameSite: 'Strict',
  }];
  await page.context().addCookies(sessionCookies);
  const status = await page.request.get('/api/santa-workshop-access');
  expect((await status.json()).authorized, 'Isolated ephemeral tester session').toBe(true);
}
