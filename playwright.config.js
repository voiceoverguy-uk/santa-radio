import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium', args: ['--no-sandbox'] },
  },
});
