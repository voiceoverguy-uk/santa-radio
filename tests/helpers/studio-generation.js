import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const emptyGeneration = () => ({ successes: 0, remaining: 2, locked: null, choices: null, record: null, pending: false });
export async function confirmMessage(page, label = 'Create message') {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Are you happy with your selection?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Create message', exact: true }).click();
}
// Models only the browser contract; real PostgreSQL accounting is exercised by
// santa-studio-generation.test.mjs, including independent handler instances.
export async function mockStudioGeneration(page, { record = { id: 'dixie-variant', name: 'Dixie', variant: 'Recording 2' } } = {}) {
  const fixture = { state: emptyGeneration(), posts: [], fail: false, hold: null,
    audio: readFileSync('server/santa-audio/sleighbells.mp3') };
  await page.context().route('**/api/santa-studio-message*', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (new URL(request.url()).searchParams.get('audio') === '1') {
        return route.fulfill({ contentType: 'audio/mpeg', body: fixture.audio });
      }
      return route.fulfill({ json: fixture.state });
    }
    const payload = request.postDataJSON();
    fixture.posts.push(payload);
    if (fixture.hold) await fixture.hold;
    if (fixture.fail) return route.fulfill({ status: 503, json: { error: 'Fixture recording unavailable. Try again.' } });
    const state = fixture.state;
    const identity = { name: payload.name, place: payload.place, region: payload.region || '',
      category: payload.place === 'forest' ? 'fantasy' : 'countries' };
    if (state.remaining === 0 || (state.locked && Object.keys(identity).some(key => identity[key] !== state.locked[key]))) {
      return route.fulfill({ status: 409, json: { error: 'The recorded name and full destination are locked.' } });
    }
    fixture.state = { successes: state.successes + 1, remaining: state.remaining - 1,
      locked: identity, choices: payload, record, pending: false };
    return route.fulfill({ contentType: 'audio/mpeg', headers: { 'X-Studio-Generation': String(fixture.state.successes) },
      body: fixture.audio });
  });
  return fixture;
}
