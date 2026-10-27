import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import base from './playwright.config.js';

// Ephemeral test-only password, never the configured owner's password.
process.env.WORKSHOP_TEST_PASSWORD ||= randomBytes(32).toString('hex');
export default defineConfig({
  ...base,
  testMatch: /santa-workshop(?:-access|-search|-name-preview|-sounds|-motion|-live-catalogue)?\.spec\.js/,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5001', ignoreHTTPSErrors: false },
  projects: base.projects.filter(project => project.name === 'chromium'),
  webServer: {
    command: process.env.WORKSHOP_SERVING_MODE === 'node'
      ? 'node index.js --port=5001'
      : `node node_modules/vite/bin/vite.js ${process.env.WORKSHOP_SERVING_MODE === 'preview' ? 'preview' : ''} --host 127.0.0.1 --port 5001 --strictPort`,
    url: 'http://127.0.0.1:5001',
    reuseExistingServer: false,
    timeout: 120000,
    env: { SANTA_WORKSHOP_PASSWORD: process.env.WORKSHOP_TEST_PASSWORD },
  },
});
