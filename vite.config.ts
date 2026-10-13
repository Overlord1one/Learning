/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Emits the service worker with the list of all build files to precache. */
function serviceWorker(): Plugin {
  return {
    name: 'setup-quest-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(
        // Only the Latin font subsets are needed for a German UI.
        (f) => !f.endsWith('.map') && (!/\.woff2?$/.test(f) || /latin/.test(f)) && !/(cyrillic|greek|vietnamese)/.test(f),
      );
      const staticFiles = ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
      const precache = ['./', ...staticFiles, ...files].map((f) => (f === './' ? f : `./${f}`));
      const source = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8')
        .replace('__VERSION__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base: works on any static host or sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
