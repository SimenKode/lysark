import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The end-to-end tests start the whole program, which takes a while.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
