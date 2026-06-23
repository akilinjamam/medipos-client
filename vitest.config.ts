import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the PWA/Workbox plugin isn't loaded for tests.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Default to the fast node env; component tests opt into jsdom per-file with
    // a `// @vitest-environment jsdom` docblock (spinning up jsdom for every
    // pure-logic file is slow and was timing out worker startup on Windows).
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    pool: 'threads',
  },
});
