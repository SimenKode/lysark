import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// The built interface may only load its own files and the project's media.
// The policy is added at build time; the development server needs inline
// scripts for live reloading, which the policy forbids.
const CSP =
  "default-src 'self'; img-src 'self' lysark-media: lysark-web: data:; media-src lysark-media:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";

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
  },
});
