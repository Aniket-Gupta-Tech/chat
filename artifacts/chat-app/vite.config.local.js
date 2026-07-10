/**
 * vite.config.local.js — used by server.js when running locally in VS Code.
 *
 * Differences from vite.config.ts (Replit):
 *  - No Replit plugins (runtime-error-modal, cartographer, dev-banner)
 *  - PORT and BASE_PATH env vars are NOT required — defaults to 5173 and '/'
 *  - Proxies /api/* → http://localhost:8080 (Replit does this at infra level)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',

  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  root: __dirname,

  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
  },

  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,

    // Proxy all /api/* requests (REST + Socket.IO WS) to the Express server.
    // Vite handles the WebSocket upgrade transparently via ws: true.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,           // ← Socket.IO WebSocket upgrade
        secure: false,
      },
    },
  },
});
