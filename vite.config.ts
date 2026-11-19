import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/* Files that must keep their exact names in the build (no hashing),
   because the manifest, service worker and app fetch them by name. */
const STATIC_FILES = [
  'manifest.json',
  'questions.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'figtree-OFL.txt'
];

/* Copies the static files into the build and writes sw.js with a fresh
   version stamp, so every deploy clears the old cache on the phone. */
function rootStatic(): Plugin {
  return {
    name: 'root-static',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.json' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: './icon-192.png' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './apple-touch-icon.png' }, injectTo: 'head' }
      ]
    },
    generateBundle() {
      for (const file of STATIC_FILES) {
        this.emitFile({ type: 'asset', fileName: file, source: readFileSync(file) });
      }
      const version = 'cyber-daily-' + new Date().toISOString().replace(/[-:.TZ]/g, '');
      const sw = readFileSync('sw.js', 'utf8').replaceAll('__BUILD_VERSION__', version);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), rootStatic()],
  build: { outDir: 'dist', emptyOutDir: true }
});
