import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/tracker', import.meta.url)) } },
  server: { allowedHosts: true },
  build: {
    assetsInlineLimit: 0,
    // A classic bundle avoids module-script file-origin restrictions in WKWebView.
    // Postcard capture remains lazy at source level but ships in this one bundle.
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
