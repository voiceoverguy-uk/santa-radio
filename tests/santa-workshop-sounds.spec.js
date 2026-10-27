import { expect } from '@playwright/test';
import { test } from './helpers/provider-test.js';
import { unlockWorkshop } from './helpers/workshop-access.js';

test.beforeEach(async ({ page }) => { await unlockWorkshop(page); });
import { workshopCatalogueFixture } from './fixtures/workshop-catalogue.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
  await page.route('**/api/santa-workshop-catalogue', route => route.fulfill({ json: workshopCatalogueFixture }));
  await page.route('**/api/santa-names?inventory=hosted', route => route.fulfill({ json: {
    records: [{ id: 'demrie', name: 'Demrie' }], hostedCount: 1, warning: null,
  } }));
});
async function open(page) {
  await page.goto('/santa-message-workshop');
  const decline = page.getByRole('button', { name: 'Decline optional cookies' });
  if (await decline.isVisible()) await decline.click();
}
async function name(page) {
  await page.getByRole('combobox', { name: 'Search recorded names' }).fill('Dem');
  await page.getByRole('option', { name: 'Demrie', exact: true }).click();
}
const attempts = page => page.evaluate(() => [...window.__workshopPlays]);

test('Continue and wheel feedback remain enabled without a sound toggle', async ({ page }) => {
  await page.addInitScript(() => {
    window.__workshopPlays = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/audio/workshop/')) {
        window.__workshopPlays.push(this.src.split('/').at(-1));
        return Promise.resolve();
      }
      return original.call(this);
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const storage = () => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const before = await storage();
  expect(await attempts(page)).toEqual([]);
  await page.locator('.smw-button-next').click();
  expect(await attempts(page)).toEqual([]);
  await name(page);
  await page.locator('.smw-button-next').click();
  expect(await attempts(page)).toEqual(['message-next.mp3']);
  const age = page.getByRole('listbox', { name: 'Their age', exact: true });
  await age.focus();
  expect(await attempts(page)).toEqual(['message-next.mp3']);
  await age.press('Home');
  const baseline = (await attempts(page)).length;
  await age.press('ArrowDown');
  expect(await attempts(page)).toHaveLength(baseline + 1);
  expect((await attempts(page)).at(-1)).toBe('click-scroller.mp3');
  await age.press('ArrowDown');
  expect(await attempts(page)).toHaveLength(baseline + 2);
  // Reflow and programmatic re-centering are not user rotation.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await attempts(page)).toHaveLength(baseline + 2);
  await page.locator('.smw-button-next').click();
  expect((await attempts(page)).at(-1)).toBe('message-next.mp3');
  const count = (await attempts(page)).length;
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(age.getByRole('option', { name: '2 months old', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await attempts(page)).toHaveLength(count);
  await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.smw-page').getByRole('button', { name: /sounds/i })).toHaveCount(0);
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
  await age.press('ArrowDown');
  await page.locator('.smw-button-next').click();
  expect(await attempts(page)).toHaveLength(count + 3);
  await expect(page.locator('.smw-step-count')).toHaveText('Step 3 of 6');
  expect(await storage()).toEqual(before);
  await page.reload();
  expect(await attempts(page)).toEqual([]);
});

test('browser-blocked sound reports the issue but never blocks Continue', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this.src.includes('/audio/workshop/')
        ? Promise.reject(new DOMException('Fixture blocked', 'NotAllowedError'))
        : original.call(this);
    };
  });
  await open(page);
  await name(page);
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-step-count')).toHaveText('Step 2 of 6');
  await expect(page.locator('.smw-page')).toContainText('Your browser blocked workshop sounds');
  await expect(page.locator('.smw-sound-toggle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.smw-page').getByRole('button', { name: /sounds/i })).toHaveCount(0);
  await page.locator('.smw-button-next').click();
  await page.getByRole('listbox', { name: 'Their age', exact: true }).press('End');
  await page.locator('.smw-button-next').click();
  await expect(page.locator('.smw-step-count')).toHaveText('Step 3 of 6');
});

test('native wheel and touch scrolling tick on centre crossings, not on settlement or restoration', async ({ page }) => {
  await page.addInitScript(() => {
    window.__workshopPlays = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.includes('/audio/workshop/')) return original.call(this);
      window.__workshopPlays.push(this.src.split('/').at(-1));
      return Promise.resolve();
    };
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await name(page);
  await page.locator('.smw-button-next').click();
  const age = page.getByRole('listbox', { name: 'Their age', exact: true });
  await age.scrollIntoViewIfNeeded();
  await age.hover();
  await page.mouse.wheel(0, 96);
  await expect(age.getByRole('option', { name: '2 months old', exact: true })).toHaveAttribute('aria-selected', 'true');
  const ageTicks = (await attempts(page)).filter(file => file === 'click-scroller.mp3').length;
  // Fast native motion can cross multiple rows between rendered frames.
  expect(ageTicks).toBeGreaterThanOrEqual(1);
  expect(ageTicks).toBeLessThanOrEqual(2);
  await page.locator('.smw-button-next').click();
  const activity = page.getByRole('listbox', { name: 'Something they do', exact: true });
  await activity.dispatchEvent('touchstart');
  await activity.evaluate(node => {
    const options = node.querySelectorAll('[role=option]');
    node.scrollTop += options[1].getBoundingClientRect().top - options[0].getBoundingClientRect().top;
  });
  await activity.dispatchEvent('touchend');
  await expect(activity.getByRole('option', { name: 'Playing a musical instrument', exact: true })).toHaveAttribute('aria-selected', 'true');
  const count = (await attempts(page)).length;
  expect((await attempts(page)).filter(file => file === 'click-scroller.mp3')).toHaveLength(ageTicks + 1);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(age.getByRole('option', { name: '2 months old', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await attempts(page)).toHaveLength(count);
});

test('real supplied MP3s decode and finish playing after real user activation', async ({ page, request }) => {
  for (const file of ['click-scroller.mp3', 'message-next.mp3']) {
    const response = await request.get(`/audio/workshop/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/audio\/mpeg/);
  }
  await page.addInitScript(() => {
    window.__workshopEnded = [];
    const original = HTMLMediaElement.prototype.play;
    const observed = new WeakSet();
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/audio/workshop/') && !observed.has(this)) {
        observed.add(this);
        this.addEventListener('ended', () => window.__workshopEnded.push({
          file: this.src.split('/').at(-1), duration: this.duration,
        }));
      }
      return original.call(this);
    };
  });
  await open(page);
  await name(page);
  await page.locator('.smw-button-next').click();
  await expect.poll(() => page.evaluate(() => window.__workshopEnded.some(item => item.file === 'message-next.mp3'))).toBe(true);
  await page.getByRole('listbox', { name: 'Their age', exact: true }).press('End');
  await expect.poll(() => page.evaluate(() => window.__workshopEnded.some(item => item.file === 'click-scroller.mp3'))).toBe(true);
  const ended = await page.evaluate(() => window.__workshopEnded);
  // Browser decoders trim MP3 encoder padding differently from ffprobe.
  // Exact supplied bytes are checked separately; native ended events and
  // positive finite durations prove that both actual files decoded/played.
  for (const file of ['message-next.mp3', 'click-scroller.mp3']) {
    const duration = ended.find(item => item.file === file).duration;
    expect(Number.isFinite(duration)).toBe(true);
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(.3);
  }
});
