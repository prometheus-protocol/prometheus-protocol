import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Point to the global setup file
    globalSetup: './test/vitest.global-setup.ts',
    // Optional: Set a longer timeout for E2E tests
    testTimeout: 60000,
    hookTimeout: 60_000,
  },
});
