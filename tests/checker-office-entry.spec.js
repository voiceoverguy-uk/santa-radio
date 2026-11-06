import { test, expect } from '@playwright/test';

const path = '/naughty-or-nice-list-checker';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, externalMedia: false, savedAt: Date.now(),
    }));
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Test silent fallback', 'NotAllowedError'));
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Erin', 'Erica'] }));
});

async function assertEntryPosition(page) {
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('.nn-office .nn-panel').getBoundingClientRect();
    const title = document.querySelector('.nn-office h1').getBoundingClientRect();
    const nav = document.querySelector('.navbar').getBoundingClientRect();
    const dock = document.querySelector('.radio-dock:not([hidden])')?.getBoundingClientRect();
    const top = nav.bottom + 16;
    const bottom = Math.max(top + 100, Math.min(innerHeight - 16, dock?.height ? dock.top - 16 : innerHeight - 16));
    const start = Math.min(panel.top, title.top);
    const end = Math.max(panel.bottom, title.bottom);
    const wanted = top + Math.max(0, (bottom - top - (end - start)) / 2);
    return Math.abs(start - wanted);
  })).toBeLessThan(2);
  await expect(page.locator('.nn-office h1')).toHaveText('Naughty or Nice List Checker');
}

test('desktop opens centred on the checker with the title beside Head Elf, including reload', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await assertEntryPosition(page);
  const layout = await page.evaluate(() => {
    const panel = document.querySelector('.nn-panel');
    const box = panel.getBoundingClientRect();
    const title = document.querySelector('.nn-office h1').getBoundingClientRect();
    const scene = document.querySelector('.nn-scene').getBoundingClientRect();
    return { titleRight: title.right, elfLeft: box.left + box.width * .56,
      titleTop: title.top, titleBottom: title.bottom, panelTop: box.top,
      parchmentTop: box.top + parseFloat(getComputedStyle(panel).borderTopWidth),
      panelOffset: (box.top - scene.top) / scene.width };
  });
  expect(layout.panelOffset).toBeGreaterThanOrEqual(.035);
  expect(layout.panelOffset).toBeLessThanOrEqual(.1);
  expect(layout.titleRight).toBeLessThanOrEqual(layout.elfLeft);
  expect(layout.titleTop).toBeGreaterThanOrEqual(layout.panelTop);
  expect(layout.titleBottom).toBeLessThanOrEqual(layout.parchmentTop);
  await page.screenshot({ path: testInfo.outputPath('office-centred-desktop.png') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertEntryPosition(page);
});

test('phone and enlarged-text entry keeps the heading readable without opening the keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await assertEntryPosition(page);
  await expect(page.getByRole('combobox')).not.toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('office-centred-phone.png') });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await assertEntryPosition(page);
  const geometry = await page.evaluate(() => {
    const heading = document.querySelector('.nn-office h1');
    const box = heading.getBoundingClientRect();
    const scene = document.querySelector('.nn-scene').getBoundingClientRect();
    const panel = document.querySelector('.nn-panel');
    const parchmentTop = panel.getBoundingClientRect().top + parseFloat(getComputedStyle(panel).borderTopWidth);
    return { overflow: document.documentElement.scrollWidth - innerWidth,
      left: box.left - scene.left, right: scene.right - box.right,
      top: box.top - scene.top,
      parchmentClearance: parchmentTop - box.bottom,
      textOverflow: heading.scrollWidth - heading.clientWidth };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.parchmentClearance).toBeGreaterThanOrEqual(0);
  expect(geometry.textOverflow).toBeLessThanOrEqual(1);
});

test('homepage handoff opens in the same place and entry settling stops on visitor scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const widget = page.locator('#nice-list');
  await widget.getByRole('combobox').fill('Erin');
  await widget.getByRole('button', { name: 'Check', exact: true }).click();
  await widget.getByRole('link', { name: 'Lets check with Head Elf' }).click({ timeout: 15000 });
  await assertEntryPosition(page);
  await expect(page.getByRole('combobox')).toHaveValue('Erin');
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
