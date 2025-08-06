import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.e2e.test.ts'],
    globalSetup: './src/vitest.global-setup.ts',
    testTimeout: 60000,
    hookTimeout: 60_000,

    server: {
      deps: {
        // This tells the test runner's Node.js server to treat these as
        // external modules, forcing it to use native Node require resolution.
        // This is the opposite of 'inline' and can fix stubborn CJS/ESM issues.
        external: [/^@dfinity\//],
      },
    },
  },

  resolve: {
    alias: {
      '@declarations': path.resolve(__dirname, '..', '..', 'declarations'),
    },
  },
});
