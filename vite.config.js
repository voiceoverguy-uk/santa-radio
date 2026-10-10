import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import radioMetadata from './server/radio-metadata.js';
import santaMessage from './server/santa-message.js';
import { trackerPageHtml, isTrackerPreview } from './server/tracker-html.js';
import artworkFeedPlugin from './scripts/artwork-feed-plugin.mjs';

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
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/santa-message', santaMessage);
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/santa-message', santaMessage);
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), artworkFeedPlugin(), metadataPlugin, trackerMetadataPlugin],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/tracker', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
});
