import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromiumPath = process.env.CHROMIUM_PATH ||
  (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: {
    baseURL: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000',
    // Bundled Firefox/WebKit do not use the workspace proxy's certificate store.
    // This applies only to the ephemeral development host, never the app itself.
    ignoreHTTPSErrors: Boolean(process.env.REPLIT_DEV_DOMAIN),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: chromiumPath, args: ['--no-sandbox'] },
      },
    },
    {
      name: 'firefox',
      testMatch: /cookie-experience\.spec\.js/,
      use: {
        browserName: 'firefox',
        launchOptions: { firefoxUserPrefs: { 'network.cookie.cookieBehavior': 1 } },
      },
    },
    {
      name: 'webkit',
      testMatch: /cookie-experience\.spec\.js/,
      use: { browserName: 'webkit' },
    },
  ],
});
