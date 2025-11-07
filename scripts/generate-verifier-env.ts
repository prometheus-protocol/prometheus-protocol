#!/usr/bin/env zx
import { $, chalk, argv } from 'zx';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// ==================================================================================================
// Generate Verifier Bot .env File
//
// This script generates a .env file for docker-compose with API keys from registered verifiers.
//
// Usage:
//   pnpm generate:verifier-env              # Local network
//   pnpm generate:verifier-env --network ic # Production network
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
  'node-7',
  'node-8',
  'node-9',
];

const OUTPUT_PATH = join(
  process.cwd(),
  'packages/apps/verifier-bot/deployment/.env',
);

// --- MAIN SCRIPT ---

async function getCurrentIdentity(): Promise<string> {
  const result = await $`dfx identity whoami 2>/dev/null`;
  return result.stdout.trim();
}

async function main() {
  $.verbose = false;

  console.log(chalk.bold.cyan('📝 Generating verifier bot .env file...'));
  console.log(chalk.dim(`Network: ${NETWORK}`));
  console.log('');

  // Save current identity to restore later
  const originalIdentity = await getCurrentIdentity();

  // Get canister IDs
  console.log(chalk.bold('🔍 Fetching canister IDs...'));
  const audit_hub = (
    await $`dfx canister id audit_hub --network ${NETWORK}`
  ).stdout.trim();
  console.log(chalk.green(`✅ audit_hub: ${audit_hub}`));
  console.log('');

  // Collect API keys
  console.log(chalk.bold('🔑 Collecting API keys...'));
  const apiKeys: string[] = [];

  for (const identity of DEV_IDENTITIES) {
    try {
      await $`dfx identity use ${identity} 2>/dev/null`;

      const apiKeysResult =
        await $`dfx canister call ${audit_hub} list_api_keys --network ${NETWORK}`;
      const output = apiKeysResult.stdout.trim();

      const keyMatch = output.match(/api_key = "([^"]+)"/);
      if (keyMatch) {
        const apiKey = keyMatch[1];
        apiKeys.push(apiKey);
        console.log(chalk.green(`  ✅ ${identity}: ${apiKey}`));
      } else {
        console.log(chalk.red(`  ❌ ${identity}: No API key found`));
        apiKeys.push(''); // Placeholder
      }
    } catch (error) {
      console.error(chalk.red(`  ❌ ${identity}: Error fetching key`));
      apiKeys.push(''); // Placeholder
    }
  }

  // Restore original identity
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;
  console.log('');

  // Generate .env content
  console.log(chalk.bold('📄 Generating .env file...'));

  // Try to read existing GITHUB_TOKEN if .env exists
  let githubToken = '';
  try {
    const existingEnv =
      await $`cat ${OUTPUT_PATH} 2>/dev/null | grep GITHUB_TOKEN || echo ""`;
    const tokenMatch = existingEnv.stdout.match(/GITHUB_TOKEN=(.+)/);
    if (tokenMatch) {
      githubToken = tokenMatch[1].trim();
    }
  } catch (e) {
    // File doesn't exist, that's ok
  }

  const envContent = `# Verifier Bot Environment Configuration
# Generated automatically by scripts/generate-verifier-env.ts
# Network: ${NETWORK}
# Generated at: ${new Date().toISOString()}

# Network configuration
IC_NETWORK=${NETWORK}

# GitHub token for authenticating with GitHub API during builds
GITHUB_TOKEN=${githubToken}

# Polling and timeout settings
POLL_INTERVAL_MS=60000
BUILD_TIMEOUT_MS=600000

# API Keys for each verifier bot
VERIFIER_1_API_KEY=${apiKeys[0] || ''}
VERIFIER_2_API_KEY=${apiKeys[1] || ''}
VERIFIER_3_API_KEY=${apiKeys[2] || ''}
VERIFIER_4_API_KEY=${apiKeys[3] || ''}
VERIFIER_5_API_KEY=${apiKeys[4] || ''}
VERIFIER_6_API_KEY=${apiKeys[5] || ''}
VERIFIER_7_API_KEY=${apiKeys[6] || ''}
VERIFIER_8_API_KEY=${apiKeys[7] || ''}
VERIFIER_9_API_KEY=${apiKeys[8] || ''}
`;

  // Write to file
  await writeFile(OUTPUT_PATH, envContent, 'utf-8');
  console.log(chalk.green(`✅ .env file written to: ${OUTPUT_PATH}`));
  console.log('');

  console.log(chalk.bold.green('🎉 Verifier bot .env file generated!'));
  console.log('');
  console.log(chalk.cyan('Next steps:'));
  console.log(
    chalk.cyan(
      '  1. Review the .env file: cat packages/apps/verifier-bot/deployment/.env',
    ),
  );
  console.log(
    chalk.cyan(
      '  2. Start the bots: cd packages/apps/verifier-bot/deployment && docker-compose up -d',
    ),
  );
  console.log(chalk.cyan('  3. View logs: docker-compose logs -f'));
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error generating .env file:'), err);
  process.exit(1);
});
