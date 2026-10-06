import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import radioMetadata from './server/radio-metadata.js';

const metadataPlugin = {
  name: 'radio-metadata',
  configureServer(server) {
    server.middlewares.use('/api/radio-metadata', radioMetadata);
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/radio-metadata', radioMetadata);
  },
};

export default defineConfig({
  plugins: [react(), metadataPlugin],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
});
