import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // This will automatically clean up mocks after each test
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@declarations': path.resolve(__dirname, '..', '..', 'declarations'),
    },
  },
});
