import { test, expect } from '@playwright/test';
import { studioLetterChoices, createStudioLetter } from '../src/lib/santaStudioLetter.js';

const gifts = page => page.locator('.studio-gifts');
const body = page => gifts(page).locator('.studio-letter .studio-letter__text');
const readable = page => gifts(page).locator('.studio-letter .studio-gifts__sr');

async function visit(page, { reduced = false, clock = false } = {}) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  if (clock) await page.clock.install();
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    sessionStorage.setItem('santa-radio-example-last', 'charlotte');
    localStorage.setItem('santa-radio-cookie-consent', JSON.stringify({ necessary: true, analytics: false }));
    // Development-only media mocks: no requests to live radio or greetings.
    HTMLMediaElement.prototype.load = function () {};
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('play'));
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.route(/youtube\.com|googlevideo\.com|citrus3\.com|\/audio\/examples\//, route => route.abort());
  await page.route('**/api/santa-names?*', route => route.fulfill({ json: { records: [], hostedCount: 300, warning: null } }));
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.goto('/free-santa-message', { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await gifts(page).scrollIntoViewIfNeeded();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
}

test('letter substitutions use the verified public subset and inclusive whole-number ages', () => {
  expect(createStudioLetter('Edward', () => 0).age).toBe(3);
  expect(createStudioLetter('Edward', () => .999999).age).toBe(11);
  for (let index = 0; index < 200; index++) {
    const letter = createStudioLetter('Ayla');
    expect(Number.isInteger(letter.age) && letter.age >= 3 && letter.age <= 11).toBe(true);
    for (const key of Object.keys(studioLetterChoices)) expect(studioLetterChoices[key]).toContain(letter[key]);
    expect(letter.paragraphs.join('\n')).not.toMatch(/\[|\]|\{|\}|\.wav|\.mp3|ACTIVITY|ACHIEVEMENT|DESTINATION|TREATS/);
    expect(letter.paragraphs[0]).toBe('Dear Ayla,');
    expect(letter.paragraphs[7]).toContain('Now, Ayla, remember this:');
  }
});

test('certificate precedes body, signature follows body, and idle rotation waits for reading', async ({ page }) => {
  await visit(page, { clock: true });
  await page.clock.runFor(800);
  expect(await gifts(page).locator('.studio-certificate__name > span').evaluate(el => getComputedStyle(el).clipPath)).not.toBe('inset(0px 0% 0px 0px)');
  expect(await body(page).innerText()).not.toContain('Dear Edward');
  await page.clock.runFor(4000);
  await expect(body(page)).toContainText('Dear Edward');
  const signature = gifts(page).locator('.studio-letter .studio-letter__signature span');
  expect(await signature.evaluate(el => getComputedStyle(el).clipPath)).toContain('100%');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await page.clock.runFor(40000);
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  expect(await signature.evaluate(el => getComputedStyle(el).clipPath)).toContain('0%');
  await page.mouse.move(0, 0);
  await page.clock.runFor(59000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await page.clock.runFor(2000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
});

test('full reveal, stable enlarged letter, Escape, button close and restored focus', async ({ page }) => {
  await visit(page);
  await gifts(page).getByRole('button', { name: 'Show full letter now', exact: true }).click();
  const text = await readable(page).innerText();
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  const open = gifts(page).getByRole('button', { name: 'Enlarge letter to read' });
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('.studio-gifts__sr').innerText()).toBe(text);
  await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  expect(await dialog.locator('.studio-gifts__sr').innerText()).toBe(text);
  await dialog.getByRole('button', { name: 'Close preview' }).click();
  await expect(open).toBeFocused();
  await gifts(page).getByRole('button', { name: 'Enlarge certificate' }).click();
  await expect(dialog.locator('.studio-certificate')).toBeVisible();
  await expect(dialog.locator('img')).toHaveAttribute('src', '/certificates/examples/blank-master.webp');
});

test('audio name wins, cancels the old animation, and stopping/ending keeps a coherent idle demo', async ({ page }) => {
  await visit(page, { clock: true });
  await page.clock.runFor(4000);
  const audioStart = page.getByRole('button', { name: 'Hear an example audio message', exact: true });
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
  await expect(readable(page)).toContainText('Dear Harry,');
  await expect(readable(page)).not.toContainText('Edward');
  await expect(gifts(page).getByRole('button', { name: 'Next example' })).toBeDisabled();
  await page.clock.runFor(800);
  await expect(gifts(page)).toHaveAttribute('data-complete', 'false');
  await page.getByRole('button', { name: 'Stop example message', exact: true }).click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Harry');
  await expect(gifts(page).getByRole('button', { name: 'Next example' })).toBeEnabled();
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Arabella');
  await page.locator('.santa-message-example audio').dispatchEvent('ended');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Arabella');
  await expect(readable(page)).not.toContainText('Harry');
  await audioStart.click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await page.locator('.santa-message-example audio').dispatchEvent('error');
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(audioStart).toBeEnabled();
});

test('reduced motion is complete and static; reading pauses normal rotation', async ({ page }) => {
  await visit(page, { reduced: true, clock: true });
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  await page.clock.runFor(180000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Edward');
  await expect(body(page)).toContainText('The North Pole');
  await gifts(page).getByRole('button', { name: 'Next example' }).click();
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
  await expect(gifts(page)).toHaveAttribute('data-complete', 'true');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gifts(page).locator('.studio-letter').evaluate(el => { el.scrollTop = 100; });
  await page.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await page.clock.runFor(180000);
  await expect(gifts(page)).toHaveAttribute('data-demo-name', 'Ayla');
});

for (const [width, scale] of [[1440, 1], [320, 1], [390, 2]]) {
  test(`complete letter stays legible and scrollable at ${width}px and ${scale * 100}% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await visit(page, { reduced: true });
    if (scale > 1) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await gifts(page).getByRole('button', { name: 'Enlarge letter to read' }).click();
    const dialog = page.getByRole('dialog');
    const metrics = await dialog.evaluate(el => {
      const paper = el.querySelector('.studio-letter__paper');
      const text = el.querySelector('.studio-letter__text');
      const font = parseFloat(getComputedStyle(text).fontSize);
      return { font, scrollable: el.scrollHeight > el.clientHeight, overflow: el.scrollWidth - el.clientWidth,
        headerGap: text.getBoundingClientRect().top - paper.getBoundingClientRect().top,
        paperWidth: paper.clientWidth, topLayer: el.matches(':modal') };
    });
    expect(metrics.font).toBeGreaterThanOrEqual(18 * scale);
    expect(metrics.scrollable).toBe(true);
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headerGap).toBeGreaterThan(metrics.paperWidth * .35);
    expect(metrics.topLayer).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(dialog.locator('.studio-letter__text')).toContainText('The elves do love making things official!');
    await page.screenshot({ path: `test-results/studio-letter-${width}-${scale}.png` });
    await dialog.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `test-results/studio-letter-top-${width}-${scale}.png` });
  });
}
