import { test, expect } from '@playwright/test';
import { ANALYSIS_MS, HOMEPAGE_ANALYSIS_MS, CHECKER_LAUNCH_MS, resultAnalysisMs } from '../src/naughty-or-nice/checkerLogic.js';

const path = '/naughty-or-nice-list-checker';
const office = page => page.locator('.nn-office');
const widget = page => page.locator('.nn-widget');

async function setup(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('santa-message-offer-shown', 'shown');
    // These checker tests are not consent tests. Avoid a late-hydrating
    // consent prompt intercepting a quiz click after the initial page load.
    localStorage.setItem('santaradio-cookie-consent-v2', JSON.stringify({
      version: 2, analytics: false, marketing: false, media: false, savedAt: Date.now(),
    }));
    window.checkerAudio = [];
    window.checkerEffects = [];
    window.checkerConnections = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    window.checkerNativePlay = originalPlay;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/naughty-or-nice/')) {
        (this.src.includes('/connecting.mp3') ? window.checkerConnections
          : this.src.includes('/checking') ? window.checkerAudio : window.checkerEffects).push(this.src);
        return Promise.reject(new DOMException('Controlled blocked playback', 'NotAllowedError'));
      }
      return originalPlay.call(this);
    };
  });
  await page.route(/youtube\.com|googlevideo\.com|global\.citrus3\.com/, route => route.abort());
  await page.route('**/api/radio-metadata*', route => route.fulfill({ json: {
    current: { title: 'Festive test', artist: 'Test' }, upcoming: [], chart: [],
  } }));
  await page.route('**/names-data/*.json', route => route.fulfill({ json: ['Arabella', 'Erin', 'Erica'] }));
}

async function open(page, url = path, clock = true) {
  await setup(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const decline = page.getByRole('button', { name: 'Decline optional cookies', exact: true });
  if (await decline.isVisible()) await decline.click();
  if (clock) await page.clock.install();
}

async function enter(page, name = 'Zorabelle', clock = true) {
  await office(page).getByRole('combobox').fill(name);
  await office(page).getByRole('button', { name: `Lets check if ${name.trim()} is Naughty or Nice`, exact: true }).click();
  await expect(office(page).getByRole('heading', { name: 'Connecting to Santa’s office…' })).toBeVisible();
  await expect(office(page).getByRole('button', { name: 'Back to name', exact: true })).toHaveCount(0);
  if (clock) await page.clock.runFor(1900);
  await expect(office(page).locator('fieldset')).toHaveCount(1);
  await expect(office(page).locator('.nn-question-count')).toHaveText('1 of 10');
}

async function answer(page, no = 0) {
  for (let i = 0; i < 10; i++) {
    await expect(office(page).locator('.nn-question-count')).toHaveText(`${i + 1} of 10`);
    await expect(office(page).locator('fieldset')).toHaveCount(1);
    await office(page).getByRole('button', { name: i < no ? 'No' : 'Yes', exact: true }).click();
  }
  await expect(office(page).getByRole('heading', { name: 'All ten answers are in!' })).toBeVisible();
  await expect(office(page).getByRole('button', { name: 'Back to name', exact: true })).toHaveCount(0);
  const submit = await office(page).locator('.nn-final-check').boundingBox();
  await expect(office(page).getByRole('button', { name: 'Previous question' })).toHaveCount(0);
  const restart = await office(page).getByRole('button', { name: 'Start a new name check', exact: true }).boundingBox();
  expect(restart.y).toBeGreaterThanOrEqual(submit.y + submit.height);
}

async function analyse(page) {
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await page.clock.runFor(5000);
  await expect(office(page).locator('.nn-result')).toHaveCount(0);
  await expect(office(page).getByRole('heading', { name: 'The Head Elf’s analyser is checking…' })).toBeVisible();
  await expect(office(page)).not.toContainText('Let Head Elf test you with a few questions to see how good you really are!');
  await expect(office(page).getByRole('timer')).toHaveText(/[23] seconds remaining/);
  await page.clock.runFor(ANALYSIS_MS - 5000 + 100);
  await expect(office(page).getByRole('timer')).toHaveCount(0);
}

test('entry button follows typed and selected names without changing the homepage Check button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await open(page);
  const input = office(page).getByRole('combobox');
  const button = office(page).locator('button[type="submit"]');
  await expect(button).toHaveText('Lets check if Naughty or Nice');
  await input.fill(' Charlotte ');
  await expect(button).toHaveText('Lets check if Charlotte is Naughty or Nice');
  await input.fill('Er');
  await office(page).getByRole('option', { name: 'Erin', exact: true }).click();
  await expect(button).toHaveText('Lets check if Erin is Naughty or Nice');
  await input.fill('Anne-Marie Rose');
  await expect(button).toHaveText('Lets check if Anne-Marie Rose is Naughty or Nice');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await input.fill('');
  await expect(button).toHaveText('Lets check if Naughty or Nice');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(widget(page).getByRole('button', { name: 'Check', exact: true })).toBeAttached();
});

for (const no of [0, 5, 6, 7, 8, 10]) {
  test(`${no} No answers gives the exact threshold result, safely personalised`, async ({ page }) => {
    await open(page);
    await enter(page);
    await answer(page, no);
    await analyse(page);
    const result = office(page).locator('.nn-result h2');
    await expect(result).toHaveText(no >= 6 ? 'Oh no! NAUGHTY LIST' : 'Zorabelle: NICE LIST!');
    await expect(result).toBeFocused();
    if (no >= 6) {
      const expression = no >= 8 ? 'extra-shocked' : 'shocked';
      const panel = office(page).locator('.nn-panel');
      await expect(panel).toHaveAttribute('data-elf-reaction', expression);
      expect(await panel.evaluate(element => getComputedStyle(element).borderImageSource))
        .toContain(`/images/head-elf-office-panel-${expression}.webp`);
      // The result expression persists beyond the question reaction timer,
      // including when four Yes answers previously earned a pleased baseline.
      await page.clock.runFor(2500);
      await expect(panel).toHaveAttribute('data-elf-reaction', expression);
      await expect(office(page)).not.toContainText('However… there is still time!');
      await expect(office(page).locator('.nn-result')).toContainText(/Zorabelle don't panic! With \d+ days? to go until Christmas there is still time to work on it and come and try again\./);
    }
    await expect(office(page)).not.toContainText('You matter, whatever the result.');
    await expect(office(page).getByRole('button', { name: 'Edit answers' })).toHaveCount(0);
    await expect(office(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
    if (no < 6) {
      await expect(office(page).getByRole('img', { name: 'Head Elf’s very unofficial Nice List certificate for Zorabelle' })).toBeVisible();
      await expect(office(page).locator('.studio-certificate__name')).toHaveAttribute('data-fitted', 'true');
      await expect(office(page).locator('.studio-certificate__name text')).toHaveText('Zorabelle');
    } else {
      await expect(office(page).getByRole('img', { name: /^Head Elf’s very unofficial Naughty List certificate for Zorabelle\. \d+ DAYS? TO GO\. THERE IS STILL TIME$/ })).toBeVisible();
      const stamp = office(page).locator('.nn-certificate-stamp');
      await expect(stamp.locator('.nn-stamp-message')).toHaveText('THERE IS STILL TIME');
      expect(await stamp.evaluate(element => getComputedStyle(element).color)).toBe('rgb(239, 41, 51)');
      expect(await stamp.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Black Ops One');
      await expect(office(page).locator('.studio-certificate__name')).toHaveAttribute('data-fitted', 'true');
    }
    await expect(office(page).getByRole('button', { name: 'Replay sound' })).toHaveCount(0);
  });
}

test('naughty certificate has bare cargo-stamp ink and UK Christmas days that update at midnight', async ({ page }, testInfo) => {
  await open(page, path, false);
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-05T12:00:01Z'));
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  await enter(page, 'Asa');
  await answer(page, 6);
  await analyse(page);
  const certificate = office(page).locator('.nn-certificate-preview--naughty .studio-certificate');
  await expect(certificate).toHaveAccessibleName('Head Elf’s very unofficial Naughty List certificate for Asa. 50 DAYS TO GO. THERE IS STILL TIME');
  const stamp = certificate.locator('.nn-certificate-stamp');
  await expect(stamp.locator('.nn-stamp-days')).toHaveText('50 DAYS TO GO');
  await expect(stamp.locator('.nn-stamp-message')).toHaveText('THERE IS STILL TIME');
  await page.evaluate(() => document.fonts.load('400 20px "Black Ops One"'));
  expect(await page.evaluate(() => document.fonts.check('400 20px "Black Ops One"'))).toBe(true);
  await expect(stamp).toHaveCSS('border-top-width', '0px');
  await expect(stamp).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(stamp).toHaveCSS('box-shadow', 'none');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(await stamp.evaluate(element => [...element.children].every(line => line.offsetWidth <= element.clientWidth + 1))).toBe(true);
    const ink = await stamp.boundingBox();
    const paper = await certificate.boundingBox();
    expect(ink.width).toBeGreaterThan(paper.width * .75);
    expect(Math.abs(ink.x + ink.width / 2 - paper.x - paper.width / 2)).toBeLessThan(paper.width * .03);
    const verticalCentre = (ink.y + ink.height / 2 - paper.y) / paper.height;
    expect(verticalCentre).toBeGreaterThan(.4);
    expect(verticalCentre).toBeLessThan(.6);
    expect(await stamp.locator('.nn-stamp-message').evaluate(element => parseFloat(getComputedStyle(element).fontSize)))
      .toBeGreaterThanOrEqual(paper.width * .07);
    expect(ink.x).toBeGreaterThanOrEqual(paper.x);
    expect(ink.x + ink.width).toBeLessThanOrEqual(paper.x + paper.width + 1);
    expect(ink.y).toBeGreaterThanOrEqual(paper.y);
    expect(ink.y + ink.height).toBeLessThanOrEqual(paper.y + paper.height);
    await certificate.screenshot({ path: testInfo.outputPath(`cargo-stamp-${width}.png`), animations: 'disabled' });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await stamp.evaluate(element => {
    const animations = element.getAnimations();
    animations.forEach(animation => animation.finish());
    return animations.length;
  })).toBeGreaterThan(0);
  const animatedInk = await stamp.boundingBox();
  const animatedPaper = await certificate.boundingBox();
  expect(Math.abs(animatedInk.x + animatedInk.width / 2 - animatedPaper.x - animatedPaper.width / 2))
    .toBeLessThan(animatedPaper.width * .03);
  expect(Math.abs(animatedInk.y + animatedInk.height / 2 - animatedPaper.y - animatedPaper.height / 2))
    .toBeLessThan(animatedPaper.height * .1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setSystemTime(new Date('2026-12-24T23:59:30Z'));
  await page.clock.runFor(60000);
  await expect(stamp.locator('.nn-stamp-days')).toHaveText('0 DAYS TO GO');
  await expect(certificate).toHaveAccessibleName('Head Elf’s very unofficial Naughty List certificate for Asa. 0 DAYS TO GO. THERE IS STILL TIME');
  await expect(office(page).locator('.nn-result > p').last()).toContainText('With 0 days to go until Christmas');
  await page.clock.setSystemTime(new Date('2026-12-26T12:00:00Z'));
  await page.clock.runFor(60000);
  await expect(stamp.locator('.nn-stamp-days')).toHaveText('364 DAYS TO GO');
  expect(await stamp.evaluate(element => [...element.children].every(line => line.offsetWidth <= element.clientWidth + 1))).toBe(true);
});

test('one question at a time; keyboard choices advance and previous answers can be changed before checking', async ({ page }) => {
  await open(page);
  const input = office(page).getByRole('combobox');
  await input.fill('Er');
  await expect(office(page).getByRole('listbox')).toBeVisible();
  await expect(office(page).getByText('Select your name and lets find out which list you are really on.', { exact: true })).toBeVisible();
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue('Erica');
  await input.press('Enter');
  await page.clock.runFor(1900);
  await expect(office(page).locator('fieldset')).toHaveCount(1);
  await expect(office(page).getByRole('button', { name: 'Let’s just have another little check!' })).toHaveCount(0);
  await expect(office(page).locator('legend')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(office(page).getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(office(page).locator('.nn-question-count')).toHaveText('2 of 10');
  await expect(office(page).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await expect(office(page).getByRole('button', { name: 'Yes', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await answer(page, 5);
  await expect(office(page).locator('.nn-question-count')).toHaveText('10 of 10');
  await expect(office(page).getByRole('button', { name: 'Previous question' })).toHaveCount(0);
  await analyse(page);
  await expect(office(page).locator('.nn-result h2')).toHaveText('Erica: NICE LIST!');
});

for (const width of [1280, 390]) {
  test(`office scenery keeps its scale through name entry and every stage at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await open(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await office(page).getByRole('button', { name: 'Sound: on' }).click();
    const scenery = office(page).locator('.nn-scenery');
    const scene = office(page).locator('.nn-scene');
    const originalWidth = (await scene.boundingBox()).width;
    const stable = async () => {
      await expect(scenery).toHaveCSS('background-size', '100% auto, 100% 100%');
      expect((await scene.boundingBox()).width).toBeCloseTo(originalWidth, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await stable();
    const input = office(page).getByRole('combobox');
    await input.fill('Er');
    await expect(office(page).getByRole('listbox')).toBeVisible();
    await stable();
    await office(page).getByRole('option', { name: 'Erin', exact: true }).click();
    await expect(office(page).getByRole('listbox')).toHaveCount(0);
    await stable();
    await office(page).getByRole('button', { name: 'Lets check if Erin is Naughty or Nice', exact: true }).click();
    await stable();
    await page.clock.runFor(1800);
    await stable();
    await answer(page);
    await stable();
    await analyse(page);
    await stable();
    await page.clock.runFor(ANALYSIS_MS);
    await expect(office(page).locator('.nn-result')).toBeVisible();
    await stable();
    await office(page).getByRole('button', { name: 'Start a new name check' }).click();
    await expect(office(page).getByRole('combobox')).toBeVisible();
    await stable();
  });
}

for (const choices of ['all-no', 'pleased-then-no']) {
  test(`question panel and workshop background stay the same size through ${choices} expression changes`, async ({ page }, testInfo) => {
    await open(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const panel = office(page).locator('.nn-panel');
    const geometry = () => office(page).evaluate(root => {
      const scene = root.querySelector('.nn-scene').getBoundingClientRect();
      const frame = root.querySelector('.nn-panel').getBoundingClientRect();
      const question = root.querySelector('.nn-question-step').getBoundingClientRect();
      const buttons = root.querySelector('.nn-question-buttons').getBoundingClientRect();
      const corners = root.querySelector('.nn-corner-controls').getBoundingClientRect();
      return {
        sceneWidth: scene.width, sceneHeight: scene.height,
        frameWidth: frame.width, frameHeight: frame.height,
        frameTop: frame.top - scene.top, questionHeight: question.height,
        buttonsTop: buttons.top - frame.top, cornersTop: corners.top - frame.top,
      };
    });
    for (const [width, size] of [[1280, ''], [390, ''], [320, ''], [320, '200%']]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(value => { document.documentElement.style.fontSize = value; }, size);
      await enter(page, 'Erin');
      await expect(office(page).getByRole('button', { name: 'Previous question', exact: true })).toHaveCount(0);
      const baseline = await geometry();
      for (let index = 0; index < 10; index++) {
        await expect(office(page).locator('fieldset')).toHaveAccessibleName(
          new RegExp(`^Question ${index + 1} of 10\\.`));
        const current = await geometry();
        for (const key of Object.keys(baseline)) expect(Math.abs(current[key] - baseline[key]), key).toBeLessThan(1);
        if (index === 1 || index === 6) {
          await panel.screenshot({ path: testInfo.outputPath(`${choices}-${width}-${size || 'normal'}-question-${index + 1}.png`), animations: 'disabled' });
        }
        const value = choices === 'pleased-then-no' && index < 4 ? 'Yes' : 'No';
        await office(page).getByRole('button', { name: value, exact: true }).click();
        const noCount = choices === 'all-no' ? index + 1 : index - 3;
        await expect(panel).toHaveAttribute('data-elf-reaction',
          value === 'Yes' ? 'thumbs-up' : noCount > 5 ? 'extra-shocked' : 'shocked');
        if (index < 9) {
          const during = await geometry();
          for (const key of Object.keys(baseline)) expect(Math.abs(during[key] - baseline[key]), key).toBeLessThan(1);
          await page.clock.runFor(2000);
          const after = await geometry();
          for (const key of Object.keys(baseline)) expect(Math.abs(after[key] - baseline[key]), key).toBeLessThan(1);
        }
      }
      await panel.getByRole('button', { name: 'Start a new name check', exact: true }).click();
    }
  });
}

test('all ten focused questions and answer buttons stay inside their box at desktop, phone and enlarged text sizes', async ({ page }, testInfo) => {
  await open(page);
  for (const [width, fontSize] of [[1280, ''], [390, ''], [320, ''], [320, '200%']]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
    await enter(page, 'Asa');
    const progress = await office(page).getByRole('progressbar').boundingBox();
    const mute = await office(page).getByRole('button', { name: 'Sound: on' }).boundingBox();
    expect(progress.y + progress.height).toBeLessThan(mute.y);
    await expect(office(page)).not.toContainText('Let Head Elf test you with a few questions to see how good you really are!');
    // Establish keyboard modality so containment includes the real focus treatment.
    await page.keyboard.press('Tab');
    await office(page).locator('legend').focus();
    for (let question = 0; question < 10; question++) {
      const field = office(page).locator('.nn-question-step');
      const legend = field.locator('legend');
      await expect(legend).toBeFocused();
      const box = await field.boundingBox();
      const wording = await legend.boundingBox();
      const buttons = await field.locator('.nn-question-buttons').boundingBox();
      const panel = await office(page).locator('.nn-panel').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
      expect(wording.x).toBeGreaterThanOrEqual(box.x + 8);
      expect(wording.x + wording.width).toBeLessThanOrEqual(box.x + box.width - 8);
      expect(wording.y).toBeGreaterThanOrEqual(box.y + 8);
      expect(wording.y + wording.height + 8).toBeLessThanOrEqual(buttons.y);
      expect(buttons.y + buttons.height + 8).toBeLessThanOrEqual(box.y + box.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (question === 6 || question === 7)
        await office(page).locator('.nn-panel').screenshot({
          path: testInfo.outputPath(`question-${question + 1}-${width}-${fontSize ? 'large' : 'normal'}.png`),
          animations: 'disabled',
        });
      await page.keyboard.press('Tab');
      await expect(field.getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
    }
    await expect(office(page).getByRole('heading', { name: 'All ten answers are in!' })).toBeVisible();
    await expect(office(page).getByRole('button', { name: 'Previous question' })).toHaveCount(0);
    await expect(office(page).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    const completeProgress = await office(page).getByRole('progressbar').boundingBox();
    const completeMute = await office(page).getByRole('button', { name: 'Sound: on' }).boundingBox();
    expect(completeProgress.y + completeProgress.height).toBeLessThan(completeMute.y);
    await office(page).locator('.nn-panel').screenshot({
      path: testInfo.outputPath(`questions-complete-${width}-${fontSize ? 'large' : 'normal'}.png`), animations: 'disabled',
    });
    await office(page).getByRole('button', { name: 'Start a new name check', exact: true }).click();
  }
});

for (const outcome of ['nice', 'naughty']) {
  test(`curious Head Elf appears one second into final processing for the ${outcome} certificate`, async ({ page }, testInfo) => {
    await open(page);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await enter(page);
    await answer(page, outcome === 'naughty' ? 6 : 0);
    const panel = office(page).locator('.nn-panel');
    await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
    const duration = resultAnalysisMs(outcome);
    await page.clock.runFor(999);
    await expect(panel).not.toHaveAttribute('data-elf-reaction', 'curious');
    await page.clock.runFor(1);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'curious');
    await expect(panel.locator('.nn-elf-artwork-layer--curious')).toHaveCSS('opacity', '1');
    await expect(office(page).locator('.nn-result')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 1000 });
    await panel.screenshot({ path: testInfo.outputPath(`curious-before-${outcome}.png`), animations: 'disabled' });
    await page.clock.runFor(duration - 1000 - 1);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'curious');
    await expect(office(page).getByRole('timer')).toHaveText('0 seconds remaining');
    await page.clock.runFor(1);
    await expect(office(page).locator(`.nn-result--${outcome}`)).toBeVisible();
    await expect(panel).toHaveAttribute('data-elf-reaction', outcome === 'naughty' ? 'shocked' : 'pleased');
  });
}

test('curious expression follows stalled media rather than wall time and clears on Back to answers and reset', async ({ page }) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  await answer(page);
  await page.evaluate(() => {
    const NativeAudio = window.Audio;
    window.outcomePosition = 0;
    window.Audio = function (src) {
      const clip = new NativeAudio(src);
      if (src.includes('/checking-nice')) {
        Object.defineProperty(clip, 'duration', { get: () => 8.412 });
        Object.defineProperty(clip, 'currentTime', { get: () => window.outcomePosition });
        clip.play = () => Promise.resolve();
      }
      return clip;
    };
  });
  const panel = office(page).locator('.nn-panel');
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await page.clock.runFor(5000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  await page.evaluate(() => { window.outcomePosition = .999; });
  await page.clock.runFor(50);
  await expect(panel).not.toHaveAttribute('data-elf-reaction', 'curious');
  await page.evaluate(() => { window.outcomePosition = 1; });
  await page.clock.runFor(50);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'curious');
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'curious');
  await expect(office(page).locator('.nn-result')).toHaveCount(0);
  await office(page).getByRole('button', { name: 'Back to answers' }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await page.clock.runFor(10000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(office(page).getByRole('combobox')).toHaveValue('');
});

test('all elf expressions load at entry and retained layers switch without moving the frame or fetching again', async ({ page }) => {
  const loaded = new Set();
  const requests = [];
  page.on('requestfinished', request => {
    if (/head-elf-office-panel-[\w-]+\.webp/.test(request.url())) loaded.add(request.url());
  });
  page.on('request', request => {
    if (/head-elf-office-panel-[\w-]+\.webp/.test(request.url())) requests.push(request.url());
  });
  await open(page);
  await expect.poll(() => loaded.size).toBe(7);
  const panel = office(page).locator('.nn-panel');
  await expect(panel.locator('.nn-elf-artwork')).toHaveAttribute('aria-hidden', 'true');
  await expect(panel.locator('.nn-elf-artwork-layer')).toHaveCount(6);
  const afterEntry = requests.length;
  await enter(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await panel.evaluate(element => {
      const frame = element.getBoundingClientRect();
      return [...element.querySelectorAll('.nn-elf-artwork-layer')].map(layer => {
        const box = layer.getBoundingClientRect();
        return Math.max(Math.abs(box.x - frame.x), Math.abs(box.y - frame.y),
          Math.abs(box.width - frame.width), Math.abs(box.height - frame.height));
      });
    });
    // Used border widths are pixel-quantised, while percentage-derived
    // negative offsets retain fractions; allow less than two CSS pixels.
    expect(Math.max(...geometry)).toBeLessThan(2);
  }
  const before = await panel.boundingBox();
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel.locator('.nn-elf-artwork-layer--shocked')).toHaveCSS('opacity', '1');
  await page.clock.runFor(2000);
  await expect(panel.locator('.nn-elf-artwork-layer--shocked')).toHaveCSS('opacity', '0');
  const after = await panel.boundingBox();
  expect(after.width).toBeCloseTo(before.width);
  expect(after.height).toBeCloseTo(before.height);
  expect(requests.length).toBe(afterEntry);
});

test('machine glints stay anchored, click-through and clear of displays, and respect reduced motion', async ({ page }, testInfo) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await enter(page);
  await answer(page);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  const glints = office(page).locator('.nn-machine-glints');
  await expect(glints).toHaveAttribute('data-variant', 'final');
  await expect(glints).toHaveAttribute('aria-hidden', 'true');
  await expect(glints).toHaveCSS('pointer-events', 'none');
  await expect(glints.locator('i')).toHaveCount(8);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await glints.evaluate(element => {
      const box = element.getBoundingClientRect();
      const image = element.parentElement.querySelector('img').getBoundingClientRect();
      return { difference: Math.abs(box.width - image.width) + Math.abs(box.height - image.height),
        anchors: [...element.children].map(child => ({
          x: parseFloat(child.style.getPropertyValue('--x')),
          y: parseFloat(child.style.getPropertyValue('--y')),
          animation: getComputedStyle(child).animationName,
        })) };
    });
    expect(bounds.difference).toBeLessThan(1);
    for (const anchor of bounds.anchors) {
      expect(anchor.y).toBeLessThan(30);
      expect(anchor.animation).toBe('nn-glint');
    }
    await glints.locator('i').first().evaluate(element => {
      for (const animation of element.getAnimations()) { animation.pause(); animation.currentTime = 240; }
    });
    await office(page).locator('.nn-panel').screenshot({ path: testInfo.outputPath(`machine-glints-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(glints).toHaveCSS('display', 'none');
  await expect(glints.locator('i').first()).toHaveCSS('animation-name', 'none');
});

test('five or more consecutive Yes answers show double thumbs-up for two seconds, then revert', async ({ page }, testInfo) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  const yes = office(page).getByRole('button', { name: 'Yes', exact: true });
  for (let i = 0; i < 4; i++) {
    await yes.click();
    await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  }
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'double-thumbs-up');
  await expect(panel.locator('.nn-elf-artwork-layer--double-thumbs-up')).toHaveCSS('opacity', '1');
  await expect(office(page).locator('.nn-question-count')).toHaveText('6 of 10');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.screenshot({ path: testInfo.outputPath(`double-thumbs-up-${width}.png`), animations: 'disabled' });
  }
  await page.clock.runFor(1999);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'double-thumbs-up');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'double-thumbs-up');
  await page.clock.runFor(1000);
  await yes.click();
  await page.clock.runFor(1000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'double-thumbs-up');
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await panel.getByRole('button', { name: 'Start a new name check' }).click();
  await page.clock.runFor(3000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
});

test('re-answering one question cannot create a five-answer double thumbs-up streak', async ({ page }) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  for (let i = 0; i < 6; i++) {
    await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
    await office(page).getByRole('button', { name: 'Previous question' }).click();
  }
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
});

test('each Yes shows thumbs-up for two seconds while the next question remains usable and the latest answer wins', async ({ page }, testInfo) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  const yes = office(page).getByRole('button', { name: 'Yes', exact: true });
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await expect(panel.locator('.nn-elf-artwork-layer--thumbs-up')).toHaveCSS('opacity', '1');
  await expect(office(page).locator('.nn-question-count')).toHaveText('2 of 10');
  await page.clock.runFor(1500);
  await yes.click();
  await expect(office(page).locator('.nn-question-count')).toHaveText('3 of 10');
  await page.clock.runFor(500);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(50);
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.screenshot({ path: testInfo.outputPath(`thumbs-up-${width}.png`), animations: 'disabled' });
  }
  await page.clock.runFor(1999);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await yes.click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await panel.getByRole('button', { name: 'Start a new name check' }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await page.clock.runFor(5000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(office(page).getByRole('combobox')).toHaveValue('');
});

test('unavailable thumbs-up artwork keeps the regular frame and does not block answering', async ({ page }) => {
  let requested = false;
  await page.route('**/images/head-elf-office-panel-thumbs-up.webp', route => {
    requested = true;
    return route.abort();
  });
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  await expect.poll(() => requested).toBe(true);
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await page.clock.runFor(3000);
  const panel = office(page).locator('.nn-panel');
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(panel).toHaveCSS('border-image-source', /head-elf-office-panel-jolly\.webp/);
  await expect(office(page).locator('.nn-question-count')).toHaveText('2 of 10');
});

test('four consecutive Yes answers earn pleased artwork for the rest of the check with temporary No reactions', async ({ page }, testInfo) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  for (let i = 0; i < 3; i++) {
    await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
    await page.clock.runFor(2000);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  }
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  await expect(panel.locator('.nn-elf-artwork-layer--pleased')).toHaveCSS('opacity', '1');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.screenshot({ path: testInfo.outputPath(`pleased-${width}.png`), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.clock.runFor(5000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  for (let i = 0; i < 6; i++) {
    await office(page).getByRole('button', { name: 'No', exact: true }).click();
    await expect(panel).toHaveAttribute('data-elf-reaction', i < 5 ? 'shocked' : 'extra-shocked');
    await page.clock.runFor(2000);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  }
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await page.clock.runFor(999);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'curious');
  await page.clock.runFor(resultAnalysisMs('naughty') - 1000);
  await expect(office(page).locator('.nn-result--naughty')).toBeVisible();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await page.clock.runFor(5000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(office(page).getByRole('combobox')).toHaveValue('');
});

test('separated Yes answers and re-clicking one question cannot manufacture a four-answer streak', async ({ page }) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  for (let i = 0; i < 5; i++) {
    await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
    await office(page).getByRole('button', { name: 'Previous question' }).click();
    await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
    await page.clock.runFor(2000);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  }
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  for (const value of ['Yes', 'No', 'Yes', 'Yes', 'Yes']) {
    await office(page).getByRole('button', { name: value, exact: true }).click();
    await page.clock.runFor(2000);
    await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  }
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
  // Editing away the earned streak doesn't revoke the rest-of-check expression.
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'pleased');
});

test('No answers show the supplied expressions for two seconds using the current edited answer count', async ({ page }, testInfo) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page, 'Erin');
  const panel = office(page).locator('.nn-panel');
  await page.evaluate(async () => {
    await Promise.all(['shocked', 'extra-shocked'].map(async kind => {
      const image = new Image();
      image.src = `/images/head-elf-office-panel-${kind}.webp`;
      await image.decode();
    }));
  });
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  for (let count = 1; count <= 5; count++) {
    await office(page).getByRole('button', { name: 'No', exact: true }).click();
    await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
    await expect(panel.locator('.nn-elf-artwork-layer--shocked')).toHaveCSS('opacity', '1');
    await page.clock.runFor(500);
  }
  // Re-answering an existing No must not count it twice.
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(1999);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'extra-shocked');
  await expect(panel.locator('.nn-elf-artwork-layer--extra-shocked')).toHaveCSS('opacity', '1');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const during = await panel.boundingBox();
    await panel.screenshot({ path: testInfo.outputPath(`elf-extra-shocked-${width}.png`), animations: 'disabled' });
    expect(during.x).toBeGreaterThanOrEqual(0);
    expect(during.x + during.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.clock.runFor(1999);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'extra-shocked');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'thumbs-up');
  await page.clock.runFor(2000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  // Change the sixth No to Yes, then No again: the threshold remains six.
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await office(page).getByRole('button', { name: 'Previous question' }).click();
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'extra-shocked');
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await page.clock.runFor(3000);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(office(page).getByRole('combobox')).toHaveValue('');
});

test('a repeated No restarts its two-second hold and forced colours preserve the plain frame', async ({ page }) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  const panel = office(page).locator('.nn-panel');
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(1500);
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(500);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(panel).toHaveCSS('border-image-source', 'none');
  await page.clock.runFor(1499);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'shocked');
  await page.clock.runFor(1);
  await expect(panel).toHaveAttribute('data-elf-reaction', 'regular');
});

test('reset cancels a reaction still waiting for artwork decoding', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      if (!this.src.endsWith('/head-elf-office-panel-shocked.webp')) return decode.call(this);
      return decode.call(this).then(() => new Promise(resolve => { window.releaseElfReaction = resolve; }));
    };
  });
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await enter(page);
  await expect.poll(() => page.evaluate(() => typeof window.releaseElfReaction)).toBe('function');
  await office(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(office(page).locator('.nn-panel')).toHaveAttribute('data-elf-reaction', 'regular');
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await page.evaluate(() => window.releaseElfReaction());
  await page.clock.runFor(3000);
  await expect(office(page).locator('.nn-panel')).toHaveAttribute('data-elf-reaction', 'regular');
  await expect(office(page).getByRole('combobox')).toBeFocused();
});

test('connecting recording plays only on its screen, follows mute and stops before the questions', async ({ page }) => {
  await open(page, path, false);
  const duration = await page.evaluate(async () => {
    const context = new AudioContext();
    const response = await fetch('/audio/naughty-or-nice/connecting.mp3');
    const decoded = await context.decodeAudioData(await response.arrayBuffer());
    await context.close();
    HTMLMediaElement.prototype.play = window.checkerNativePlay;
    const NativeAudio = window.Audio;
    window.connectionPlayed = 0;
    window.Audio = function (src) {
      const clip = new NativeAudio(src);
      if (src.endsWith('/connecting.mp3')) {
        window.connectionClip = clip;
        clip.addEventListener('playing', () => { window.connectionPlayed++; });
      }
      return clip;
    };
    return decoded.duration;
  });
  expect(duration).toBeGreaterThan(1);
  expect(duration).toBeLessThan(1.8);
  await office(page).getByRole('combobox').fill('Erin');
  await office(page).getByRole('button', { name: 'Lets check if Erin is Naughty or Nice', exact: true }).click();
  await expect(office(page).getByRole('heading', { name: 'Connecting to Santa’s office…' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.connectionPlayed)).toBe(1);
  await expect(office(page).locator('.nn-question-count')).toHaveText('1 of 10');
  expect(await page.evaluate(() => ({
    paused: window.connectionClip.paused, src: window.connectionClip.getAttribute('src'),
  }))).toEqual({ paused: true, src: null });
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  await enter(page, 'Erin', false);
  expect(await page.evaluate(() => window.connectionPlayed)).toBe(1);
});

test('one bottom-left arrow resets connecting, questions and analysis without duplicate Start over controls', async ({ page }) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const panel = office(page).locator('.nn-panel');
  const arrow = panel.getByRole('button', { name: 'Start a new name check', exact: true });
  const input = panel.getByRole('combobox', { name: 'Confirm first name' });
  await expect(arrow).toHaveCount(0);
  for (const stage of ['connecting', 'questions', 'analysis']) {
    await input.fill('Erin');
    await panel.getByRole('button', { name: 'Lets check if Erin is Naughty or Nice', exact: true }).click();
    if (stage !== 'connecting') await page.clock.runFor(1900);
    if (stage === 'analysis') {
      await answer(page);
      await panel.getByRole('button', { name: 'Let’s just have another little check!' }).click();
    }
    await expect(arrow).toHaveCount(1);
    await expect(arrow.locator('img')).toHaveAttribute('src', '/images/checker-back.webp');
    await expect(panel.getByRole('button', { name: 'Start over', exact: true })).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const left = await arrow.boundingBox();
      const right = await panel.getByRole('button', { name: 'Sound: on' }).boundingBox();
      const content = await panel.locator('.nn-stage').boundingBox();
      expect(left.x + left.width).toBeLessThan(right.x);
      expect(left.y).toBeGreaterThanOrEqual(content.y + content.height);
      expect(left.height).toBeGreaterThanOrEqual(44);
    }
    await arrow.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(arrow).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(arrow).toHaveCount(0);
    await page.clock.runFor(30000);
    await expect(panel.locator('.nn-result')).toHaveCount(0);
    await expect(input).toHaveValue('');
  }
});

test('question answers pop, red checks click, and muting suppresses both without changing quiz behaviour', async ({ page }) => {
  await open(page);
  await enter(page, 'Erin');
  await answer(page);
  expect(await page.evaluate(() => window.checkerEffects.map(url => url.split('/').at(-1)))).toEqual([
    'click-1.mp3', ...Array(10).fill('pop-1.mp3'),
  ]);
  await analyse(page);
  expect(await page.evaluate(() => window.checkerEffects.map(url => url.split('/').at(-1)))).toEqual([
    'click-1.mp3', ...Array(10).fill('pop-1.mp3'), 'click-1.mp3',
  ]);
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  const before = await page.evaluate(() => window.checkerEffects.length);
  await enter(page, 'Erin');
  await answer(page);
  await analyse(page);
  expect(await page.evaluate(() => window.checkerEffects.length)).toBe(before);
});

for (const homepage of [true, false]) {
  test(`${homepage ? 'homepage' : 'Head Elf'} silent analyser holds 00 before its result`, async ({ page }) => {
    await open(page, homepage ? '/' : path);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const scope = homepage ? widget(page) : office(page);
    await scope.getByRole('button', { name: 'Sound: on' }).click();
    if (homepage) {
      await scope.getByRole('combobox').fill('Erin');
      await scope.getByRole('button', { name: 'Check', exact: true }).click();
      await page.clock.runFor(CHECKER_LAUNCH_MS);
    } else {
      await enter(page, 'Erin');
      await answer(page);
      await scope.getByRole('button', { name: 'Let’s just have another little check!' }).click();
    }
    const duration = homepage ? HOMEPAGE_ANALYSIS_MS : ANALYSIS_MS;
    await page.clock.runFor(duration - 250);
    await expect(scope.getByRole('timer')).toHaveText('0 seconds remaining');
    await expect(scope.locator('.nn-result')).toHaveCount(0);
    await page.clock.runFor(250);
    await expect(scope.locator('.nn-result')).toBeVisible();
  });
}

test('supplied pop and click effects decode, play and stop on mute without stopping the long recording', async ({ page }) => {
  await open(page, path, false);
  const state = await page.evaluate(async () => {
    const context = new AudioContext();
    const durations = [];
    for (const file of ['pop-1.mp3', 'click-1.mp3']) {
      const response = await fetch(`/audio/naughty-or-nice/${file}`);
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      durations.push(decoded.duration);
    }
    await context.close();
    HTMLMediaElement.prototype.play = window.checkerNativePlay;
    const NativeAudio = window.Audio;
    window.effectsPlayed = [];
    window.Audio = function (src) {
      const clip = new NativeAudio(src);
      clip.addEventListener('playing', () => window.effectsPlayed.push(src.split('/').at(-1)));
      return clip;
    };
    return durations;
  });
  expect(state.every(duration => duration > 0 && duration < 3)).toBe(true);
  await enter(page, 'Erin', false);
  await expect.poll(() => page.evaluate(() => window.effectsPlayed)).toContain('click-1.mp3');
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.effectsPlayed)).toContain('pop-1.mp3');
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  const count = await page.evaluate(() => window.effectsPlayed.length);
  await office(page).getByRole('button', { name: 'Yes', exact: true }).click();
  expect(await page.evaluate(() => window.effectsPlayed.length)).toBe(count);
});

test('homepage corner controls fit entry, suggestions, launch, checking and result including enlarged text', async ({ page }, testInfo) => {
  await open(page, '/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const frame = widget(page).locator('.nn-widget-frame');
  const input = widget(page).getByRole('combobox', { name: 'Confirm first name', exact: true });
  const restart = widget(page).getByRole('button', { name: 'Start a new name check', exact: true });
  const sound = widget(page).getByRole('button', { name: 'Sound: off', exact: true });
  await widget(page).getByRole('button', { name: 'Sound: on' }).click();
  for (const [width, fontSize] of [[1280, ''], [390, ''], [320, ''], [320, '200%']]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
    const checkLayout = async (stage, content) => {
      const panel = await frame.boundingBox();
      const left = await restart.count() ? await restart.boundingBox() : null;
      const right = await sound.boundingBox();
      const body = await content.boundingBox();
      const border = await frame.evaluate(element => parseFloat(getComputedStyle(element).borderBottomWidth));
      const outset = await widget(page).locator('.nn-corner-controls').evaluate(element =>
        -parseFloat(getComputedStyle(element).marginLeft));
      for (const box of [left, right].filter(Boolean)) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y).toBeGreaterThanOrEqual(body.y + body.height);
        expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height - border + outset + 1);
        expect(panel.y + panel.height - box.y - box.height).toBeGreaterThanOrEqual(20);
      }
      if (left) expect(left.x).toBeGreaterThanOrEqual(panel.x + border - outset);
      expect(right.x + right.width).toBeLessThanOrEqual(panel.x + panel.width - border + outset + 1);
      if (left) expect(left.x - panel.x).toBeGreaterThanOrEqual(20);
      expect(outset).toBeGreaterThanOrEqual(10);
      if (left) expect(left.x + left.width).toBeLessThanOrEqual(right.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await frame.screenshot({ path: testInfo.outputPath(`corner-${stage}-${width}-${fontSize || 'normal'}.png`), animations: 'disabled' });
    };
    await expect(input).toHaveValue('');
    await expect(restart).toHaveCount(0);
    await checkLayout('entry', widget(page).locator('.nn-name-form'));
    await input.fill('Er');
    await expect(widget(page).getByRole('listbox')).toBeVisible();
    await checkLayout('suggestions', widget(page).getByRole('listbox'));
    await input.press('ArrowDown');
    await input.press('Enter');
    await input.press('Enter');
    await expect(input).toBeDisabled();
    await expect(restart).toHaveCount(1);
    await checkLayout('launch', widget(page).locator('.nn-name-form'));
    await expect(widget(page).getByRole('button', { name: 'Cancel check' })).toHaveCount(0);
    await page.clock.runFor(500);
    await checkLayout('checking', widget(page).locator('.nn-stage'));
    await page.clock.runFor(HOMEPAGE_ANALYSIS_MS);
    await checkLayout('result', widget(page).locator('.nn-result'));
    await expect(widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true })).toBeVisible();
    await restart.click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
  }
});

test('corner buttons support keyboard reset, image failure and forced colours without touching radio', async ({ page }) => {
  await page.route('**/images/checker-*.webp', route => route.abort());
  await open(page, '/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const input = widget(page).getByRole('combobox', { name: 'Confirm first name', exact: true });
  const restart = widget(page).getByRole('button', { name: 'Start a new name check' });
  const radioBefore = await page.locator('.radio-dock').getAttribute('class');
  await input.fill('Erin');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).focus();
  await expect(restart).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(restart).toBeFocused();
  await expect(restart).toHaveCSS('outline-style', 'solid');
  await expect(restart.getByText('Start again')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await input.fill('Erin');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  // Reset in the launch state before its delayed checking panel can appear.
  await restart.focus();
  await page.keyboard.press('Space');
  await expect(input).toBeFocused();
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + 20000);
  await expect(widget(page).locator('.nn-stage, .nn-result')).toHaveCount(0);
  await expect(input).toHaveValue('');
  await page.emulateMedia({ forcedColors: 'active' });
  await widget(page).getByRole('button', { name: 'Check', exact: true }).focus();
  await page.keyboard.press('Tab');
  const sound = widget(page).getByRole('button', { name: 'Sound: on' });
  await expect(sound).toBeFocused();
  await expect(sound).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(widget(page).getByRole('button', { name: 'Sound: off' })).toHaveAttribute('aria-pressed', 'false');
  await expect(widget(page).getByText('Sound off', { exact: true })).toBeVisible();
  expect(await page.locator('.radio-dock').getAttribute('class')).toBe(radioBefore);
  await page.goto(path);
  await expect(office(page).getByRole('combobox', { name: 'Confirm first name', exact: true })).toBeVisible();
  await expect(office(page).locator('.nn-corner-controls')).toHaveCount(1);
  await expect(office(page).getByText('Sound on', { exact: true })).toBeVisible();
  await expect(office(page).locator('.nn-sound')).toHaveCount(0);
});

for (const position of [0, .6, 11.4]) {
  test(`corner reset stops real checker media at ${position}s and invalidates queued callbacks`, async ({ page }) => {
    await open(page, '/');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.evaluate(() => {
      const NativeAudio = window.Audio;
      window.checkerPosition = 0;
      window.Audio = function (src) {
        const audio = new NativeAudio(src);
        window.activeCheckerAudio = audio;
        Object.defineProperty(audio, 'duration', { get: () => 11.598367 });
        Object.defineProperty(audio, 'currentTime', { get: () => window.checkerPosition });
        audio.play = () => Promise.resolve();
        return audio;
      };
    });
    await widget(page).getByRole('combobox').fill('Erin');
    await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
    await page.clock.runFor(CHECKER_LAUNCH_MS);
    await page.evaluate(value => {
      window.checkerPosition = value;
      window.queuedCheckerEnd = window.activeCheckerAudio.onended;
    }, position);
    await page.clock.runFor(50);
    if (position > 11) await expect(widget(page).locator('.nn-result')).toBeVisible();
    await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
    expect(await page.evaluate(() => ({
      paused: window.activeCheckerAudio.paused,
      src: window.activeCheckerAudio.getAttribute('src'),
      ended: window.activeCheckerAudio.onended,
    }))).toEqual({ paused: true, src: null, ended: null });
    await page.evaluate(() => window.queuedCheckerEnd?.());
    await page.clock.runFor(30000);
    await expect(widget(page).locator('.nn-stage, .nn-result')).toHaveCount(0);
    await expect(widget(page).getByRole('combobox')).toHaveValue('');
    await expect(widget(page).getByRole('combobox')).toBeFocused();
    await expect(widget(page).getByRole('button', { name: 'Sound: on' })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('homepage supplied logo and parchment frame keep live controls responsive in all stages', async ({ page }, testInfo) => {
  await open(page, '/');
  await expect(widget(page).locator('.nn-help')).toHaveText('Enter a first name.');
  await expect(widget(page)).not.toContainText('Suggestions appear after two letters');
  const logo = widget(page).locator('.nn-widget-logo img');
  await expect(logo).toHaveAttribute('alt', '');
  await expect(widget(page).getByRole('img')).toHaveCount(0);
  await expect(widget(page).getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(widget(page).getByRole('heading', { name: 'Head Elf’s Naughty or Nice List Checker' })).toBeVisible();
  await expect(widget(page).locator('.nn-intro')).toHaveText('Enter your first name for a quick North Pole check. Then visit Head Elf for the full Christmas quiz.');
  await expect(widget(page)).not.toContainText('The Head Elf’s desk is open.');
  await expect(widget(page)).not.toContainText('Let Head Elf test you with a few questions');
  const quizIntro = page.locator('.nn-quiz-intro');
  await expect(page.locator('.santa-dash-promo + .nn-widget + .christmas-pairs')).toHaveCount(1);
  await expect(widget(page).locator(':scope > header.nn-quiz-intro')).toHaveCount(1);
  await expect(page.locator('.home-page > .nn-quiz-intro')).toHaveCount(0);
  await expect(widget(page)).toHaveAccessibleName('WHICH LIST ARE YOU ON?');
  await expect(quizIntro.getByRole('heading', { name: 'WHICH LIST ARE YOU ON?', level: 2 })).toBeVisible();
  await expect(quizIntro.locator('.homepage-section-heading__eyebrow')).toHaveText('Naughty or Nice?');
  await expect(quizIntro.locator('.homepage-section-heading__subtitle')).toHaveText('Head Elf has ten festive questions about kindness, helping out and trying your best. Answer them to find out which of Santa’s lists you’re on this Christmas.');
  await expect(quizIntro.locator('.homepage-section-heading__divider')).toHaveAttribute('aria-hidden', 'true');
  await expect(quizIntro.locator('.homepage-section-heading__divider + h2')).toHaveText('WHICH LIST ARE YOU ON?');
  await expect(quizIntro.locator('.homepage-section-heading__divider svg')).toBeVisible();
  const introStyle = await quizIntro.locator('.nn-quiz-intro-inner').evaluate(element => {
    const style = getComputedStyle(element);
    return [style.backgroundImage, style.backgroundColor, style.borderTopWidth, style.boxShadow];
  });
  expect(introStyle).toEqual(['none', 'rgba(0, 0, 0, 0)', '0px', 'none']);
  await expect(quizIntro).toHaveCSS('background-image', 'none');
  await expect(quizIntro).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(quizIntro.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Play the Naughty or Nice List Checker' })).toHaveCount(0);
  expect(await logo.evaluate(async image => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([1659, 948]);
  const frame = widget(page).locator('.nn-widget-frame');
  await expect(frame).toHaveCSS('border-image-source', /\/images\/naughty-or-nice-form-panel\.webp/);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const a = await logo.boundingBox();
    const b = await frame.boundingBox();
    expect(a.width / a.height).toBeCloseTo(1659 / 948, 2);
    if (width > 767) expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    else expect(a.y + a.height).toBeLessThanOrEqual(b.y);
    const heading = await quizIntro.boundingBox();
    expect(heading.y + heading.height).toBeLessThanOrEqual(Math.min(a.y, b.y) + 1);
    await expect(quizIntro.locator('.homepage-section-heading__subtitle')).toHaveCSS('text-align', 'center');
    await expect(widget(page).locator('.nn-intro')).toHaveCSS('text-align', 'center');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const input = await widget(page).getByRole('combobox').boundingBox();
    expect(input.x).toBeGreaterThan(b.x);
    expect(input.x + input.width).toBeLessThan(b.x + b.width);
    await quizIntro.scrollIntoViewIfNeeded();
    const clip = await page.evaluate(() => {
      const intro = document.querySelector('.nn-quiz-intro').getBoundingClientRect();
      const checker = document.querySelector('.nn-widget').getBoundingClientRect();
      return { x: 0, y: intro.top + scrollY, width: innerWidth, height: checker.bottom - intro.top };
    });
    await page.screenshot({ path: testInfo.outputPath(`homepage-checker-heading-${width}.png`), fullPage: true, clip, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await widget(page).getByRole('combobox').fill('Alexanderthegreatchristmas');
  await widget(page).getByRole('combobox').press('Enter');
  await page.clock.runFor(600);
  await expect(widget(page).getByRole('heading', { name: 'Checking at the North Pole…' })).toBeVisible();
  await expect(quizIntro.getByRole('link')).toHaveCount(0);
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS);
  await expect(widget(page).locator('.nn-score')).toBeVisible();
  await expect(quizIntro.getByRole('link')).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const b = await frame.boundingBox();
    const link = await widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true }).boundingBox();
    expect(link.x).toBeGreaterThan(b.x);
    expect(link.x + link.width).toBeLessThan(b.x + b.width);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await widget(page).screenshot({ path: testInfo.outputPath('homepage-art-phone-result.png'), animations: 'disabled' });
  await quizIntro.screenshot({ path: testInfo.outputPath('homepage-quiz-intro-phone.png'), animations: 'disabled' });
  await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
  await expect(widget(page).getByRole('combobox')).toHaveValue('');
  await widget(page).getByRole('combobox').fill('Asa');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS + 100);
  const headElfLink = widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true });
  await headElfLink.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(headElfLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(path);
  await expect(page).toHaveTitle('Santa’s Naughty or Nice List Checker | Santa Radio');
  await expect(office(page).getByRole('combobox')).toHaveValue('Asa');
  expect(await office(page).locator('.nn-panel').evaluate(element => getComputedStyle(element).borderImageSource))
    .toContain('/images/head-elf-office-panel-jolly.webp');
});

for (const [random, score] of [[0, 51], [.99999, 73]]) {
  test(`homepage score ${score} is stable and handoff never enters history or storage`, async ({ page }) => {
    await page.addInitScript(value => { Math.random = () => value; }, random);
    const requests = [];
    page.on('request', request => requests.push({ url: request.url(), body: request.postData() || '' }));
    await open(page, '/');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await widget(page).getByRole('combobox').fill('Zorabelle');
    await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
    await page.clock.runFor(5000);
    await expect(widget(page).locator('.nn-score')).toHaveCount(0);
    await expect(widget(page).getByRole('heading', { name: 'Checking at the North Pole…' })).toBeVisible();
    await expect(widget(page).locator('.nn-stage').getByRole('status')).toHaveText('The Workshop Naughty & Nice Analyiser');
    await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS - 5000 - 1);
    await expect(widget(page).locator('.nn-score')).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(widget(page).locator('.nn-score')).toHaveText(`${score}% nice!`);
    await widget(page).getByRole('button', { name: 'Sound: on' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(widget(page).locator('.nn-score')).toHaveText(`${score}% nice!`);
    await expect(widget(page).getByText("Mmmm.... surely that can't be right?", { exact: true })).toBeVisible();
    const link = widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true });
    await expect(link).toHaveAttribute('href', path);
    await link.click();
    await expect(office(page).getByRole('combobox')).toHaveValue('Zorabelle');
    expect(new URL(page.url()).pathname).toBe(path);
    expect(new URL(page.url()).search).toBe('');
    const privacy = await page.evaluate(() => JSON.stringify({
      history: history.state, local: { ...localStorage }, session: { ...sessionStorage },
      cookies: document.cookie, analytics: window.dataLayer || [],
    }));
    expect(privacy).not.toContain('Zorabelle');
    expect(requests.some(request => /Zorabelle/i.test(request.url + request.body))).toBe(false);
    expect(requests.filter(request => /\/api\/santa-(?:names|name-preview|message)(?:[/?]|$)/.test(request.url))).toEqual([]);
    expect(requests.filter(request => /stagcommunications/.test(request.url))).toEqual([]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(office(page).getByRole('combobox')).toHaveValue('');
  });
}

for (const sound of ['off', 'blocked']) {
  test(`homepage checking panel waits half a second with sound ${sound}`, async ({ page }) => {
    await open(page, '/');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    if (sound === 'off') await widget(page).getByRole('button', { name: 'Sound: on' }).click();
    await widget(page).getByRole('combobox').fill('Erin');
    await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
    await expect(widget(page).getByRole('combobox')).toBeDisabled();
    await expect(widget(page).getByRole('button', { name: 'Cancel check' })).toHaveCount(0);
    await page.clock.runFor(499);
    await expect(widget(page).locator('.nn-stage')).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(widget(page).getByRole('heading', { name: 'Checking at the North Pole…' })).toBeVisible();
    await page.clock.runFor(1000);
    await expect(widget(page).getByRole('timer')).toHaveText('5 seconds remaining');
    await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS - 1500 + 100);
    await expect(widget(page).locator('.nn-score')).toBeVisible();
    await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
    await widget(page).getByRole('combobox').fill('Erin');
    await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
    await page.clock.runFor(500);
    await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
    await page.clock.runFor(ANALYSIS_MS + 1000);
    await expect(widget(page).locator('.nn-stage, .nn-score')).toHaveCount(0);
    await expect(widget(page).getByRole('combobox')).toHaveValue('');
  });
}

test('homepage result prioritises the glowing Head Elf link and accessible sound icon', async ({ page }, testInfo) => {
  await open(page, '/');
  const sound = widget(page).getByRole('button', { name: 'Sound: on', exact: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect(sound).toHaveAttribute('title', 'Mute sound');
  await expect(sound.locator('img')).toHaveAttribute('src', '/images/checker-MusicOn.webp');
  await expect(sound.locator('img')).toHaveAttribute('alt', '');
  const soundBox = await sound.boundingBox();
  expect(soundBox.width).toBeGreaterThanOrEqual(44);
  expect(soundBox.height).toBeGreaterThanOrEqual(44);
  await sound.click();
  const mute = widget(page).getByRole('button', { name: 'Sound: off', exact: true });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await expect(mute).toHaveAttribute('title', 'Turn sound on');
  await expect(mute.locator('img')).toHaveAttribute('src', '/images/checker-MusicOff.webp');
  await widget(page).getByRole('combobox').fill('Zorabelle');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS + 100);
  const link = widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true });
  const restart = widget(page).getByRole('button', { name: 'Start a new name check' });
  await expect(link).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await link.evaluate(element => getComputedStyle(element).animationName)).not.toBe('none');
  expect(await link.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe('none');
  await expect(widget(page).locator('.nn-check-another')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(link).toHaveCSS('animation-name', 'none');
  expect((await restart.boundingBox()).height).toBeGreaterThanOrEqual(44);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const box = await mute.boundingBox();
    const panel = await widget(page).locator('.nn-panel').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(box.y).toBeGreaterThan(panel.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await widget(page).locator('.nn-panel').screenshot({ path: testInfo.outputPath(`result-controls-${width}.png`), animations: 'disabled' });
  }
  await restart.click();
  await expect(widget(page).getByRole('combobox')).toHaveValue('');
});

test('homepage recording starts with the analyser and its countdown follows media, including a visible zero', async ({ page }) => {
  await open(page, '/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.evaluate(() => {
    const NativeAudio = window.Audio;
    window.checkerPosition = 0;
    window.Audio = function () {
      const audio = new NativeAudio();
      Object.defineProperty(audio, 'duration', { get: () => 11.598367 });
      Object.defineProperty(audio, 'currentTime', { get: () => window.checkerPosition });
      audio.play = () => Promise.resolve();
      return audio;
    };
  });
  await expect(widget(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
  await widget(page).getByRole('combobox').fill('Erin');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(499);
  await expect(widget(page).locator('.nn-stage')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.checkerAudio.length)).toBe(0);
  await page.clock.runFor(1);
  await expect(widget(page).getByRole('heading', { name: 'Checking at the North Pole…' })).toBeVisible();
  await expect(widget(page).getByRole('timer')).toHaveText('12 seconds remaining');
  await page.evaluate(() => { window.checkerPosition = 3.2; });
  await page.clock.runFor(50);
  await expect(widget(page).getByRole('timer')).toHaveText('9 seconds remaining');
  await page.clock.runFor(2000);
  await expect(widget(page).getByRole('timer')).toHaveText('9 seconds remaining');
  await page.evaluate(() => { window.checkerPosition = 5.2; });
  await page.clock.runFor(50);
  await expect(widget(page).getByRole('timer')).toHaveText('7 seconds remaining');
  await page.evaluate(() => { window.checkerPosition = 11.05; });
  await page.clock.runFor(50);
  await expect(widget(page).getByRole('timer')).toHaveText('0 seconds remaining');
  await expect(widget(page).locator('.nn-result')).toHaveCount(0);
  await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
  await page.evaluate(() => { window.checkerPosition = 11; });
  await page.clock.runFor(ANALYSIS_MS + 1000);
  await expect(widget(page).locator('.nn-stage, .nn-score')).toHaveCount(0);
  await expect(widget(page).getByRole('timer')).toHaveCount(0);
});

for (const pending of ['load', 'decode']) {
  test(`machine overlays wait for artwork ${pending} without restarting the countdown`, async ({ page }) => {
    let release;
    if (pending === 'load') {
      const held = new Promise(resolve => { release = resolve; });
      await page.route('**/images/north-pole-analyser-machine.webp', async route => {
        await held;
        await route.continue();
      });
    } else {
      await page.addInitScript(() => {
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function () {
          const decoded = decode.call(this);
          if (!this.src.endsWith('/north-pole-analyser-machine.webp')) return decoded;
          return decoded.then(() => new Promise(resolve => { window.releaseMachineDecode = resolve; }));
        };
      });
    }
    await open(page, '/');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await widget(page).getByRole('button', { name: 'Sound: on' }).click();
    await widget(page).getByRole('combobox').fill('Zorabelle');
    await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
    await page.clock.runFor(1100);
    const machine = widget(page).locator('.nn-machine');
    await expect(machine).toBeVisible();
    if (pending === 'decode')
      await expect.poll(() => page.evaluate(() => typeof window.releaseMachineDecode)).toBe('function');
    await expect(machine.locator('.nn-machine-screen, .nn-machine-slot')).toHaveCount(0);
    await expect(machine.getByRole('timer')).toHaveCount(0);
    await page.clock.runFor(1000);
    if (pending === 'load') {
      release();
      await machine.locator('img').evaluate(image => image.decode());
    } else await page.evaluate(() => window.releaseMachineDecode());
    await expect(machine.getByRole('timer')).toHaveText('5 seconds remaining');
    await expect(machine.locator('.nn-machine-slot')).toBeVisible();
    await page.clock.runFor(HOMEPAGE_ANALYSIS_MS + CHECKER_LAUNCH_MS - 2100 + 100);
    await expect(widget(page).locator('.nn-score')).toBeVisible();
  });
}

test('failed machine artwork never shows floating overlays or blocks the result', async ({ page }) => {
  await page.route('**/images/north-pole-analyser-machine.webp', route => route.abort());
  await open(page, '/');
  await widget(page).getByRole('button', { name: 'Sound: on' }).click();
  await widget(page).getByRole('combobox').fill('Zorabelle');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(1100);
  await expect(widget(page).locator('.nn-machine')).toBeVisible();
  await expect(widget(page).locator('.nn-machine-screen, .nn-machine-slot')).toHaveCount(0);
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS);
  await expect(widget(page).locator('.nn-score')).toBeVisible();
});

test('supplied analyser contains a silent digital countdown and sliding slot on desktop and phones', async ({ page }, testInfo) => {
  await open(page, '/');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await widget(page).getByRole('button', { name: 'Sound: on' }).click();
  await widget(page).getByRole('combobox').fill('Zorabelle');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await page.clock.runFor(1100);
  const machine = widget(page).locator('.nn-machine');
  const timer = machine.getByRole('timer');
  await expect(timer).toHaveText('6 seconds remaining');
  await expect(timer).toHaveAttribute('aria-live', 'off');
  await expect(machine.locator('.nn-seg-digit')).toHaveCount(2);
  expect(await machine.locator('.nn-machine-art').evaluate(async image => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([1609, 977]);
  await expect(machine.locator('img')).toHaveAttribute('alt', '');
  await expect(widget(page).locator('.nn-computer, .nn-stage > .nn-progress')).toHaveCount(0);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const art = await machine.boundingBox();
    const slot = await machine.locator('.nn-machine-slot').boundingBox();
    const screen = await machine.locator('.nn-machine-screen').boundingBox();
    expect(art.width / art.height).toBeCloseTo(1609 / 977, 2);
    expect(art.x).toBeGreaterThanOrEqual(0);
    expect(art.x + art.width).toBeLessThanOrEqual(width);
    expect((slot.x - art.x) / art.width).toBeCloseTo(.282, 2);
    expect((slot.y - art.y) / art.height).toBeCloseTo(.726, 2);
    expect((screen.x - art.x) / art.width).toBeCloseTo(.409, 2);
    expect((screen.y - art.y) / art.height).toBeCloseTo(.416, 2);
    await widget(page).locator('.nn-panel').screenshot({ path: testInfo.outputPath(`analyser-${width}.png`), animations: 'disabled' });
  }
  await page.clock.runFor(1000);
  await expect(timer).toHaveText('5 seconds remaining');
  await page.clock.runFor(1000);
  await expect(timer).toHaveText('4 seconds remaining');
  await widget(page).getByRole('button', { name: 'Start a new name check' }).click();
  await expect(widget(page).getByRole('timer')).toHaveCount(0);
  await page.clock.runFor(HOMEPAGE_ANALYSIS_MS);
  await expect(widget(page).locator('.nn-score')).toHaveCount(0);
});

test('homepage uses the new MP3, defaults sound on and preserves both timed reveals', async ({ page }) => {
  test.setTimeout(25000);
  await open(page, '/', false);
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = window.checkerNativePlay;
    const NativeAudio = window.Audio;
    window.homeCheckerPlayed = [];
    window.Audio = function (src) {
      const audio = new NativeAudio(src);
      if (!src.includes('/checking')) return audio;
      window.homeCheckerAudio = audio;
      audio.addEventListener('playing', () => window.homeCheckerPlayed.push(src));
      return audio;
    };
    const observer = new MutationObserver(() => {
      const audio = window.homeCheckerAudio;
      if (!audio) return;
      if (window.homePanelTime === undefined && document.querySelector('.nn-widget .nn-stage')) window.homePanelTime = audio.currentTime;
      if (!window.homeResultTime && document.querySelector('.nn-widget .nn-score'))
        window.homeResultTime = { time: audio.currentTime, duration: audio.duration, paused: audio.paused };
    });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  });
  await expect(widget(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
  expect(await page.evaluate(() => window.homeCheckerPlayed)).toEqual([]);
  await widget(page).getByRole('combobox').fill('Erin');
  await widget(page).getByRole('button', { name: 'Check', exact: true }).click();
  await expect(widget(page).locator('.nn-score')).toBeVisible({ timeout: 14000 });
  const state = await page.evaluate(() => ({ panel: window.homePanelTime, result: window.homeResultTime,
    played: window.homeCheckerPlayed }));
  expect(state.played).toEqual(['/audio/naughty-or-nice/checking-home-page.mp3?v=1793960331516']);
  expect(state.result.duration).toBeCloseTo(6.060, 1);
  expect(state.panel).toBeGreaterThanOrEqual(0);
  expect(state.panel).toBeLessThan(.2);
  expect(state.result.paused).toBe(false);
  expect(state.result.duration - state.result.time).toBeGreaterThan(.15);
  expect(state.result.duration - state.result.time).toBeLessThan(.35);
  await widget(page).getByRole('link', { name: 'Lets check with Head Elf', exact: true }).click();
  expect(await page.evaluate(() => window.homeCheckerAudio.paused)).toBe(true);
  await expect(office(page).getByRole('combobox')).toHaveValue('Erin');
});

test('connecting uses the wide machine and CONNECTING text only until the questions open', async ({ page }, testInfo) => {
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await office(page).getByRole('combobox').fill('Zorabelle');
  await office(page).getByRole('button', { name: 'Lets check if Zorabelle is Naughty or Nice', exact: true }).click();
  const machine = office(page).locator('.nn-machine--connecting');
  await expect(machine.locator('.nn-machine-connection')).toHaveText('CONNECTING');
  await expect(office(page).getByRole('timer')).toHaveCount(0);
  await expect(machine.locator('img')).toHaveAttribute('src', '/images/north-pole-analyser-connecting.webp');
  expect(await machine.locator('img').evaluate(async image => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([1610, 977]);
  const assertLettersFit = async () => {
    const bounds = await machine.locator('.nn-machine-connection').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const screen = element.parentElement.getBoundingClientRect();
      return { left: text.left - screen.left, right: screen.right - text.right,
        top: text.top - screen.top, bottom: screen.bottom - text.bottom,
        overflow: element.scrollWidth - element.clientWidth };
    });
    for (const key of ['left', 'right', 'top', 'bottom'])
      expect(bounds[key], `complete CONNECTING text ${key}`).toBeGreaterThanOrEqual(-1);
    expect(bounds.overflow).toBeLessThanOrEqual(1);
  };
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const screen = await machine.locator('.nn-machine-screen').boundingBox();
    const text = await machine.locator('.nn-machine-connection').boundingBox();
    expect(text.x).toBeGreaterThanOrEqual(screen.x);
    expect(text.x + text.width).toBeLessThanOrEqual(screen.x + screen.width);
    expect(text.y).toBeGreaterThanOrEqual(screen.y);
    expect(text.y + text.height).toBeLessThanOrEqual(screen.y + screen.height);
    await assertLettersFit();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await office(page).locator('.nn-panel').screenshot({ path: testInfo.outputPath(`connecting-machine-${width}.png`), animations: 'disabled' });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const fitted = await machine.locator('.nn-machine-connection').evaluate(element =>
    element.scrollWidth <= element.parentElement.clientWidth);
  expect(fitted).toBe(true);
  await assertLettersFit();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.clock.runFor(1800);
  await expect(office(page).locator('.nn-question-count')).toHaveText('1 of 10');
  await expect(machine).toHaveCount(0);
  await answer(page, 0);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await expect(office(page).locator('.nn-machine-art')).toHaveAttribute('src', '/images/head-elf-list-engine.webp');
  await expect(office(page).getByRole('timer')).toBeVisible();
  await expect(office(page).locator('.nn-machine-connection')).toHaveCount(0);
});

test('final analysis uses Head Elf engine with decoded artwork, red countdown and a distinct scanner', async ({ page }, testInfo) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/images/head-elf-list-engine.webp', async route => {
    await held;
    await route.continue();
  });
  await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  await enter(page);
  await answer(page, 0);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  const machine = office(page).locator('.nn-machine--final');
  await expect(machine).toBeVisible();
  await expect(machine.locator('.nn-machine-screen, .nn-machine-slot')).toHaveCount(0);
  await page.clock.runFor(1000);
  release();
  expect(await machine.locator('img').evaluate(async image => {
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })).toEqual([1632, 964]);
  await expect(machine.getByRole('timer')).toHaveText('7 seconds remaining');
  await expect(machine.locator('.nn-seg-digit')).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const scanner = machine.locator('.nn-machine-progress');
  const animation = await scanner.evaluate(element => getComputedStyle(element, '::after').animationName);
  expect(animation).not.toBe('none');
  expect(animation).not.toBe('nn-progress-move');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await scanner.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    const art = await machine.boundingBox();
    const screen = await machine.locator('.nn-machine-screen').boundingBox();
    const slot = await machine.locator('.nn-machine-slot').boundingBox();
    expect(art.width / art.height).toBeCloseTo(1632 / 964, 2);
    expect((screen.x - art.x) / art.width).toBeGreaterThan(.41);
    expect((screen.x + screen.width - art.x) / art.width).toBeLessThan(.60);
    expect((slot.x - art.x) / art.width).toBeGreaterThan(.28);
    expect((slot.x + slot.width - art.x) / art.width).toBeLessThan(.72);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await office(page).locator('.nn-panel').screenshot({ path: testInfo.outputPath(`head-elf-engine-${width}.png`), animations: 'disabled' });
  }
  await page.clock.runFor(1000);
  await expect(machine.getByRole('timer')).toHaveText('6 seconds remaining');
  await page.clock.runFor(ANALYSIS_MS - 2000 + 100);
  await expect(office(page).locator('.nn-result h2')).toHaveText('Zorabelle: NICE LIST!');
});

test('Head Elf sound artwork stays bottom right through every stage and entry starts above the old toolbar', async ({ page }, testInfo) => {
  await open(page);
  const panel = office(page).locator('.nn-panel');
  const sound = office(page).getByRole('button', { name: /^Sound: / });
  const assertCorner = async content => {
    const box = await panel.boundingBox();
    const button = await sound.boundingBox();
    const body = await content.boundingBox();
    const borders = await panel.evaluate(element => {
      const style = getComputedStyle(element);
      return { right: parseFloat(style.borderRightWidth), bottom: parseFloat(style.borderBottomWidth) };
    });
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y).toBeGreaterThanOrEqual(body.y + body.height);
    expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width - borders.right + 1);
    expect(button.x + button.width).toBeGreaterThan(box.x + box.width / 2);
    expect(button.y + button.height).toBeLessThanOrEqual(box.y + box.height - borders.bottom + 1);
    await expect(sound.locator('img')).toHaveAttribute('src', '/images/checker-MusicOn.webp');
    await expect(panel.locator('.nn-sound, .nn-toolbar > button')).toHaveCount(0);
  };
  for (const [width, fontSize] of [[1280, ''], [390, ''], [320, ''], [320, '200%']]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(size => { document.documentElement.style.fontSize = size; }, fontSize);
    await assertCorner(panel.locator('.nn-stage'));
    const entryOffset = await panel.evaluate(element => {
      const style = getComputedStyle(element);
      return element.querySelector('.nn-stage').getBoundingClientRect().top -
        element.getBoundingClientRect().top - parseFloat(style.borderTopWidth) - parseFloat(style.paddingTop);
    });
    expect(entryOffset).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath(`office-corner-${width}-${fontSize || 'normal'}.png`), animations: 'disabled' });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await panel.getByRole('combobox').fill('Erin');
  await panel.getByRole('button', { name: 'Lets check if Erin is Naughty or Nice', exact: true }).click();
  await assertCorner(panel.locator('.nn-stage'));
  await page.clock.runFor(1900);
  await assertCorner(panel.locator('.nn-stage'));
  await answer(page);
  await assertCorner(panel.locator('.nn-stage'));
  await panel.getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await assertCorner(panel.locator('.nn-stage'));
  await page.clock.runFor(ANALYSIS_MS + 100);
  await assertCorner(panel.locator('.nn-result'));
  await sound.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(sound).toBeFocused();
  await expect(sound).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(sound.locator('img')).toHaveAttribute('src', '/images/checker-MusicOff.webp');
});

test('Head Elf panel preserves the whole supplied frame and live name controls on desktop and phones', async ({ page }, testInfo) => {
  await open(page);
  const panel = office(page).locator('.nn-panel');
  const art = await panel.evaluate(async element => {
    const source = getComputedStyle(element).borderImageSource;
    const image = new Image();
    image.src = source.match(/url\(["']?([^"')]+)["']?\)/)[1];
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(art).toEqual([1374, 1145]);
  await expect(panel.locator('.nn-help')).toHaveText('Enter a first name.');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const box = await panel.boundingBox();
    const input = await panel.getByRole('combobox').boundingBox();
    const borderTop = await panel.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth));
    expect(box.width).toBeLessThanOrEqual(680);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(borderTop / box.width).toBeCloseTo(430 / 1374, 2);
    expect(input.y).toBeGreaterThan(box.y + borderTop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: testInfo.outputPath(`head-elf-panel-${width}.png`), animations: 'disabled' });
  }
  await panel.getByRole('combobox').fill('Er');
  await expect(panel.getByRole('option', { name: 'Erin', exact: true })).toBeVisible();
  await expect(panel.getByRole('option').first()).toHaveText('Erica');
  await panel.getByRole('combobox').press('ArrowDown');
  await panel.getByRole('combobox').press('Enter');
  await expect(panel.getByRole('combobox')).toHaveValue('Erica');
});

test('office uses the supplied festive background behind accessible controls without duplicate drawn scenery', async ({ page }) => {
  await open(page);
  const backdrop = office(page).locator('.nn-scenery');
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  const image = await backdrop.evaluate(async element => {
    const style = getComputedStyle(element);
    const url = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    const img = new Image();
    img.src = url;
    await img.decode();
    return { url, width: img.naturalWidth, height: img.naturalHeight, size: style.backgroundSize };
  });
  expect(image.url).toContain('/images/workshop-background-festive.webp');
  expect(image.width).toBe(2080);
  expect(image.height).toBe(1800);
  expect(image.size.split(',')[0].trim()).toBe('cover');
  await expect(office(page).locator('.nn-wall, .nn-window, .nn-shelf, .nn-garland, .nn-desk')).toHaveCount(0);
  await expect(office(page).getByRole('combobox')).toBeVisible();
});

test('office heading clears navigation and the shorter faster cane respects reduced motion', async ({ page }) => {
  await open(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    const nav = await page.locator('.navbar').boundingBox();
    const title = await office(page).locator('.nn-heading-wrap').boundingBox();
    expect(title.y).toBeGreaterThan(nav.y + nav.height);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await office(page).getByRole('combobox').fill('Erin');
  await office(page).getByRole('button', { name: 'Lets check if Erin is Naughty or Nice' }).click();
  const bar = office(page).locator('.nn-progress');
  const machine = await office(page).locator('.nn-machine').boundingBox();
  expect((await bar.boundingBox()).width / machine.width).toBeCloseTo(.38, 2);
  expect(await bar.evaluate(element => getComputedStyle(element, '::after').animationDuration)).toBe('0.75s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await bar.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none');
  await page.clock.runFor(1900);
  await expect(office(page).locator('.nn-question-progress > span')).toHaveCount(10);
});

test('unknown names, abusive names, load failure and retry are independent of list classification', async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route('**/names-data/*.json', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, body: 'unavailable' }) : route.fulfill({ json: ['Erin'] });
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const input = office(page).getByRole('combobox');
  await input.fill('Er');
  await expect(office(page)).toContainText('Suggestions are unavailable');
  await office(page).getByRole('button', { name: 'Retry suggestions' }).click();
  await expect(office(page).getByRole('option', { name: 'Erin' })).toBeVisible();
  await input.fill('fuck');
  await office(page).getByRole('button', { name: /^Lets check if .* is Naughty or Nice$/ }).click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(office(page).locator('fieldset')).toHaveCount(0);
  await input.fill('Zorabelle');
  await expect(office(page)).toContainText('It never means Naughty.');
});

test('failed audio cannot block results; only the matching new recording plays and replay is removed', async ({ page }) => {
  await open(page);
  await expect(office(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
  await enter(page);
  expect(await page.evaluate(() => window.checkerAudio)).toEqual([]);
  await answer(page, 6);
  await analyse(page);
  await expect(office(page).locator('.nn-result--naughty')).toBeVisible();
  await expect(office(page)).toContainText('Sound could not play.');
  await expect(office(page).getByRole('button', { name: 'Replay sound' })).toHaveCount(0);
  let files = await page.evaluate(() => window.checkerAudio.map(url => url.split('/').at(-1)));
  expect(files).toEqual(['checking-naughty_1793904309041.mp3']);
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await enter(page);
  await answer(page, 0);
  await analyse(page);
  files = await page.evaluate(() => window.checkerAudio.map(url => url.split('/').at(-1)));
  expect(files).toEqual(['checking-naughty_1793904309041.mp3', 'checking-nice_1793904309041.mp3']);
});

test('supplied MP3s decode and play in the browser; leaving stops active audio without changing radio playback', async ({ page }) => {
  test.setTimeout(60000);
  await open(page, path, false);
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = window.checkerNativePlay;
    window.checkerPlayed = [];
    window.checkerEvents = [];
    window.checkerPaused = [];
    const NativeAudio = window.Audio;
    window.Audio = function (src) {
      const audio = new NativeAudio(src);
      if (src?.includes('/naughty-or-nice/checking')) {
        window.checkerActiveAudio = audio;
        audio.addEventListener('playing', () => {
          window.checkerPlayed.push(src.split('/').at(-1));
          window.checkerEvents.push(`playing:${src.split('/').at(-1)}`);
        });
        audio.addEventListener('ended', () => window.checkerEvents.push(`ended:${src.split('/').at(-1)}`));
        audio.addEventListener('pause', () => window.checkerPaused.push(audio.paused));
      }
      return audio;
    };
    const observer = new MutationObserver(() => {
      if (!window.checkerReveal && document.querySelector('.nn-result--nice')) {
        const audio = window.checkerActiveAudio;
        window.checkerReveal = { time: audio.currentTime, duration: audio.duration, paused: audio.paused, src: audio.src };
      }
      if (!window.checkerNaughtyReveal && document.querySelector('.nn-result--naughty')) {
        const audio = window.checkerActiveAudio;
        window.checkerNaughtyReveal = { time: audio.currentTime, duration: audio.duration, paused: audio.paused, src: audio.src };
      }
    });
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  });
  expect(await page.evaluate(() => window.checkerPlayed)).toEqual([]);
  const radio = page.locator('.radio-dock').getByRole('button', { name: 'Listen Live', exact: true });
  await expect(radio).toBeVisible();
  await expect(office(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
  await office(page).getByRole('combobox').fill('Zorabelle');
  await office(page).getByRole('button', { name: 'Lets check if Zorabelle is Naughty or Nice', exact: true }).click();
  await expect(office(page).locator('fieldset')).toHaveCount(1);
  await answer(page);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await expect.poll(() => page.evaluate(() => window.checkerPlayed)).toContain('checking-nice_1793904309041.mp3');
  await expect(office(page).locator('.nn-result--nice')).toBeVisible({ timeout: 16000 });
  const reveal = await page.evaluate(() => window.checkerReveal);
  expect(reveal.src).toContain('checking-nice_1793904309041.mp3');
  expect(reveal.paused).toBe(false);
  expect(reveal.duration - reveal.time).toBeGreaterThan(1.05);
  expect(reveal.duration - reveal.time).toBeLessThan(1.45);
  await expect.poll(() => page.evaluate(() => window.checkerEvents)).toContain('ended:checking-nice_1793904309041.mp3');
  const events = await page.evaluate(() => window.checkerEvents);
  expect(events).toEqual(['playing:checking-nice_1793904309041.mp3', 'ended:checking-nice_1793904309041.mp3']);
  await expect(radio).toBeVisible();
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await enter(page, 'Zorabelle', false);
  await answer(page, 10);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await expect(office(page).locator('.nn-result--naughty')).toBeVisible({ timeout: 16000 });
  const naughtyReveal = await page.evaluate(() => window.checkerNaughtyReveal);
  expect(naughtyReveal.src).toContain('checking-naughty_1793904309041.mp3');
  expect(naughtyReveal.paused).toBe(false);
  expect(naughtyReveal.duration - naughtyReveal.time).toBeGreaterThan(1.05);
  expect(naughtyReveal.duration - naughtyReveal.time).toBeLessThan(1.45);
  expect(await page.evaluate(() => window.checkerPlayed)).toEqual([
    'checking-nice_1793904309041.mp3', 'checking-naughty_1793904309041.mp3',
  ]);
  await expect(office(page).locator('.nn-certificate-stamp')).toBeVisible();
  await page.locator('.navbar').getByRole('link', { name: 'Home', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.checkerActiveAudio.paused)).toBe(true);
  expect(await page.evaluate(() => window.checkerActiveAudio.getAttribute('src'))).toBe(null);
});

test('completed answers and result never enter requests, analytics or browser storage', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url() + (request.postData() || '')));
  await open(page);
  await enter(page, 'Zorabelle');
  await answer(page, 6);
  await analyse(page);
  const values = await page.evaluate(() => JSON.stringify({
    history: history.state, local: { ...localStorage }, session: { ...sessionStorage },
    cookies: document.cookie, analytics: window.dataLayer || [],
  }));
  expect(values).not.toMatch(/Zorabelle|nn-question|naughty.*answers/i);
  expect(requests.join('\n')).not.toMatch(/Zorabelle|nn-question/);
  expect(requests.some(value => /\/api\/santa-(?:names|name-preview|message)(?:[/?]|$)/.test(value))).toBe(false);
});

test('cancellation, restart and navigation suppress stale results and turning sound off cancels delayed sound', async ({ page }) => {
  await open(page);
  await enter(page);
  await answer(page, 0);
  await expect(office(page).getByRole('button', { name: 'Sound: on' })).toBeVisible();
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await page.clock.runFor(500);
  await office(page).getByRole('button', { name: 'Back to answers' }).click();
  await page.clock.runFor(ANALYSIS_MS + 1000);
  await expect(office(page).getByRole('heading', { name: 'All ten answers are in!' })).toBeVisible();
  await expect(office(page).locator('.nn-result')).toHaveCount(0);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await office(page).getByRole('button', { name: 'Sound: on' }).click();
  await page.clock.runFor(ANALYSIS_MS + 100);
  await expect(office(page).locator('.nn-result--nice')).toBeVisible();
  expect(await page.evaluate(() => window.checkerAudio)).toHaveLength(2);
  await office(page).getByRole('button', { name: 'Start a new name check' }).click();
  await expect(office(page).getByRole('combobox')).toHaveValue('');
  await expect(office(page).getByRole('combobox')).toBeFocused();
  await enter(page, 'Erin');
  await answer(page);
  await office(page).getByRole('button', { name: 'Let’s just have another little check!' }).click();
  await page.locator('.navbar').getByRole('link', { name: 'Home', exact: true }).click();
  await page.clock.runFor(ANALYSIS_MS + 1000);
  await expect(office(page)).toHaveCount(0);
  await page.goto(path);
  await expect(office(page).getByRole('combobox')).toHaveValue('');
});

test('narrow and enlarged text layouts retain controls; reduced motion is static', async ({ page }, testInfo) => {
  await open(page);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(office(page).getByRole('combobox')).toBeVisible();
    const motion = await office(page).locator('.nn-scenery').evaluate(node => getComputedStyle(node).animationName);
    expect(motion).toBe('none');
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await answer(page, 6);
  await analyse(page);
  const restart = office(page).getByRole('button', { name: 'Start a new name check' });
  await restart.scrollIntoViewIfNeeded();
  const button = await restart.boundingBox();
  const dock = await page.locator('.radio-dock').boundingBox();
  expect(button.x).toBeGreaterThanOrEqual(0);
  expect(button.x + button.width).toBeLessThanOrEqual(391);
  expect(button.y + button.height).toBeLessThanOrEqual(dock.y);
  await page.screenshot({ path: testInfo.outputPath('checker-phone-result.png') });
});
