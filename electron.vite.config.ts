import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
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

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), contentSecurityPolicy()],
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
