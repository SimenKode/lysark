// Builds the HTML player into one self-contained script. The exporter
// writes that script into every exported HTML file.
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'out/player',
    emptyOutDir: true,
    minify: true,
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'src/player/main.ts'),
      name: 'LysarkPlayer',
      formats: ['iife'],
      fileName: () => 'player.js',
    },
  },
});
