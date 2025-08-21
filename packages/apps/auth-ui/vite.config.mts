import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import environment from 'vite-plugin-environment';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`[VITE CONFIG] DFX_NETWORK is: ${process.env.DFX_NETWORK}`);

const network = process.env.DFX_NETWORK || 'local';

// --- Canister ID Loading Logic (Unchanged) ---
function initCanisterEnv() {
  const network = process.env.DFX_NETWORK || 'local';
  const canisterIdsPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '.dfx',
    network,
    'canister_ids.json',
  );

  if (!fs.existsSync(canisterIdsPath)) {
    console.error(
      "Could not find canister_ids.json. Make sure you've deployed.",
    );
    return {};
  }

  try {
    const canisterIds = JSON.parse(fs.readFileSync(canisterIdsPath, 'utf-8'));
    return Object.entries(canisterIds).reduce((acc, [name, ids]) => {
      const key = `CANISTER_ID_${name.toUpperCase()}`;
      const value = (ids as Record<string, string>)[network];
      acc[key] = value;
      return acc;
    }, {});
  } catch (e) {
    console.error('Error parsing canister_ids.json:', e);
    return {};
  }
}

// --- Main Vite Config ---
export default defineConfig(({ mode }) => {
  const canisterEnvVariables = initCanisterEnv();
  const isDevelopment = mode !== 'production';

  const internetIdentityUrl =
    network === 'local'
      ? `http://${canisterEnvVariables['CANISTER_ID_INTERNET_IDENTITY']}.localhost:4943/`
      : `https://identity.ic0.app`;

  return {
    publicDir: 'assets',
    plugins: [
      react(),
      environment({
        NODE_ENV: isDevelopment ? 'development' : 'production',
        II_URL: internetIdentityUrl,
        DFX_NETWORK: network,
        ...canisterEnvVariables,
      }),
    ],
    resolve: {
      alias: [
        // --- FIX 1: Explicit Polyfills ---
        { find: 'buffer', replacement: 'buffer/' },
        { find: 'events', replacement: 'events/' },
        { find: 'stream', replacement: 'stream-browserify' },
        { find: 'util', replacement: 'util/' },
        { find: 'process', replacement: 'process/browser' },

        { find: '@', replacement: path.resolve(__dirname, 'src') },
        {
          find: '@declarations',
          replacement: path.resolve(__dirname, '..', '..', 'declarations'),
        },
      ],

      dedupe: ['@dfinity/agent', '@dfinity/candid', '@dfinity/principal'],
    },
    optimizeDeps: {
      include: ['@dfinity/agent', '@dfinity/candid', '@dfinity/principal'],
    },
    build: {
      outDir: path.resolve(__dirname, '..', '..', '..', 'dist', 'auth_ui'),
      emptyOutDir: true,
    },
    define: {
      global: 'window', // Shim for the 'global' object
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:4943',
          changeOrigin: true,
        },
      },
    },
  };
});
