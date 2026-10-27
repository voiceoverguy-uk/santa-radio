import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import base from './playwright.config.js';

// Ephemeral test-only codes, never the owner's configured codes.
process.env.WORKSHOP_TEST_PASSWORD ||= randomBytes(32).toString('hex');
process.env.WORKSHOP_TEST_SESSION_SECRET ||= randomBytes(48).toString('hex');
process.env.WORKSHOP_TEST_EXPIRES_AT ||= new Date(Date.now() + 14 * 86400000).toISOString();
for (let slot = 2; slot <= 5; slot++) {
  process.env[`WORKSHOP_TEST_CODE_${slot}`] ||= randomBytes(32).toString('hex');
}
export default defineConfig({
  ...base,
  testMatch: /santa-workshop(?:-access|-search|-name-preview|-sounds|-motion|-live-catalogue)?\.spec\.js/,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5001', ignoreHTTPSErrors: false, trace: 'off', video: 'off', screenshot: 'off' },
  projects: base.projects.filter(project => project.name === 'chromium'),
  webServer: {
    command: process.env.WORKSHOP_SERVING_MODE === 'node'
      ? 'node index.js --port=5001'
      : `node node_modules/vite/bin/vite.js ${process.env.WORKSHOP_SERVING_MODE === 'preview' ? 'preview' : ''} --host 127.0.0.1 --port 5001 --strictPort`,
    url: 'http://127.0.0.1:5001',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      SANTA_STUDIO_TEST_CODE_1: process.env.WORKSHOP_TEST_PASSWORD,
      SANTA_STUDIO_TEST_CODE_2: process.env.WORKSHOP_TEST_CODE_2,
      SANTA_STUDIO_TEST_CODE_3: process.env.WORKSHOP_TEST_CODE_3,
      SANTA_STUDIO_TEST_CODE_4: process.env.WORKSHOP_TEST_CODE_4,
      SANTA_STUDIO_TEST_CODE_5: process.env.WORKSHOP_TEST_CODE_5,
      SESSION_SECRET: process.env.WORKSHOP_TEST_SESSION_SECRET,
      SANTA_STUDIO_TEST_EXPIRES_AT: process.env.WORKSHOP_TEST_EXPIRES_AT,
    },
  },
});
