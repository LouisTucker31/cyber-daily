import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/* Files in public/ (manifest, questions.json, icons, font licence) are copied
   into the build as-is, keeping their exact names, because the manifest,
   service worker and app fetch them by name. */

/* Adds the manifest and icon links, and writes sw.js with a fresh version
   stamp, so every deploy clears the old cache on the phone. */
function pwa(): Plugin {
  return {
    name: 'pwa',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.json' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: './icon-192.png' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './apple-touch-icon.png' }, injectTo: 'head' }
      ]
    },
    generateBundle() {
      const version = 'cyber-daily-' + new Date().toISOString().replace(/[-:.TZ]/g, '');
      const sw = readFileSync('src/sw.js', 'utf8').replaceAll('__BUILD_VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), pwa()],
  build: { outDir: 'dist', emptyOutDir: true }
});
