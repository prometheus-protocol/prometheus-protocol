// In packages/cli/build.mjs
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. Read package.json to get dependencies ---
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
// We want to keep all production dependencies external
const externalDependencies = Object.keys(packageJson.dependencies || {});

// --- 1. Load Production Canister IDs ---
// This part runs in Node.js AT BUILD TIME.
function getProdCanisterIds() {
  const network = 'ic';
  const canisterIdsPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'canister_ids.json',
  );

  if (!fs.existsSync(canisterIdsPath)) {
    console.warn(
      `⚠️ Production canister_ids.json not found at ${canisterIdsPath}. The production build will not have baked-in IDs.`,
    );
    return {};
  }

  const canisterIdsJson = JSON.parse(fs.readFileSync(canisterIdsPath, 'utf-8'));

  // Transform the JSON into the flat map our CLI expects
  return Object.entries(canisterIdsJson).reduce((acc, [name, ids]) => {
    acc[name.toUpperCase()] = ids[network];
    return acc;
  }, {});
}

const prodCanisterIds = getProdCanisterIds();

// --- 2. Configure esbuild ---
esbuild
  .build({
    entryPoints: ['src/index.ts'], // Your CLI's entry point
    bundle: true,
    platform: 'node', // Critical: ensures Node.js compatibility
    target: 'node18', // Target a specific Node version
    outfile: 'dist/cli.js', // The output bundled file
    format: 'esm', // Use ESM format for modern Node.js
    external: externalDependencies,
    define: {
      // This is the magic. We replace a global placeholder with the JSON string of our IDs.
      // The double JSON.stringify is intentional and correct.
      __PROD_CANISTER_IDS__: JSON.stringify(prodCanisterIds),
    },
  })
  .catch(() => process.exit(1));

console.log('✅ CLI build complete.');
console.log('Baked-in production canister IDs:', prodCanisterIds);
