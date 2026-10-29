import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import radioMetadata from './server/radio-metadata.js';
import radioTopTen from './server/radio-top-ten.js';
import santaMessage from './server/santa-message.js';
import santaNames from './server/santa-names.js';
import workshopCatalogue from './server/santa-workshop-catalogue.js';
import workshopAccess, { workshopDocumentHeaders } from './server/santa-workshop-access.js';
import santaGreeting from './server/santa-greeting.js';
import nameRequests from './server/name-requests.js';
import christmasContenders from './server/christmas-contenders.js';
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from './server/middlewares/clerkProxyMiddleware.js';
import { trackerPageHtml, isTrackerPreview } from './server/tracker-html.js';
import artworkFeedPlugin from './scripts/artwork-feed-plugin.mjs';
import publicPagesPlugin from './server/public-pages-plugin.js';
import { publicRequestUrl } from './src/seo/requestUrl.js';
import { santaAudioRecipeVersion } from './scripts/santa-audio-recipe.mjs';
import stripeWebhook from './server/stripe-webhook.js';
import studioPaidAccess from './server/santa-studio-purchase.js';
import studioCheckout from './server/santa-studio-checkout.js';

const trackerMetadataPlugin = {
  name: 'tracker-page-metadata',
  transformIndexHtml(html, context) {
    const pathname = publicRequestUrl(context.originalUrl || context.path, 'http://server').pathname;
    return trackerPageHtml(html, pathname);
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (isTrackerPreview(publicRequestUrl(req.url, 'http://server').pathname)) res.setHeader('X-Robots-Tag', 'noindex, follow');
      next();
    });
  },
};

const metadataPlugin = {
  name: 'radio-metadata',
  configureServer(server) {
    server.middlewares.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
    server.middlewares.use('/api/stripe/webhook', stripeWebhook);
    server.middlewares.use('/api/santa-studio-access', studioPaidAccess);
    server.middlewares.use('/api/santa-studio-checkout', studioCheckout);
    server.middlewares.use(workshopDocumentHeaders);
    server.middlewares.use('/api/santa-workshop-access', workshopAccess);
    server.middlewares.use('/api/name-requests', nameRequests);
    server.middlewares.use('/api/christmas-contenders', christmasContenders);
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/radio-top-ten', radioTopTen);
    server.middlewares.use('/api/santa-message', santaMessage);
    server.middlewares.use('/api/santa-names', santaNames);
    server.middlewares.use('/api/santa-workshop-catalogue', workshopCatalogue);
    server.middlewares.use('/api/santa-greeting', santaGreeting);
  },
  configurePreviewServer(server) {
    server.middlewares.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
    server.middlewares.use('/api/stripe/webhook', stripeWebhook);
    server.middlewares.use('/api/santa-studio-access', studioPaidAccess);
    server.middlewares.use('/api/santa-studio-checkout', studioCheckout);
    server.middlewares.use(workshopDocumentHeaders);
    server.middlewares.use('/api/santa-workshop-access', workshopAccess);
    // Vite's SPA preview fallback otherwise serves the pre-rendered homepage.
    // Serve the standalone noindex Studio preview instead of the homepage.
    server.middlewares.use(async (req, res, next) => {
      if (!/^\/santa-message-workshop\/?$/.test(publicRequestUrl(req.url, 'http://server').pathname)) return next();
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end();
      }
      try {
        const html = await readFile(new URL('./dist/santa-message-workshop/index.html', import.meta.url), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' });
        res.end(req.method === 'HEAD' ? undefined : html);
      } catch { res.writeHead(503); res.end('Build the workshop preview before starting preview mode.'); }
    });
    server.middlewares.use('/api/name-requests', nameRequests);
    server.middlewares.use('/api/christmas-contenders', christmasContenders);
    server.middlewares.use('/api/radio-metadata', radioMetadata);
    server.middlewares.use('/api/radio-top-ten', radioTopTen);
    server.middlewares.use('/api/santa-message', santaMessage);
    server.middlewares.use('/api/santa-names', santaNames);
    server.middlewares.use('/api/santa-workshop-catalogue', workshopCatalogue);
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
