import { test, expect } from '@playwright/test';
import { defaultSettings, sourceContenderCatalogue } from '../src/lib/contenders.js';
import waveforms from '../src/lib/contender-waveforms.json' with { type: 'json' };

const catalogue = sourceContenderCatalogue.map(entry => ({
  ...entry, total: null, waveform: waveforms[entry.audio],
}));
const state = ready => ({
  entries: catalogue, settings: defaultSettings, ready,
  status: ready ? 'upcoming' : 'unavailable',
  demoStatus: ready ? 'open' : 'unavailable',
  realVotingEnabled: false, serverNow: new Date().toISOString(),
});
const selections = page => page.locator('input[name="contender-selection"]');
const selection = (page, id) => page.locator(`input[name="contender-selection"][value="${id}"]`);
const toggle = async (page, id) => {
  await selection(page, id).focus();
  await selection(page, id).press('Space');
};

test('outage keeps one compact disabled form, nine rows and switchable single choice', async ({ page }) => {
  await page.route('**/api/christmas-contenders', route =>
    route.fulfill({status:503,json:state(false)}));
  await page.goto('/christmas-contenders');
  const ballot = page.locator('#shared-ballot');
  await expect(page.locator('.contender-card')).toHaveCount(9);
  await expect(selections(page)).toHaveCount(9);
  await expect(page.getByText('Preview — voting unavailable', {exact:true})).toHaveCount(1);
  await expect(ballot.locator('input[type="email"]')).toHaveCount(1);
  await expect(ballot.locator('select, input[autocomplete="given-name"], input[autocomplete="family-name"]')).toHaveCount(0);
  await expect(ballot.getByLabel('Send me occasional Santa Radio updates')).not.toBeChecked();
  await expect(ballot.getByRole('button', {name:'Submit vote',exact:true})).toBeDisabled();
  await expect(ballot.getByRole('link', {name:'Privacy policy'})).toHaveAttribute('href','/privacy-policy');
  await expect(ballot).not.toContainText(/Brevo|provider|fingerprint|simulation|confirmation/i);
  await toggle(page, 'bob-the-elf');
  await expect(ballot).toContainText('Your choice: Bob the Elf — We Wish You a Merry Christmas');
  await toggle(page, 'sam-ringer-lonely-little-christmas-tree');
  await expect(selection(page, 'bob-the-elf')).not.toBeChecked();
  await expect(ballot).toContainText('Sam Ringer — Lonely Little Christmas Tree');
  await toggle(page, 'sam-ringer-lonely-little-christmas-tree');
  await expect(page.locator('input[name="contender-selection"]:checked')).toHaveCount(0);
});

for (const outcome of ['success', 'pending']) {
  test(`email-only single submit handles ${outcome} without another review or a resend`, async ({ page }) => {
    const requests = [];
    let viewerBallot;
    await page.route('**/api/christmas-contenders', async route => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON());
        viewerBallot = {state:outcome === 'success' ? 'confirmed' : 'pending',
          delivery:outcome === 'success' ? 'simulated' : 'unknown',reference:'fixture-reference'};
        await route.fulfill({json:{...viewerBallot,state:outcome}});
      } else await route.fulfill({json:{...state(true),viewerBallot}});
    });
    await page.goto('/christmas-contenders');
    const ballot = page.locator('#shared-ballot');
    await expect(selections(page)).toHaveCount(9);
    await toggle(page, 'sam-ringer-lonely-little-christmas-tree');
    await expect(ballot.getByRole('button',{name:'Submit vote',exact:true})).toBeDisabled();
    await toggle(page, 'bob-the-elf');
    await ballot.getByLabel('Email address', {exact:true}).fill('visitor@example.test');
    await ballot.getByRole('button',{name:'Submit vote',exact:true}).focus();
    await ballot.getByRole('button',{name:'Submit vote',exact:true}).press('Enter');
    await expect(ballot).toContainText(outcome === 'success'
      ? 'Test vote recorded.' : 'Your vote is still being checked.');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({action:'submit',mode:'demo',entryId:'bob-the-elf',
      email:'visitor@example.test',website:'',marketingOptIn:false});
    await expect(ballot.getByRole('button',{name:'Submit vote',exact:true})).toHaveCount(0);
    await expect(selections(page).first()).toBeDisabled();
  });
}
