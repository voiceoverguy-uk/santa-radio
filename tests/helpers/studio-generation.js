import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const emptyGeneration = () => ({ temporary: true });
export async function settleStudioScroll(page) {
  let previous, stable = 0;
  await expect.poll(async () => {
    const current = await page.evaluate(() => scrollY);
    stable = previous !== undefined && Math.abs(current - previous) < .5 ? stable + 1 : 0;
    previous = current;
    return stable;
  }, { intervals: [50], timeout: 5000 }).toBeGreaterThanOrEqual(3);
}
export async function expectStudioRecordingInView(page) {
  await settleStudioScroll(page);
  const result = page.getByRole('region', { name: 'Your finished Santa message' });
  await expect(result).toBeFocused();
  const visibility = await result.evaluate(node => {
    const viewport = window.visualViewport;
    const header = document.querySelector('.navbar').getBoundingClientRect();
    const dock = document.querySelector('.radio-dock').getBoundingClientRect();
    const safeBottom = parseFloat(getComputedStyle(node).getPropertyValue('--smw-safe-bottom')) || 0;
    const top = Math.max(header.bottom, viewport?.offsetTop || 0);
    const bottom = Math.min(innerHeight, (viewport?.offsetTop || 0) + (viewport?.height || innerHeight)) - safeBottom;
    return [...node.querySelectorAll('h4, audio, .smw-button-download')].every(control => {
      const box = control.getBoundingClientRect();
      const clearOfDock = !dock.height || box.right <= dock.left || box.left >= dock.right || box.bottom <= dock.top;
      const centre = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.top >= top && box.bottom <= bottom && box.left >= 0 && box.right <= innerWidth
        && clearOfDock && (centre === control || control.contains(centre));
    });
  });
  expect(visibility, 'Heading, player and MP3 download are together above fixed obstructions').toBe(true);
}
export async function confirmMessage(page, label = 'Create message') {
  await page.locator('.smw-actions--review').getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Ready to create your message?', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Create message', exact: true }).click();
}
// Current browser contract: one request-local MP3, no saved history or counters.
export async function mockStudioGeneration(page, { record = { id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2' }, tester = false } = {}) {
  const fixture = { state: { ...emptyGeneration(), testerCanStartAnother: tester }, posts: [], fail: false, hold: null,
    record, selection: choices => ({ record: { ...fixture.record, id: choices.name }, choices }),
    audio: readFileSync('server/santa-audio/sleighbells.mp3') };
  await page.context().route('**/api/santa-studio-message*', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (new URL(request.url()).searchParams.get('audio') === '1') {
        fixture.recoveries = (fixture.recoveries || 0) + 1;
        return route.fulfill({ status: 410, json: { error: 'Recordings are not saved.' } });
      }
      return route.fulfill({ json: fixture.state });
    }
    const payload = request.postDataJSON();
    fixture.posts.push(payload);
    if (fixture.hold) await fixture.hold;
    if (fixture.fail) return route.fulfill({ status: 503, json: { error: 'Fixture recording unavailable. Try again.' } });
    if (fixture.dropNext) {
      fixture.dropNext = false;
      return route.abort('failed');
    }
    return route.fulfill({ contentType: 'audio/mpeg',
      headers: { 'X-Studio-Selection': Buffer.from(JSON.stringify(fixture.selection(payload))).toString('base64'),
        'Content-Length': String(fixture.audio.length) },
      body: fixture.audio });
  });
  return fixture;
}
