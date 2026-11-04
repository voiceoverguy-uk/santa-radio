import { expect } from '@playwright/test';

export async function checkCreationIndicator(page, reducedMotion) {
  const bar = page.getByRole('progressbar', { name: 'Preparing your message', exact: true });
  await expect(bar).toBeVisible();
  await expect(bar).not.toHaveAttribute('aria-valuenow');
  await expect(bar).toHaveAttribute('aria-live', 'off');
  const segment = bar.locator('span');
  await expect(segment).toHaveCSS('animation-name', reducedMotion === 'reduce' ? 'none' : 'message-creation-travel');
  if (reducedMotion !== 'reduce') await expect(segment).toHaveCSS('animation-timing-function', 'ease-in-out');
  const geometry = await bar.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return { width: bounds.width, left: bounds.left, right: bounds.right,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.width).toBeLessThanOrEqual(240);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize().width);
  expect(geometry.overflow).toBe(false);
  if (reducedMotion === 'reduce') {
    const before = await segment.evaluate(node => getComputedStyle(node).transform);
    await page.waitForTimeout(150);
    expect(await segment.evaluate(node => getComputedStyle(node).transform)).toBe(before);
    expect(await segment.evaluate(node => {
      const track = node.parentElement.getBoundingClientRect(), part = node.getBoundingClientRect();
      return Math.abs((part.left + part.right) / 2 - (track.left + track.right) / 2);
    })).toBeLessThan(1);
    return;
  }
  // Verify real browser animation advances, then sample four complete trips,
  // including either side of each reversal, without wall-clock timing races.
  const before = await segment.evaluate(node => node.getAnimations()[0].currentTime);
  await expect.poll(() => segment.evaluate(node => node.getAnimations()[0].currentTime)).toBeGreaterThan(before);
  const samples = await segment.evaluate(node => {
    const animation = node.getAnimations()[0];
    const timing = animation.effect.getTiming();
    animation.pause();
    const samples = [];
    for (const time of [0, 100, 1000, 1900, 1999, 2000, 2001, 2100, 3000, 3900, 4000, 4100, 6000, 6100, 8000]) {
      animation.currentTime = time;
      const part = node.getBoundingClientRect(), track = node.parentElement.getBoundingClientRect();
      samples.push({ time, x: part.left - track.left, right: part.right - track.left,
        track: track.width, top: track.top, trackHeight: track.height, segmentHeight: part.height });
    }
    animation.play();
    return { timing, samples };
  });
  expect(samples.timing).toMatchObject({ direction: 'alternate', duration: 2000 });
  const at = time => samples.samples.find(sample => sample.time === time).x;
  expect(at(1000)).toBeGreaterThan(at(100));
  expect(at(1900)).toBeGreaterThan(at(1000));
  expect(at(2100)).toBeLessThan(at(2000));
  expect(at(3000)).toBeLessThan(at(2100));
  expect(Math.abs(at(1999) - at(2001))).toBeLessThan(.1);
  expect(Math.abs(at(2000) - at(1900))).toBeLessThan(3);
  expect(at(4000)).toBeCloseTo(at(0), 1);
  expect(at(6000)).toBeCloseTo(at(2000), 1);
  expect(at(6100)).toBeLessThan(at(6000));
  expect(at(8000)).toBeCloseTo(at(0), 1);
  for (const sample of samples.samples) {
    expect(sample.x).toBeGreaterThanOrEqual(0);
    expect(sample.right).toBeLessThanOrEqual(sample.track);
    expect(sample.top).toBe(samples.samples[0].top);
    // The track includes two 1px borders; the gold fills its 6px content area.
    expect(sample.trackHeight).toBe(8);
    expect(sample.segmentHeight).toBe(6);
  }
}

export async function holdRecordingBody(page, endpoint) {
  await page.evaluate(endpoint => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, options) => {
      const response = await original(input, options);
      if (input !== endpoint || options?.method !== 'POST' || !response.ok) return response;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, 1));
          window.finishIndicatorRecording = () => {
            controller.enqueue(bytes.slice(1));
            controller.close();
          };
        },
      }), { headers: response.headers });
    };
  }, endpoint);
}
