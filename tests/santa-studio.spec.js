import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockBrevo, fillAccessForm, openMessageDesk } from './helpers/message-access.js';
import { MESSAGE_ALLOWANCE_KEY } from '../src/lib/santaMessageAllowance.js';

async function visit(page, path) {
  await page.goto(path);
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
}

test.beforeEach(async ({ page }) => {
  await mockBrevo(page, { success: false });
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: { available: false, current: null, upcoming: [] } }));
});

for (const path of ['/', '/free-santa-message']) {
  test(`public live total, honest failure and retry without unlocking on ${path}`, async ({ page }) => {
    let mode = 'hold', release;
    const gate = new Promise(resolve => { release = resolve; });
    let requests = 0;
    await page.route('**/api/santa-names?*', async route => {
      requests++;
      expect(new URL(route.request().url()).searchParams.get('q')).toBe('');
      if (mode === 'hold') await gate;
      if (mode === 'error') return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
      return route.fulfill({ json: { records: [], hostedCount: mode === 'one' ? 1 : 12345, warning: null } });
    });
    await visit(page, path);
    await expect(page.locator('.message-name-count')).toHaveText('Checking how many names are available…');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeEnabled();
    mode = 'error';
    release();
    await expect(page.locator('.message-name-count')).toHaveText('Name total temporarily unavailable.');
    await expect(page.getByRole('button', { name: 'Get my free Santa message' })).toBeEnabled();
    mode = 'one';
    await page.getByRole('button', { name: 'Retry name total' }).click();
    await expect(page.locator('.message-name-count')).toHaveText('0 names available');
    expect(requests).toBe(2);
    expect(await page.getByRole('combobox').count()).toBe(0);
    // A new public visit gets the hosted value, not a screenshot constant.
    mode = 'many';
    await page.reload();
    await expect(page.locator('.message-name-count')).toHaveText('12,295 names available');
    await expect(page.locator('.message-card-top')).toContainText('The North Pole Recording Studio');
    await expect(page.getByRole('link', { name: 'Visit Santa’s message desk' })).toHaveCount(0);
  });
}

test('empty-query inventory is reused when access unlocks in place', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/santa-names?*', route => {
    requests++;
    return route.fulfill({ json: { records: [], hostedCount: 9775, warning: null } });
  });
  await mockBrevo(page);
  await visit(page, '/free-santa-message');
  await expect(page.locator('.message-name-count')).toHaveText('9,725 names available');
  await fillAccessForm(page);
  await page.getByRole('button', { name: 'Get my free Santa message' }).click();
  await expect(page.getByRole('combobox')).toBeVisible();
  await expect(page.locator('.message-name-count')).toHaveText('9,725 names available');
  expect(requests).toBe(1);
});

for (const width of [320, 390, 1280]) {
  for (const path of ['/', '/free-santa-message']) {
    test(`both exact certificate examples enlarge accessibly at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await visit(page, path);
      const examples = page.locator('.santa-certificate-examples');
      await examples.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect(examples.getByRole('button', { name: /^(Edward|Ayla|Pause rotation|Resume rotation)$/ })).toHaveCount(0);
      await expect(examples).not.toContainText('Showing');
      const box = await examples.boundingBox();
      const parentWidth = await examples.evaluate(node => node.parentElement.clientWidth);
      expect(box.width).toBeCloseTo(Math.min(parentWidth, 420), 0);
      const introBox = await page.locator('.message-intro').boundingBox();
      expect(box.x).toBeCloseTo(introBox.x, 0);
      const stage = examples.locator('.santa-certificate-examples__stage');
      const originalHeight = (await stage.boundingBox()).height;
      for (const name of ['Edward', 'Ayla']) {
        if (name === 'Ayla') {
          // Observe a fresh automatic cycle, independent of the previous modal's
          // native focus-return event and the intentionally paused focused card.
          await visit(page, path);
          await page.mouse.move(0, 0);
          await page.clock.runFor(100);
          await page.clock.fastForward(5100);
        }
        const opener = examples.getByRole('button', { name: `Open ${name}'s certificate example`, exact: true });
        await opener.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        const compactImage = opener.locator('img');
        await expect(compactImage).toHaveJSProperty('complete', true);
        const checkCompactFrame = async (state) => {
          // Advance CSS transitions as well as the rotation clock before measuring.
          await page.clock.runFor(300);
          const geometry = await stage.evaluate(node => {
            const button = node.querySelector('button');
            const image = node.querySelector('img');
            const style = getComputedStyle(button);
            return {
              stage: node.getBoundingClientRect().toJSON(),
              button: button.getBoundingClientRect().toJSON(),
              image: image.getBoundingClientRect().toJSON(),
              hint: node.querySelector('span').getBoundingClientRect().toJSON(),
              focusVisible: button.matches(':focus-visible'),
              outline: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
              outlineColor: style.outlineColor,
            };
          });
          const { stage: frame, button, image, hint } = geometry;
          expect(image.width / image.height).toBeCloseTo(1800 / 1273, 2);
          const gaps = [image.left - frame.left, image.top - frame.top,
            frame.right - image.right, frame.bottom - image.bottom];
          for (const gap of gaps) expect(gap).toBeGreaterThan(1);
          expect(gaps[0]).toBeCloseTo(gaps[2], 0);
          expect(gaps[1]).toBeCloseTo(gaps[3], 0);
          // The label must not obscure the internal artwork frame (~3–4% inset).
          expect(hint.right).toBeLessThan(image.right - image.width * .037);
          expect(hint.bottom).toBeLessThan(image.bottom - image.height * .041);
          if (state === 'focus') {
            expect(geometry.focusVisible).toBe(true);
            expect(geometry.outlineColor).toBe('rgb(231, 200, 119)');
            expect(geometry.outline).toBeGreaterThanOrEqual(7);
            expect(button.left - geometry.outline).toBeGreaterThan(frame.left + 1);
            expect(button.top - geometry.outline).toBeGreaterThan(frame.top + 1);
            expect(button.right + geometry.outline).toBeLessThan(frame.right - 1);
            expect(button.bottom + geometry.outline).toBeLessThan(frame.bottom - 1);
          }
          await examples.screenshot({ path: `generated-artifacts/studio/compact-${name}-${width}-${path === '/' ? 'home' : 'maker'}-${state}.png` });
        };
        await checkCompactFrame('rest');
        await opener.hover();
        await checkCompactFrame('hover');
        // Hover continues to pause rotation for the complete five-second cycle.
        await page.clock.fastForward(5100);
        await expect(opener).toHaveAttribute('aria-label', `Open ${name}'s certificate example`);
        await page.mouse.move(0, 0);
        // Establish real keyboard modality rather than relying on focus() alone.
        await opener.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(opener).toBeFocused();
        await checkCompactFrame('focus');
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: `${name}'s certificate example`, exact: true });
        await expect(dialog).toBeVisible();
        const close = dialog.getByRole('button', { name: 'Close certificate preview' });
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab');
        const zoom = dialog.getByRole('button', { name: 'Zoom in to read' });
        await expect(zoom).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(close).toBeFocused();
        const image = dialog.locator('img');
        await expect(image).toHaveAttribute('src', `/certificates/examples/${name.toLowerCase()}.webp`);
        expect(await image.evaluate(img => img.complete && img.naturalWidth === 1800)).toBe(true);
        const bounds = await image.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.width / bounds.height).toBeCloseTo(1800 / 1273, 2);
        await page.screenshot({ path: `generated-artifacts/studio/preview-${name}-${width}-${path === '/' ? 'home' : 'maker'}.png` });
        await zoom.click();
        const artwork = dialog.getByRole('region', { name: 'Certificate artwork' });
        expect(await artwork.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
        await artwork.focus();
        await page.keyboard.press('Tab');
        await expect(dialog.getByRole('button', { name: 'Fit full certificate' })).toBeFocused();
        await dialog.getByRole('button', { name: 'Fit full certificate' }).click();
        if (name === 'Edward') await page.keyboard.press('Escape');
        else await close.click();
        await expect(dialog).not.toBeVisible();
        await expect(opener).toBeFocused();
      }
      expect((await stage.boundingBox()).height).toBe(originalHeight);
      await expect(page.getByRole('combobox')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
  }
}

for (const path of ['/', '/free-santa-message']) {
  for (const viewport of [{ width: 1280, height: 500 }, { width: 844, height: 390 }]) {
    test(`fit includes all borders and zoom scrolls on short ${viewport.width}px screen on ${path}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await visit(page, path);
      await page.getByRole('button', { name: "Open Edward's certificate example" }).click();
      const dialog = page.getByRole('dialog', { name: "Edward's certificate example" });
      const artwork = dialog.getByRole('region', { name: 'Certificate artwork' });
      const image = artwork.locator('img');
      await expect(image).toBeVisible();
      const checkFit = async () => {
        const frame = await artwork.boundingBox(), bounds = await image.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(frame.x - 1);
        expect(bounds.y).toBeGreaterThanOrEqual(frame.y - 1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
        expect(await artwork.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
      };
      await checkFit();
      await dialog.getByRole('button', { name: 'Zoom in to read' }).click();
      expect(await artwork.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
      await artwork.evaluate(node => { node.scrollLeft = node.scrollWidth; node.scrollTop = node.scrollHeight; });
      expect(await artwork.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      await dialog.getByRole('button', { name: 'Fit full certificate' }).click();
      await checkFit();
    });
  }
}

test('automatic rotation pauses during interaction and enlargement and respects reduced motion', async ({ page }) => {
  await page.clock.install();
  await visit(page, '/free-santa-message');
  const examples = page.locator('.santa-certificate-examples');
  const image = examples.locator('.santa-certificate-examples__image');
  await page.mouse.move(0, 0);
  await expect(image).toHaveAttribute('src', '/certificates/examples/edward.webp');
  await page.clock.fastForward(4500);
  await expect(image).toHaveAttribute('src', '/certificates/examples/edward.webp');
  await page.clock.fastForward(600);
  await expect(image).toHaveAttribute('src', '/certificates/examples/ayla.webp');
  await examples.getByRole('button', { name: "Open Ayla's certificate example" }).focus();
  await page.clock.fastForward(5100);
  await expect(image).toHaveAttribute('src', '/certificates/examples/ayla.webp');
  await examples.getByRole('button', { name: "Open Ayla's certificate example" }).click();
  await page.clock.fastForward(13000);
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', "Ayla's certificate example");
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.santa-message-access input[name="FIRSTNAME"]').focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(13000);
  await expect(image).toHaveAttribute('src', '/certificates/examples/ayla.webp');
});

for (const width of [320, 1280]) {
  for (const path of ['/', '/free-santa-message']) {
    test(`all named certificate examples rotate and open correctly at ${width}px on ${path}`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await visit(page, path);
      const examples = page.locator('.santa-certificate-examples');
      const image = examples.locator('.santa-certificate-examples__image');
      const names = ['Edward', 'Ayla', 'Erin', 'Charlotte', 'Freya', 'Harry',
        'Arabella', 'Jessica', 'Charlie', 'Olivia', 'Oliver'];
      // Verify the uninterrupted complete cycle separately from modal checks.
      // Frozen clocks can delay native dialog close/focus events; fresh visits
      // below keep those events from interfering with the next rotation.
      await page.mouse.move(0, 0);
      for (const name of names) {
        await expect(image).toHaveAttribute('src', `/certificates/examples/${name.toLowerCase()}.webp`);
        await page.clock.runFor(5000);
      }
      await expect(image).toHaveAttribute('src', '/certificates/examples/edward.webp');
      for (const [index, name] of names.entries()) {
        await visit(page, path);
        await page.mouse.move(0, 0);
        await page.clock.runFor(index * 5000 + 100);
        const src = `/certificates/examples/${name.toLowerCase()}.webp`;
        await expect(image).toHaveAttribute('src', src);
        await expect(image).toHaveJSProperty('complete', true);
        await expect(image).toHaveJSProperty('naturalWidth', 1800);
        await expect(image).toHaveJSProperty('naturalHeight', 1273);
        const opener = examples.getByRole('button', { name: `Open ${name}'s certificate example`, exact: true });
        await opener.click();
        const dialog = page.getByRole('dialog', { name: `${name}'s certificate example`, exact: true });
        await expect(dialog.locator('img')).toHaveAttribute('src', src);
        await page.clock.fastForward(5100);
        await expect(dialog.locator('img')).toHaveAttribute('src', src);
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(opener).toBeFocused();
      }
    });
  }
}

test('waiting downloads can repeat without generation, allowance or timer changes; reload is honest', async ({ page }) => {
  test.setTimeout(90000);
  const audio = readFileSync('server/santa-audio/sleighbells.mp3');
  let generations = 0;
  await page.addInitScript(() => { Date.now = () => 1801915200000; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/santa-message', route => {
    generations++;
    return route.fulfill({ contentType: 'audio/mpeg', body: audio });
  });
  await openMessageDesk(page);
  for (const name of ['Olivia', 'Erin']) {
    await page.getByLabel('First Name').fill(name);
    await page.getByRole('option', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Create message', exact: true }).click();
    await expect(page.getByRole('heading', { name: `For ${name}, from Santa` })).toBeVisible();
  }
  const before = await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY);
  const wait = page.locator('.message-wait');
  await expect(wait.locator('.message-result')).toHaveCount(2);
  await expect(page.locator('.message-result')).toHaveCount(2);
  let fontRequests = 0;
  await page.route('**/certificates/nice-list/GreatVibes-Regular.ttf', route => {
    if (++fontRequests === 1) return route.fulfill({ status: 503 });
    return route.continue();
  });
  const first = wait.getByLabel('Santa’s greeting for Olivia', { exact: true });
  await first.getByRole('button', { name: 'Download your Nice List certificate' }).click();
  await expect(first.getByRole('alert')).toContainText('Your audio is still available');
  await expect(first.locator('.message-download').first()).toHaveCSS('animation-name', 'none');
  for (const name of ['Olivia', 'Erin']) {
    const result = wait.getByLabel(`Santa’s greeting for ${name}`, { exact: true });
    for (let repetition = 0; repetition < 2; repetition++) {
      let pending = page.waitForEvent('download');
      await result.getByRole('link', { name: 'Download your audio' }).click();
      expect((await pending).suggestedFilename()).toBe(`santa-recorded-message-for-${name}.mp3`);
      pending = page.waitForEvent('download');
      await result.getByRole('button', { name: /(?:Download|Retry) your Nice List certificate/ }).click();
      expect((await pending).suggestedFilename()).toContain(`${name}.pdf`);
    }
  }
  expect(generations).toBe(2);
  expect(await page.evaluate(key => localStorage.getItem(key), MESSAGE_ALLOWANCE_KEY)).toBe(before);
  await expect(page.getByRole('timer')).toHaveText('10:00');
  await page.reload();
  await expect(page.locator('.message-wait')).toContainText('This tab no longer holds those recordings.');
  await expect(page.locator('.message-wait')).toContainText('Previously saved audio and certificates remain on your device.');
  await expect(page.locator('.message-result')).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveText('10:00');
  expect(generations).toBe(2);
});
