import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';

// Isolated real-component harness. This never bypasses the app's staff gate or
// changes any application route; all API replies contain dummy test data.
test('private report qualifies totals and never shows stale success data after refresh failures', { timeout: 60000 }, async () => {
  const entry = '/__usage-test-entry.js';
  const cacheDir = await mkdtemp(join(tmpdir(), 'voucher-report-vite-'));
  const server = await createServer({
    configFile: false, appType: 'custom', cacheDir, esbuild: { jsx: 'automatic' },
    optimizeDeps: { noDiscovery: true,
      include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{
      name: 'isolated-usage-report-test',
      resolveId(id) { if (id === entry) return entry; },
      load(id) {
        if (id === entry) return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import Report from '/src/components/SchoolVoucherUsage.jsx';
          createRoot(document.getElementById('root')).render(React.createElement(Report));`;
      },
      configureServer(vite) {
        vite.middlewares.use('/report-test', (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(`<html><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>`);
        });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = { entries: 0, messages: 0, corrections: 0, totalRecordings: 0,
      startedAnother: 0, firstEntryAt: null };
    const zero = { ...base, vouchers: [{ ...base, slot: 1, name: 'Voucher 1', code: 'DUMMY-TEST-ONLY' }] };
    let reply = zero;
    let failure = null;
    let release;
    let waiting = new Promise(resolve => { release = resolve; });
    await page.route('**/api/santa-workshop-usage', async route => {
      await waiting;
      if (failure === 'network') return route.abort('failed');
      return route.fulfill({ status: typeof failure === 'number' ? failure : 200,
        contentType: 'application/json', body: JSON.stringify(reply) });
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/report-test`);
    await expect(page.getByRole('note')).toContainText('Tracked activity only.');
    await expect(page.getByRole('button', { name: 'Refreshing…' })).toBeVisible();
    await expect(page.getByText('Reporting data loaded successfully.', { exact: false })).toHaveCount(0);
    release();
    await expect(page.getByRole('heading', { name: 'No tracked voucher activity yet' })).toBeVisible();
    await expect(page.getByText('A zero means no tracked activity', { exact: false })).toBeVisible();
    const refresh = () => page.getByRole('button', { name: 'Refresh totals', exact: true }).click();
    reply = { ...zero, entries: 3, vouchers: [{ ...zero.vouchers[0], entries: 3 }] };
    await refresh();
    await expect(page.getByRole('heading', { name: 'No tracked voucher activity yet' })).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('does not confirm uninterrupted tracking');
    await expect(page.getByText('DUMMY-TEST-ONLY')).toBeVisible();

    for (const problem of [503, 401, 'network', 'malformed']) {
      if (problem === 'malformed') { reply = {}; failure = null; } else failure = problem;
      await refresh();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('DUMMY-TEST-ONLY')).toHaveCount(0);
      await expect(page.getByText('Reporting data loaded successfully.', { exact: false })).toHaveCount(0);
      await expect(page.getByRole('note')).toContainText('may be missing during reporting outages');
    }
    // The diagnostic remains independently usable while the usage reader fails.
    const diagnostic = page.getByRole('region', { name: 'Recording service diagnostic' });
    let diagnosticRequests = 0;
    let diagnosticStatus = 200;
    const diagnosticReply = {
      kind: 'studio-storage-diagnostic', checkedAt: '2026-11-03T15:00:00.000Z',
      runtime: { host: 'vercel', environment: 'preview', deployment: 'dummy-deployment.example' },
      database: { configured: true, connected: true, host: 'dummy-database.example', name: 'dummy-database' },
      storage: { checked: true, ready: false, access: { checked: true, ready: true },
        generation: { checked: true, ready: false, reason: 'table_or_columns_missing' },
        reporting: { checked: true, ready: false, reason: 'database_permissions' } },
      tables: [{ name: 'santa_studio_generation_results', present: false,
        permissions: { read: false, insert: false, update: false, delete: false } }],
    };
    let diagnosticBody = diagnosticReply;
    await page.route(url => url.pathname === '/api/santa-workshop-usage'
      && url.searchParams.has('diagnostic'), route => {
      diagnosticRequests++;
      return route.fulfill({ status: diagnosticStatus, contentType: 'application/json',
        body: JSON.stringify(diagnosticBody) });
    });
    assert.equal(diagnosticRequests, 0, 'Diagnostic must not run automatically');
    await diagnostic.getByRole('button', { name: 'Check recording storage' }).click();
    await expect(diagnostic.getByRole('status')).toContainText('not a successful MP3 test');
    await expect(diagnostic.getByText('dummy-database.example', { exact: true })).toBeVisible();
    await expect(diagnostic.getByText('A required table or column is missing.', { exact: false })).toBeVisible();
    await expect(diagnostic.getByText('without automatic expiry', { exact: false })).toBeVisible();
    assert.equal(diagnosticRequests, 1);
    for (const problem of [503, 401, 'malformed']) {
      diagnosticStatus = typeof problem === 'number' ? problem : 200;
      diagnosticBody = problem === 'malformed' ? {} : diagnosticReply;
      await diagnostic.getByRole('button', { name: 'Check recording storage' }).click();
      await expect(diagnostic.getByRole('alert')).toBeVisible();
      await expect(diagnostic.getByText('dummy-database.example', { exact: true })).toHaveCount(0);
    }
    failure = null;
    reply = zero;
    await refresh();
    await expect(page.getByRole('heading', { name: 'No tracked voucher activity yet' })).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, { recursive: true, force: true });
  }
});
