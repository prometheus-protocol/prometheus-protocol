import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.e2e.test.ts'],
    globalSetup: './src/vitest.global-setup.ts',
    testTimeout: 60000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@declarations': path.resolve(__dirname, '..', '..', 'declarations'),
    },
  },
});
