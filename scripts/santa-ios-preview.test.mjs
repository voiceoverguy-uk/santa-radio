import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

test('iPhone-sized preview provides all five working tabs, free adult form, locked purchase states and genuine Dash destination', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
    args: ['--no-sandbox'], headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(process.env.EXPO_PREVIEW_ORIGIN || 'http://127.0.0.1:24826/', { waitUntil: 'domcontentloaded' });
    const adult = page.getByRole('checkbox');
    await adult.waitFor({ timeout: 45000 });
    assert.equal(await page.getByRole('button', { name: 'Continue to the message desk' }).isDisabled(), true);
    await adult.click();
    await page.getByRole('textbox', { name: 'Your first name', exact: true }).fill('Test');
    await page.getByRole('textbox', { name: 'Your last name', exact: true }).fill('Parent');
    await page.getByRole('textbox', { name: 'Your email address', exact: true }).fill('not-an-email');
    assert.equal(await page.getByRole('button', { name: 'Continue to the message desk' }).isDisabled(), true);
    await page.getByRole('textbox', { name: 'Your email address', exact: true }).fill('parent@example.test');
    assert.equal(await page.getByRole('button', { name: 'Continue to the message desk' }).isDisabled(), false);
    // Never submit provider signups or start an Apple purchase in a UI check.
    await page.getByRole('tab', { name: 'Santa Studio', exact: true }).click();
    await page.getByText('Studio for every Christmas', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Not yet available' }).count(), 2);
    for (const button of await page.getByRole('button', { name: 'Not yet available' }).all()) assert.equal(await button.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Restore purchases', exact: true }).count(), 1);
    await page.getByRole('tab', { name: 'Santa Radio live', exact: true }).click();
    await page.getByRole('button', { name: 'Play Santa Radio live', exact: true }).waitFor();
    assert.match(await page.locator('body').innerText(), /Song details may lead/);
    await page.getByRole('tab', { name: 'Santa Dash game', exact: true }).click();
    await page.getByRole('button', { name: 'Download Santa Dash for iPhone and iPad', exact: true }).waitFor();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Download Santa Dash for iPhone and iPad', exact: true }).click();
    const destination = await popup;
    await destination.waitForURL(/https:\/\/(?:itunes|apps)\.apple\.com\/gb\/app\/.*\/id1057048397/);
    await destination.close();
    await page.getByRole('tab', { name: 'Santa Tracker', exact: true }).click();
    await page.getByText(/simulated|GPS|phone's clock/i).last().waitFor({ timeout: 15000 });
    assert.match(await page.locator('body').innerText(), /GPS|phone.*clock/i);
    assert.equal(await page.getByRole('tab').count(), 5);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: 'generated-artifacts/santa-ios-tracker-preview.png' });
  } finally { await browser.close(); }
});
