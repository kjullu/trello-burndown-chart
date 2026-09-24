import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    rollupOptions: {
      input: {
        connector: resolve(import.meta.dirname, 'index.html'),
        card: resolve(import.meta.dirname, 'card.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
      },
    },
  },
});
