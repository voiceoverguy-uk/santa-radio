import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { QUESTIONS, ANALYSIS_MS, HOMEPAGE_ANALYSIS_MS, resultAnalysisMs, REVEAL_LEAD_MS, CERTIFICATE_REVEAL_LEAD_MS, CHECKER_PATH, preliminaryScore, classifyAnswers, nameError,
  offerCheckerName, readCheckerName, clearCheckerName } from '../src/naughty-or-nice/checkerLogic.js';
import { resolvePublicRequest, canonicalPaths } from '../src/seo/routes.js';
import { sitemap } from '../server/public-html.js';
import publicPage from '../api/public-page.js';
import { CHECKER_SOUNDS } from '../src/naughty-or-nice/useCheckerAudio.js';
import { daysUntilChristmas } from '../src/naughty-or-nice/christmasDays.js';

test('Christmas days use UK calendar dates, including midnight, DST and the next year', () => {
  for (const [date, days] of [
    ['2026-11-05T12:00:00Z', 50],
    ['2026-12-24T23:59:59Z', 1],
    ['2026-12-25T00:00:00Z', 0],
    ['2026-12-25T23:59:59Z', 0],
    ['2026-12-26T00:00:00Z', 364],
    ['2026-06-30T23:30:00Z', 177],
    ['2026-10-24T22:59:59Z', 62],
    ['2026-10-24T23:00:00Z', 61],
    ['2026-10-25T00:30:00Z', 61],
    ['2026-10-25T01:30:00Z', 61],
  ]) assert.equal(daysUntilChristmas(new Date(date)), days, date);
});

test('integer preliminary scores include both endpoints and are bounded', () => {
  assert.equal(preliminaryScore(() => 0), 51);
  assert.equal(preliminaryScore(() => 0.999999), 73);
  for (let i = 0; i < 100; i++) {
    const value = preliminaryScore(() => i / 100);
    assert.ok(Number.isInteger(value) && value >= 51 && value <= 73);
  }
});

test('all ten positive questions must be answered; exactly six No changes the result', () => {
  assert.equal(QUESTIONS.length, 10);
  assert.ok(QUESTIONS.every(question => /^(Have|Do|Are) /.test(question)));
  for (const [no, expected] of [[0, 'nice'], [5, 'nice'], [6, 'naughty'], [10, 'naughty']]) {
    const answers = QUESTIONS.map((_, index) => index < no ? 'no' : 'yes');
    assert.equal(classifyAnswers(answers), expected);
  }
  assert.equal(classifyAnswers([]), null);
  assert.equal(classifyAnswers(Array(10).fill('')), null);
  assert.equal(classifyAnswers([...Array(9).fill('yes'), '']), null);
  assert.equal(classifyAnswers(Array(10).fill('maybe')), null);
});

test('reasonable unknown names work; markup and abusive whole words do not; memory handoff tolerates repeated initialisation and clears', () => {
  for (const name of ['Zoë', 'Fanny', 'Dick', 'Élodie', 'O’Neil', 'X', 'Zorabelle', 'Anne-Marie']) assert.equal(nameError(name), '');
  for (const name of ['', ' ', '<img src=x>', '123', 'fuck', 's-h-i-t', 'x'.repeat(81)]) assert.ok(nameError(name));
  offerCheckerName('  Zorabelle  ');
  assert.equal(readCheckerName(), 'Zorabelle');
  assert.equal(readCheckerName(), 'Zorabelle');
  clearCheckerName(); assert.equal(readCheckerName(), '');
  offerCheckerName('Erin'); clearCheckerName(); assert.equal(readCheckerName(), '');
});

test('public MP3s are byte-for-byte the supplied effects and analysis duration is preserved', async () => {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const file of ['checking_1793902553290.mp3', 'checking-nice_1793904309041.mp3', 'checking-naughty_1793904309041.mp3']) {
    assert.equal(hash(await readFile(`public/audio/naughty-or-nice/${file}`)), hash(await readFile(`attached_assets/${file}`)));
  }
  assert.equal(ANALYSIS_MS, 7212);
  assert.equal(resultAnalysisMs('nice'), 7212);
  assert.equal(resultAnalysisMs('naughty'), 6768);
  assert.equal(CERTIFICATE_REVEAL_LEAD_MS, 1200);
  assert.equal(REVEAL_LEAD_MS, 300);
  assert.equal(HOMEPAGE_ANALYSIS_MS, 4219);
  assert.equal(CHECKER_SOUNDS.nice, '/audio/naughty-or-nice/checking-nice_1793904309041.mp3');
  assert.equal(CHECKER_SOUNDS.naughty, '/audio/naughty-or-nice/checking-naughty_1793904309041.mp3');
  assert.ok(Object.values(CHECKER_SOUNDS).every(path => !path.includes('naughty-list_') && !path.includes('/LU_')));
});

test('homepage replacement MP3 is unchanged and its silent countdown matches the shorter clip', async () => {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(await readFile('public/audio/naughty-or-nice/checking-home-page.mp3')),
    hash(await readFile('attached_assets/checking-home-page_1793959751684.mp3')));
  assert.equal(CHECKER_SOUNDS.homepageChecking, '/audio/naughty-or-nice/checking-home-page.mp3');
  assert.equal(HOMEPAGE_ANALYSIS_MS, 4219);
});

test('new route is canonical, sitemap-listed and served as a built document with metadata', async () => {
  assert.deepEqual(resolvePublicRequest(CHECKER_PATH), { status: 200 });
  assert.ok(canonicalPaths.includes(CHECKER_PATH));
  assert.ok(sitemap().includes(`https://www.santaradio.co.uk${CHECKER_PATH}</loc>`));
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.code = value; return this; }, end(body) { this.body = body; } };
  await publicPage({ method: 'GET', url: `/api/public-page?__sr_route=${CHECKER_PATH}` }, response);
  assert.equal(response.code, 200);
  assert.equal(response.headers['X-Santa-Page-Mode'], 'prerendered');
  assert.match(response.body, /<title[^>]*>Santa’s Naughty or Nice List Checker \| Santa Radio<\/title>/);
  assert.match(response.body, /name="description" content="Visit the Head Elf/);
  assert.ok(response.body.includes(`rel="canonical" href="https://www.santaradio.co.uk${CHECKER_PATH}"`));
  assert.match(response.body, /<h1[^>]*>Naughty or Nice List Checker<\/h1>/);
  assert.doesNotMatch(response.body, /A little festive fun with the Head Elf\. Everyone can practise kindness\./);
  await publicPage({ method: 'GET', url: '/api/public-page?__sr_route=/' }, response);
  assert.equal(response.code, 200);
  assert.match(response.body, /<h3[^>]*>Head Elf’s Naughty or Nice List Checker<\/h3>/);
  assert.ok(response.body.includes('Enter your first name for a quick North Pole check. Then visit Head Elf for the full Christmas quiz.'));
  assert.match(response.body, /<h2[^>]*>Which List are you\?<\/h2>/);
  assert.ok(response.body.includes('Head Elf has ten festive questions about kindness, helping out and trying your best. Answer them to find out which of Santa’s lists you’re on this Christmas.'));
  assert.doesNotMatch(response.body, /Play the Naughty or Nice List Checker/);
  const introIndex = response.body.indexOf('id="nn-quiz-intro-heading"');
  assert.ok(introIndex > response.body.indexOf('class="nn-widget"') && response.body.indexOf('id="nn-widget-heading"') > introIndex);
  const vercel = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.ok(vercel.routes.some(route => route.dest?.startsWith('/api/public-page') && new RegExp(`^${route.src}$`).test(CHECKER_PATH)));
});
