import { expect } from '@playwright/test';

export async function checkStudioRunner(page, motion, costume = 'classic') {
  const lane = page.locator('.studio-runner-lane');
  const travel = lane.locator('picture');
  const image = travel.locator('img');
  await expect(lane).toBeVisible();
  await expect(lane).toHaveAttribute('aria-hidden', 'true');
  await expect(lane).toHaveCSS('pointer-events', 'none');
  await expect(lane).toHaveCSS('overflow', 'hidden');
  await expect(image).toHaveAttribute('alt', '');
  await expect.poll(() => image.evaluate(node => node.currentSrc)).toContain(
    `/images/studio-runners/${costume}${motion === 'reduce' ? '-still.png' : '.webp'}`);
  await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(await lane.evaluate(node => node.closest('[role="status"], [aria-live]'))).toBeNull();
  expect(await lane.locator('button, a, [tabindex]').count()).toBe(0);
  const layout = await lane.evaluate(node => {
    const lane = node.getBoundingClientRect();
    const controls = node.previousElementSibling.getBoundingClientRect();
    const panelNode = node.closest('.smw-message-preparing');
    const panel = panelNode.getBoundingClientRect();
    const status = panelNode.querySelector('[role="status"]').getBoundingClientRect();
    return { height: lane.height, width: lane.width,
      fits: lane.left >= panel.left && lane.right <= panel.right && lane.bottom <= panel.bottom,
      belowStatus: lane.top >= status.bottom,
      controlGap: lane.left - controls.right,
      plain: getComputedStyle(node).borderStyle === 'none' && getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)',
      below: lane.top >= controls.bottom,
      right: lane.left >= controls.right,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(layout).toMatchObject({ height: 64, fits: true, belowStatus: true, plain: true, overflow: false });
  expect(page.viewportSize().width <= 760 ? layout.below : layout.right).toBe(true);
  if (page.viewportSize().width > 760) {
    expect(layout.width).toBeLessThanOrEqual(280);
    expect(layout.controlGap).toBeCloseTo(12, 1);
  }
  await expect(travel).toHaveCSS('animation-name', motion === 'reduce' ? 'none' : 'studio-runner-cross');
  await expect(image).toHaveCSS('animation-name', motion === 'reduce' ? 'none' : 'studio-runner-face');
  if (motion === 'reduce') {
    expect(await travel.evaluate(node => {
      const a = node.getBoundingClientRect(), b = node.parentElement.getBoundingClientRect();
      return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2);
    })).toBeLessThan(1);
    return;
  }
  // Sample complete outbound/return legs and both reversals without timing races.
  const samples = await travel.evaluate(node => {
    const travel = node.getAnimations()[0], face = node.querySelector('img').getAnimations()[0];
    const samples = [];
    travel.pause(); face.pause();
    for (const time of [0, 1000, 6999, 7000, 7001, 8000, 13999, 14000, 14001, 15000]) {
      travel.currentTime = face.currentTime = time;
      const box = node.getBoundingClientRect(), lane = node.parentElement.getBoundingClientRect();
      samples.push({ time, x: box.left - lane.left, right: box.right - lane.left, width: lane.width,
        facing: new DOMMatrix(getComputedStyle(node.querySelector('img')).transform).a });
    }
    travel.play(); face.play();
    return samples;
  });
  const at = time => samples.find(sample => sample.time === time);
  for (const sample of samples) {
    expect(sample.x).toBeGreaterThanOrEqual(-.1);
    expect(sample.right).toBeLessThanOrEqual(sample.width + .1);
    expect(sample.facing).toBe(sample.time % 14000 < 7000 ? 1 : -1);
  }
  expect(at(1000).x).toBeGreaterThan(at(0).x);
  expect(at(7000).right).toBeCloseTo(at(7000).width, 1);
  expect(at(8000).x).toBeLessThan(at(7001).x);
  expect(at(14000).x).toBeCloseTo(0, 1);
  expect(at(15000).x).toBeGreaterThan(at(14001).x);
}

export async function rememberStudioRunner(page) {
  await page.locator('.studio-runner-travel').evaluate(node => {
    window.attemptRunner = { node, image: node.querySelector('img'),
      source: node.querySelector('img').currentSrc, animation: node.getAnimations()[0] };
  });
}

export async function expectSameStudioRunner(page) {
  expect(await page.locator('.studio-runner-travel').evaluate(node => {
    const previous = window.attemptRunner;
    return previous.node === node && previous.image === node.querySelector('img')
      && previous.source === node.querySelector('img').currentSrc
      && previous.animation === node.getAnimations()[0];
  })).toBe(true);
}
