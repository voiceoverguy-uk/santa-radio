import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { build, createServer } from 'vite';

const routes = ['/', '/apps', '/christmas-music', '/missing-radio-ssr-page'];

function assertControls(markup) {
  assert.match(markup, /aria-label="Main navigation"/);
  assert.match(markup, /class="nav-radio"[^>]*>[\s\S]*?Listen Live<\/button>/);
  assert.match(markup, /aria-label="Santa Radio player"/);
  assert.match(markup, /class="radio-play"[^>]*>[\s\S]*?Listen Live<\/button>/);
  assert.match(markup, /aria-label="Radio volume"[^>]*value="0.7"/);
  // Ignore Santa samples and the separate no-JavaScript fallback player.
  assert.equal((markup.match(/<audio src="https:\/\/global\.citrus3\.com:8164\/" preload="none"/g) || []).length,
    1, 'one shared radio source');
}

test('development SSR serves radio controls before and after provider hot reload', { timeout: 90_000 }, async t => {
  const server = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, hmr: false },
  });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const checkRoutes = async () => {
    // Real HTTP requests exercise public-pages-plugin and ssrLoadModule,
    // including concurrent requests for a cold module graph.
    await Promise.all(routes.map(async path => {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, path === routes.at(-1) ? 404 : 200, path);
      const html = await response.text();
      assertControls(html);
      assert.match(html, /\/@vite\/client/);
    }));
  };
  await checkRoutes();

  // Hold on to consumers loaded before the edit. A warm dev graph can retain
  // these while the provider implementation is evaluated again. Creating the
  // context in RadioProvider.jsx made this throw the original null-context error.
  const { default: Navbar } = await server.ssrLoadModule('/src/components/Navbar.jsx');
  const { default: AudioPlayer, RadioButton } = await server.ssrLoadModule('/src/components/AudioPlayer.jsx');
  const previous = await server.ssrLoadModule('/src/components/RadioProvider.jsx');
  assert.throws(() => renderToString(React.createElement(RadioButton)),
    /useRadio must be used within RadioProvider/);
  const providerModule = await server.moduleGraph.getModuleByUrl('/src/components/RadioProvider.jsx', true);
  server.moduleGraph.invalidateModule(providerModule);
  const updated = await server.ssrLoadModule('/src/components/RadioProvider.jsx');
  assert.notEqual(previous.RadioProvider, updated.RadioProvider, 'provider was actually re-evaluated');
  const observed = [];
  function CachedConsumer() { observed.push(previous.useRadio()); return null; }
  function FreshConsumer() { observed.push(updated.useRadio()); return null; }
  const markup = renderToString(React.createElement(updated.RadioProvider, null,
    React.createElement(StaticRouter, { location: '/' },
      React.createElement(Navbar), React.createElement(AudioPlayer),
      React.createElement(CachedConsumer), React.createElement(FreshConsumer))));
  assertControls(markup);
  assert.equal(observed.length, 2);
  assert.equal(observed[0], observed[1], 'cached and fresh consumers receive the same provider state');
  assert.equal(typeof observed[0].togglePlay, 'function');
  await checkRoutes();
});

test('production-built SSR renders the same radio controls', { timeout: 90_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'radio-ssr-build-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Use the real production config (including self-contained SSR dependencies),
  // not the development loader or a possibly stale dist from another change.
  await build({
    logLevel: 'error',
    build: { ssr: 'src/entry-server.jsx', outDir: directory },
  });
  const { render } = await import(pathToFileURL(join(directory, 'entry-server.js')));
  for (const path of routes) {
    const result = render(path);
    assert.equal(result.status, path === routes.at(-1) ? 404 : 200, path);
    assertControls(result.markup);
  }
});
