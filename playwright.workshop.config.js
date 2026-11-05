import { defineConfig, firefox, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import base from './playwright.config.js';

const port = Number(process.env.WORKSHOP_TEST_PORT || 5001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated workshop test port.');
const origin = `http://127.0.0.1:${port}`;
// Ephemeral test-only codes, never the owner's configured codes.
process.env.WORKSHOP_TEST_PASSWORD ||= randomBytes(32).toString('hex');
process.env.WORKSHOP_TEST_SESSION_SECRET ||= randomBytes(48).toString('hex');
// Browser-side free-access fixtures must sign with the isolated server's key too.
process.env.SESSION_SECRET = process.env.WORKSHOP_TEST_SESSION_SECRET;
process.env.WORKSHOP_TEST_EXPIRES_AT ||= new Date(Date.now() + 14 * 86400000).toISOString();
for (let slot = 2; slot <= 6; slot++) {
  process.env[`WORKSHOP_TEST_CODE_${slot}`] ||= randomBytes(32).toString('hex');
}
const webkitInstalled = existsSync(webkit.executablePath());
if (!webkitInstalled) {
  console.warn('Skipping the Studio WebKit project because its Playwright browser is not installed.');
}
const firefoxInstalled = existsSync(firefox.executablePath());
if (!firefoxInstalled) {
  console.warn('Skipping the Studio Firefox project because its Playwright browser is not installed.');
}
export default defineConfig({
  ...base,
  testMatch: /santa-workshop(?:-two-messages|-allowance|-access|-search|-browser-names|-name-preview(?:-step-one)?|-sounds|-motion|-live-catalogue|-message|-talent|-gifts|-guide)?\.spec\.js/,
  use: { ...base.use, baseURL: origin, ignoreHTTPSErrors: false, trace: 'off', video: 'off', screenshot: 'off' },
  projects: [
    ...base.projects.filter(project => project.name === 'chromium'),
    ...(webkitInstalled ? [{
      name: 'webkit',
      grep: /finished Studio message download is valid and matches the playable recording/,
      use: { browserName: 'webkit' },
    }] : []),
    ...(firefoxInstalled ? [{
      name: 'firefox',
      grep: /finished Studio message download is valid and matches the playable recording/,
      use: { browserName: 'firefox' },
    }] : []),
  ],
  webServer: {
    command: process.env.WORKSHOP_SERVING_MODE === 'node'
      ? `node index.js --port=${port}`
      : `node node_modules/vite/bin/vite.js ${process.env.WORKSHOP_SERVING_MODE === 'preview' ? 'preview' : ''} --host 127.0.0.1 --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      SANTA_STUDIO_TEST_CODE_1: process.env.WORKSHOP_TEST_PASSWORD,
      SANTA_STUDIO_TEST_CODE_2: process.env.WORKSHOP_TEST_CODE_2,
      SANTA_STUDIO_TEST_CODE_3: process.env.WORKSHOP_TEST_CODE_3,
      SANTA_STUDIO_TEST_CODE_4: process.env.WORKSHOP_TEST_CODE_4,
      SANTA_STUDIO_TEST_CODE_5: process.env.WORKSHOP_TEST_CODE_5,
      SANTA_STUDIO_TEST_CODE_6: process.env.WORKSHOP_TEST_CODE_6,
      SESSION_SECRET: process.env.WORKSHOP_TEST_SESSION_SECRET,
      SANTA_STUDIO_TEST_EXPIRES_AT: process.env.WORKSHOP_TEST_EXPIRES_AT,
    },
  },
});
