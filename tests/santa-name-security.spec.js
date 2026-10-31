import { test, expect } from '@playwright/test';
import { fillAccessForm, mockBrevo } from './helpers/message-access.js';

for (const width of [390, 1440]) {
  test(`private bounded search, signed preview and real greeting creation at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockBrevo(page);
    await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    await page.goto('/');
    const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
    if (await decline.isVisible()) await decline.click();
    const checker = page.locator('.hero-name-checker');
    const input = checker.getByRole('combobox');
    await expect(input).toHaveValue('');
    expect(requests.filter(request => request.url.includes('/api/santa-names'))).toEqual([]);
    await input.fill('E');
    await expect(checker.getByRole('status')).toContainText('at least two letters');
    expect(requests.filter(request => request.url.includes('/api/santa-names'))).toEqual([]);
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/santa-names' &&
      response.request().postDataJSON()?.query === 'Erin');
    await input.fill('Erin');
    const search = await response;
    expect(search.ok()).toBe(true);
    const data = await search.json();
    expect(data.records.length).toBeGreaterThan(0);
    expect(data.records.length).toBeLessThanOrEqual(10);
    expect(data.hostedCount).toBeUndefined();
    expect(JSON.stringify(data.records.map(({ downloadName, ...record }) => record))).not.toMatch(/stagcommunications|\.mp3|\.wav/);
    const record = data.records[0];
    // downloadName is intentionally a friendly output filename, not a source URL.
    expect(record.previewUrl).toMatch(/^\/api\/santa-name-preview\?token=/);
    const preview = await page.request.get(record.previewUrl);
    expect(preview.ok()).toBe(true);
    expect(preview.headers()['content-type']).toMatch(/^audio\/(mpeg|wav)/);
    expect((await preview.body()).length).toBeGreaterThan(0);
    await checker.getByRole('option').first().click();
    await checker.getByRole('button', { name: 'Create my free Santa message →' }).click();
    await fillAccessForm(page);
    await page.getByRole('button', { name: 'Get my free Santa message', exact: true }).click();
    const maker = page.locator('.santa-message-box');
    await expect(maker.getByRole('combobox')).toHaveValue(record.name);
    await maker.getByRole('combobox').click();
    await maker.getByRole('option').first().click();
    await maker.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(maker.locator('.message-result')).toBeVisible({ timeout: 95000 });
    await expect(maker.getByRole('link', { name: 'Download your audio' })).toHaveAttribute('href', /^blob:/);
    await expect(maker.locator('.message-result audio')).toHaveCount(1);
    expect(requests.filter(request => request.url.includes('/api/santa-names')).every(request =>
      request.method === 'POST' && !new URL(request.url).search)).toBe(true);
    expect(requests.some(request => request.url.includes('/santaradio/names/'))).toBe(false);
    expect(requests.some(request => request.url.includes('/api/santa-greeting'))).toBe(false);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain(record.name);
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('santa-message-allowance'))).used).toBe(1);
  });
}
