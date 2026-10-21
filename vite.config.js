import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import radioMetadata from './server/radio-metadata.js';
import radioTopTen from './server/radio-top-ten.js';
import santaMessage from './server/santa-message.js';
import santaNames from './server/santa-names.js';
import santaGreeting from './server/santa-greeting.js';
import nameRequests from './server/name-requests.js';
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from './server/middlewares/clerkProxyMiddleware.js';
import { trackerPageHtml, isTrackerPreview } from './server/tracker-html.js';
import artworkFeedPlugin from './scripts/artwork-feed-plugin.mjs';
import publicPagesPlugin from './server/public-pages-plugin.js';
import { santaAudioRecipeVersion } from './scripts/santa-audio-recipe.mjs';

const trackerMetadataPlugin = {
  name: 'tracker-page-metadata',
  transformIndexHtml(html, context) {
    const pathname = new URL(context.originalUrl || context.path, 'http://server').pathname;
    return trackerPageHtml(html, pathname);
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (isTrackerPreview(new URL(req.url, 'http://server').pathname)) res.setHeader('X-Robots-Tag', 'noindex, follow');
      next();
    });
  },
};

const metadataPlugin = {
  name: 'radio-metadata',
  configureServer(server) {
    server.middlewares.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
    server.middlewares.use('/api/name-requests', nameRequests);
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/radio-top-ten', radioTopTen);
    server.middlewares.use('/api/santa-message', santaMessage);
    server.middlewares.use('/api/santa-names', santaNames);
    server.middlewares.use('/api/santa-greeting', santaGreeting);
  },
  configurePreviewServer(server) {
    server.middlewares.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
    server.middlewares.use('/api/name-requests', nameRequests);
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/radio-top-ten', radioTopTen);
    server.middlewares.use('/api/santa-message', santaMessage);
    server.middlewares.use('/api/santa-names', santaNames);
    server.middlewares.use('/api/santa-greeting', santaGreeting);
  },
};

export default defineConfig(({ isSsrBuild }) => ({
  define: { __SANTA_AUDIO_RECIPE__: JSON.stringify(santaAudioRecipeVersion()) },
  publicDir: isSsrBuild ? false : 'public',
  ssr: {
    // Keep the runtime Tracker renderer self-contained. Vercel's package
    // resolution differs from local Node for some React/CommonJS dependencies.
    noExternal: isSsrBuild ? true : undefined,
    resolve: { externalConditions: ['module-sync', 'node'] },
  },
  plugins: [react(), tailwindcss(), artworkFeedPlugin(), metadataPlugin, publicPagesPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/tracker', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
}));
