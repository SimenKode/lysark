import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The end-to-end tests start the whole program, which takes a while.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // The end-to-end files run side by side, and one of them exports video,
    // which keeps the machine busy: give polls time before they give up.
    expect: { poll: { timeout: 8000 } },
  },
});
