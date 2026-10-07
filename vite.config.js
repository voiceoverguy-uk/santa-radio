import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import radioMetadata from './server/radio-metadata.js';
import santaMessage from './server/santa-message.js';

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
  plugins: [react(), tailwindcss(), metadataPlugin],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/tracker', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
});
