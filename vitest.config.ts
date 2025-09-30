// vitest.config.ts (at the monorepo root)
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The main test configuration block.
  test: {
    watch: false, // Canister tests are usually run in CI or manually

    // Define the separate test projects here.
    projects: [
      {
        // --- Project 1: Fast, Isolated Canister Tests using PocketIC ---
        test: {
          name: 'canister-tests',
          include: ['packages/canisters/*/test/**/*.test.ts'],
          globalSetup: './test/global-setup.ts', // Uses the PocketIC setup
          testTimeout: 60000,
          hookTimeout: 60_000,

          server: {
            deps: {
              // This external dependency setting will apply to all projects.
              external: [/^@dfinity\//],
            },
          },
        },
        resolve: {
          alias: {
            '@declarations': path.resolve(
              __dirname,
              'packages',
              'declarations',
              'src',
              'generated',
            ),
          },
        },
      },
      {
        // --- Project 2: Full E2E Integration Tests using a DFX replica ---
        test: {
          name: 'e2e-tests',
          include: ['packages/tests/e2e/**/*.test.ts'],
          globalSetup: './packages/tests/e2e/src/global-setup.vitest.ts', // Uses your existing DFX setup
          testTimeout: 60000,
          hookTimeout: 60_000,

          server: {
            deps: {
              // This external dependency setting will apply to all projects.
              external: [/^@dfinity\//],
            },
          },
        },
        resolve: {
          alias: {
            '@declarations': path.resolve(
              __dirname,
              'packages',
              'declarations',
              'src',
              'generated',
            ),
          },
        },
      },
      {
        // --- Project 3: Unit tests ---
        test: {
          name: 'unit-tests',
          include: [
            'packages/libs/**/test/**/*.test.ts',
            'packages/apps/**/src/tests/**/*.test.ts',
          ],

          server: {
            deps: {
              // This external dependency setting will apply to all projects.
              external: [/^@dfinity\//],
            },
          },
        },
        resolve: {
          alias: {
            '@declarations': path.resolve(
              __dirname,
              'packages',
              'declarations',
              'src',
              'generated',
            ),
          },
        },
      },
    ],
  },
});
