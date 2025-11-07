#!/usr/bin/env zx
import { $, chalk, argv } from 'zx';

// ==================================================================================================
// List Dev API Keys Script
//
// This script lists all API keys for dev verifier accounts using dfx identities.
//
// Usage:
//   pnpm list:api-keys              # Local network
//   pnpm list:api-keys --network ic # Production network
//
// ==================================================================================================

// --- CONFIGURATION ---
const NETWORK = argv.network || process.env.DFX_NETWORK || 'local';
const DEV_IDENTITIES = [
  'node-1',
  'node-2',
  'node-3',
  'node-4',
  'node-5',
  'node-6',
];

// --- MAIN SCRIPT ---

async function getPrincipal(identity: string): Promise<string> {
  const result =
    await $`dfx identity use ${identity} 2>/dev/null && dfx identity get-principal`;
  return result.stdout.trim();
}

async function getCurrentIdentity(): Promise<string> {
  const result = await $`dfx identity whoami 2>/dev/null`;
  return result.stdout.trim();
}

async function main() {
  $.verbose = false;

  console.log(chalk.bold.cyan('🔑 Listing API keys for dev verifiers...'));
  console.log(chalk.dim(`Network: ${NETWORK}`));
  console.log('');

  // Save current identity to restore later
  const originalIdentity = await getCurrentIdentity();

  // Get canister IDs
  const audit_hub = (
    await $`dfx canister id audit_hub --network ${NETWORK}`
  ).stdout.trim();

  console.log(chalk.bold('Dev Verifier API Keys'));
  console.log('═'.repeat(80));
  console.log('');

  // Process each dev identity
  for (const identity of DEV_IDENTITIES) {
    try {
      // Switch to this identity
      await $`dfx identity use ${identity} 2>/dev/null`;
      const principal = await getPrincipal(identity);

      console.log(chalk.bold.yellow(`${identity}`));
      console.log(chalk.dim(`Principal: ${principal}`));

      // List API keys
      const apiKeysResult =
        await $`dfx canister call ${audit_hub} list_api_keys --network ${NETWORK}`;
      const output = apiKeysResult.stdout.trim();

      // Parse the output to extract just the API key
      if (output.includes('vec {}') || output === '(vec {})') {
        console.log(chalk.red('  ❌ No API keys found'));
      } else {
        // Extract API key from the Candid output
        const keyMatch = output.match(/api_key = "([^"]+)"/);
        const createdMatch = output.match(/created_at = ([\d_]+)/);

        if (keyMatch) {
          const apiKey = keyMatch[1];
          const created = createdMatch
            ? createdMatch[1].replace(/_/g, '')
            : 'unknown';
          const date = createdMatch
            ? new Date(Number(created) / 1_000_000).toLocaleString()
            : 'unknown';

          console.log(chalk.green('  ✅ API Key: ') + chalk.cyan(apiKey));
          console.log(chalk.dim(`     Created: ${date}`));
        } else {
          console.log(chalk.yellow('  API Keys:'));
          console.log(chalk.dim(`  ${output}`));
        }
      }
      console.log('');
    } catch (error) {
      console.error(
        chalk.red.bold(`❌ Error listing keys for ${identity}:`),
        error,
      );
    }
  }

  // Restore original identity
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;

  console.log(chalk.bold.green('✅ Done!'));
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error listing API keys:'), err);
  process.exit(1);
});
