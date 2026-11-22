import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// The built interface may only load its own files and the project's media.
// The policy is added at build time; the development server needs inline
// scripts for live reloading, which the policy forbids.
// The interface reads the project's own recordings through lysark-media: to
// draw and play them; that is the program's own protocol, not the network.
const CSP =
  "default-src 'self'; img-src 'self' lysark-media: lysark-web: data:; media-src lysark-media:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' lysark-media:; " +
  "object-src 'none'; base-uri 'none'";

function contentSecurityPolicy(): Plugin {
  let building = false;
  return {
    name: 'lysark-csp',
    configResolved(config) {
      building = config.command === 'build';
    },
    transformIndexHtml(html) {
      const meta = building ? `<meta http-equiv="Content-Security-Policy" content="${CSP}" />` : '';
      return html.replace('<!--csp-->', meta);
    },
  };
}

/**
 * pdf.js (Apache-2.0) and its two picture decoders (BSD) are built into the
 * interface, and the package itself is kept out of the packaged program so
 * that its font and character-map folders never follow along (see
 * docs/stakk.md). Their licence texts are therefore laid next to the built
 * files here.
 */
const PDFJS_LICENCES = [
  'LICENSE',
  'wasm/LICENSE_OPENJPEG',
  'wasm/LICENSE_PDFJS_OPENJPEG',
  'wasm/LICENSE_JBIG2',
  'wasm/LICENSE_PDFJS_JBIG2',
];

function pdfjsLicences(): Plugin {
  return {
    name: 'lysark-pdfjs-licences',
    apply: 'build',
    generateBundle() {
      for (const file of PDFJS_LICENCES) {
        this.emitFile({
          type: 'asset',
          fileName: `licenses/pdfjs-dist/${basename(file)}`,
          source: readFileSync(resolve(__dirname, 'node_modules/pdfjs-dist', file)),
        });
      }
    },
  };
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), contentSecurityPolicy(), pdfjsLicences()],
    build: {
      rollupOptions: {
        input: {
          // The program's interface, and the page that draws video frames.
          index: resolve(__dirname, 'src/renderer/index.html'),
          frame: resolve(__dirname, 'src/renderer/frame.html'),
        },
      },
    },
  },
});
