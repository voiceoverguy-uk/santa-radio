import { test, expect } from '@playwright/test';

const chart = (state = 'partial', songs = [
  { artist: 'Leona Lewis', title: 'One More Sleep', count: 7 },
  { artist: 'Uncatalogued Artist', title: 'A New Christmas Recording (Live)', count: 3 },
]) => ({
  date: '2026-10-20', start: '2026-10-19T23:00:00Z', end: '2026-10-20T23:00:00Z',
  nextRefreshAt: '2026-10-21T23:00:00Z', state, songs, coverage: {},
});
const title = 'Yesterday’s Top Ten Songs';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { artist: 'Leona Lewis', title: 'One More Sleep' }, currentStatus: 'ready',
    upcoming: [], upcomingStatus: 'ready', upcomingUpdatedAt: Date.now(),
  } }));
  // Verify provider audio lifecycle without depending on external audio availability.
  await page.addInitScript(() => {
    window.audioCalls = { play: 0, pause: 0, load: 0 };
    for (const method of ['play','pause','load']) HTMLMediaElement.prototype[method] = function () {
      window.audioCalls[method]++;
      if (method === 'play') return Promise.resolve();
    };
  });
});

test('both triggers share a compact in-player panel; playback, focus and idle work', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T11:59Z') });
  await page.clock.pauseAt(new Date('2026-10-21T12:00Z'));
  await page.route('**/api/radio-top-ten', route => route.fulfill({ json: chart() }));
  await page.goto('/christmas-music');
  await page.getByRole('button', { name: 'Decline optional cookies' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const dock = page.getByRole('complementary', { name: 'Santa Radio player' });
  if (await dock.getByRole('button', { name: 'Expand radio player' }).isVisible()) await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await dock.getByRole('button', { name: 'Listen Live', exact: true }).click();
  await expect(dock.getByRole('button', { name: 'Pause Radio', exact: true })).toBeVisible();
  const before = await page.evaluate(() => { window.originalRadio=document.querySelector('audio'); return window.audioCalls; });
  const playerTrigger = dock.getByRole('button', { name: 'Yesterday’s Top 10' });
  await playerTrigger.click();
  const dialog = dock.getByRole('region', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Most played on Santa Radio yesterday');
  await expect(dialog).toContainText('Tuesday, 20 October 2026');
  await expect(dialog.locator('li')).toHaveCount(2);
  await expect(dialog).toContainText('Uncatalogued Artist');
  await page.clock.runFor(12000);
  await expect(dialog).toBeVisible();
  await expect(dock).not.toHaveClass(/is-minimized/);
  // Non-modal: radio controls and page remain usable, without a focus trap.
  await dock.getByRole('button', { name: 'Pause Radio', exact: true }).focus();
  await expect(dock.getByRole('button', { name: 'Pause Radio', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Close yesterday’s top ten' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close yesterday’s top ten' })).not.toBeFocused();
  await dialog.getByRole('button', { name: 'Close yesterday’s top ten' }).focus();
  await page.keyboard.press('Escape');
  await page.clock.runFor(30);
  await expect(playerTrigger).toBeFocused();
  const musicTrigger = page.getByRole('button', { name: 'Yesterday’s Top Xmas Songs' });
  await musicTrigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close yesterday’s top ten' }).click();
  await page.clock.runFor(30);
  await expect(musicTrigger).toBeFocused();
  expect(await page.evaluate(() => window.audioCalls)).toEqual(before);
  expect(await page.evaluate(() => window.originalRadio===document.querySelector('audio'))).toBe(true);
  await playerTrigger.click();
  const dockBounds = await dock.boundingBox();
  const panelBounds = await dialog.boundingBox();
  expect(panelBounds.width).toBeLessThanOrEqual(405);
  expect(panelBounds.x).toBeGreaterThanOrEqual(dockBounds.x);
  expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(dockBounds.x + dockBounds.width);
  await page.screenshot({ path: 'generated-artifacts/compact-top-ten-desktop.png' });
  await dock.getByRole('button', { name: 'Minimise radio player' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(dock.getByRole('button', { name: 'Expand radio player' })).toBeFocused();
  await dock.getByRole('button', { name: 'Expand radio player' }).click();
  await expect(dialog).not.toBeVisible();
});

test('mobile starts minimised, full ten rows scroll and broken portraits fall back', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route('**/artist-artwork/**', route => route.request().url().includes('fallback') ? route.continue() : route.abort());
  await page.route('**/api/radio-top-ten', route => route.fulfill({ json: chart('complete', Array.from({ length: 10 }, (_, i) =>
    ({ artist: i === 0 ? 'Leona Lewis' : `Unknown ${i}`, title: `Song ${i + 1}`, count: 10 - i }))) }));
  await page.goto('/christmas-music');
  await page.getByRole('button', { name: 'Decline optional cookies' }).click();
  await expect(page.locator('.radio-dock')).toHaveClass(/is-minimized/);
  await page.getByRole('button', { name: 'Yesterday’s Top Xmas Songs' }).click();
  const dialog = page.getByRole('region', { name: title });
  await expect(page.locator('.radio-dock')).not.toHaveClass(/is-minimized/);
  await expect(dialog.getByRole('button', { name: 'Close yesterday’s top ten' })).toBeFocused();
  await expect(dialog.locator('li')).toHaveCount(10);
  await expect(dialog.locator('li').first().locator('img')).toHaveAttribute('alt', /Santa/);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(361);
  expect(bounds.width).toBeLessThanOrEqual(360);
  const content = dialog.locator('.top-ten-content');
  expect(await content.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await content.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(dialog.locator('li').last()).toBeInViewport();
  await page.screenshot({ path: 'generated-artifacts/compact-top-ten-mobile.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Yesterday’s Top Xmas Songs' })).toBeFocused();
});

test('loading, inactive, initial, partial empty, empty, errors and retry are honest', async ({ page }) => {
  let result=chart('inactive', []), fail=false, release;
  let block=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/radio-top-ten', async route => {
    await block;
    await route.fulfill(fail ? { status:503, json:{error:'unavailable'} } : {json:result});
  });
  await page.goto('/christmas-music');
  await page.getByRole('button', { name: 'Decline optional cookies' }).click();
  const trigger=page.getByRole('button',{name:'Yesterday’s Top Xmas Songs'});
  await trigger.click();
  const dialog=page.getByRole('region',{name:title});
  await expect(dialog.getByRole('status')).toBeVisible();
  release(); block=Promise.resolve();
  await expect(dialog).toContainText('hasn’t been activated');
  for (const [state, text] of [['initial','isn’t enough listening history'],['partial','Only partial coverage'],['empty','no observed song transitions']]) {
    await page.keyboard.press('Escape');
    result=chart(state,[]);
    await trigger.click();
    await expect(dialog).toContainText(text);
  }
  await page.keyboard.press('Escape'); fail=true;
  await trigger.click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  fail=false; result=chart();
  await dialog.getByRole('button',{name:'Try again'}).click();
  await expect(dialog.locator('li')).toHaveCount(2);
});

test('an open player panel refreshes at UK midnight and never keeps the previous chart on rollover failure', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-02T22:59:57Z') });
  await page.clock.pauseAt(new Date('2026-07-02T22:59:58Z'));
  let calls=0;
  await page.route('**/api/radio-top-ten', route => {
    calls++;
    if (calls===1) return route.fulfill({json:{...chart(), date:'2026-07-01', nextRefreshAt:'2026-07-02T23:00:00Z'}});
    return route.fulfill({status:503, json:{error:'offline'}});
  });
  await page.goto('/christmas-music');
  await page.getByRole('button', { name: 'Decline optional cookies' }).click();
  await page.getByRole('button',{name:'Yesterday’s Top Xmas Songs'}).click();
  const dialog=page.getByRole('region',{name:title});
  await expect(dialog).toContainText('Wednesday, 1 July 2026');
  await page.clock.runFor(2100);
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog).not.toContainText('1 July');
  await expect(dialog.locator('li')).toHaveCount(0);
  expect(calls).toBe(2);
});

test('development endpoint supplies inactive chart and unchanged metadata contract', async ({ request }) => {
  const response=await request.get('/api/radio-top-ten');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toMatchObject({state:'inactive',songs:[]});
  expect((await request.post('/api/radio-top-ten')).status()).toBe(405);
});
