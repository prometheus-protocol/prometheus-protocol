import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60_000, // 60 seconds
    hookTimeout: 60_000,
  },
});
