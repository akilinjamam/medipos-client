import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      // The POS must boot offline: precache the app shell, serve the SPA for
      // navigations (but never for /api requests), and runtime-cache the catalog
      // GETs as a NetworkFirst secondary layer (the primary offline read path is
      // IndexedDB via Dexie — see src/db/catalog.ts).
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /\/api\/v1\/(products|batches)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'medipos-catalog',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 256, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
      manifest: {
        name: 'MediPOS Terminal',
        short_name: 'MediPOS',
        description: 'Pharmacy POS terminal — offline-capable billing, by Byte Dynamo',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large third-party libs into their own long-cacheable chunks so
        // no single bundle trips the size budget and vendor code isn't re-fetched
        // on every app deploy. (rolldown-vite only supports the function form.)
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('/react-router') ||
            id.includes('/react-dom') ||
            id.includes('/react/') ||
            id.includes('/scheduler/')
          )
            return 'react-vendor';
          if (id.includes('/@reduxjs/') || id.includes('/react-redux/')) return 'redux';
          if (id.includes('/framer-motion/') || id.includes('/motion-')) return 'motion';
          if (id.includes('/dexie')) return 'dexie';
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
