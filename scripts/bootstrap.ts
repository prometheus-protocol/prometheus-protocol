#!/usr/bin/env zx
import { $, chalk } from 'zx';

// ==================================================================================================
// Prometheus Protocol Bootstrap Script (zx)
//
// This script configures all the core canisters of the Prometheus Protocol after a fresh deploy.
// It sets stake requirements, mints initial auditor reputation, and wires up all the
// inter-canister dependencies.
//
// Usage:
// 1. Make sure you have deployed all canisters (`dfx deploy`).
// 2. Update the CONFIGURATION section below with your desired values.
// 3. Run the script from your project root: `pnpm bootstrap` (assuming you add it to package.json)
//    or directly: `./scripts/bootstrap.ts`
//
// ==================================================================================================

// --- CONFIGURATION ---
// Please update these variables before running the script.

// The principal of the auditor you want to grant initial reputation to.
// Get this from `dfx identity get-principal` or your wallet principal.
const AUDITOR_PRINCIPAL =
  'zxuwv-zt33i-dtske-3tzt5-iw3b4-mjuif-jc4vr-hz2vk-ky2v4-kyrkv-pqe';

// The amount of USDC required to stake for each audit type.
const STAKE_AMOUNT = 1; // Example: 1 USDC with 0 decimals

// The amount of reputation tokens to mint for the initial auditor for each category.
const MINT_AMOUNT = 100;

// --- The amount of USDC to transfer to the initial auditor. ---
// This should be enough to cover several stakes.
const USDC_TRANSFER_AMOUNT = 100_000_000;

// --- The number of TRILLION cycles to fabricate for the orchestrator canister. ---
// The `--t` flag is a convenient shorthand provided by `dfx ledger fabricate-cycles`.
const ORCHESTRATOR_CYCLES_IN_TRILLIONS = 100; // Example: 5T cycles

// --- MAIN SCRIPT ---

async function main() {
  $.verbose = false; // We'll handle our own logging for clarity.

  console.log(
    chalk.bold.cyan('🚀 Starting Prometheus Protocol bootstrap script...'),
  );
  console.log('');

  // 1. Fetch all necessary canister IDs
  console.log(chalk.bold('🔍 Fetching canister IDs...'));
  const canisterNames = [
    'audit_hub',
    'leaderboard',
    'mcp_orchestrator',
    'mcp_registry',
    'search_index',
    'usage_tracker',
    'usdc_ledger',
  ];

  const canisterIdPromises = canisterNames.map(async (name) => {
    const id = (await $`dfx canister id ${name}`).stdout.trim();
    return [name, id];
  });

  const canisterIds = Object.fromEntries(await Promise.all(canisterIdPromises));
  console.log(chalk.green('✅ Canister IDs fetched.'));
  console.log('');

  // 2. Configure the Auditor Credentials canister
  console.log(chalk.bold('🔧 Configuring Audit Hub Canister...'));

  console.log('  - Setting USDC Ledger canister...');
  await $`dfx canister call ${canisterIds.audit_hub} set_usdc_ledger_id '(principal "${canisterIds.usdc_ledger}")'`;

  console.log('  - Configuring payment token (USDC with 6 decimals)...');
  await $`dfx canister call ${canisterIds.audit_hub} set_payment_token_config '(principal "${canisterIds.usdc_ledger}", "USDC", 6:nat8)'`;

  const AUDIT_TYPES = [
    'build_reproducibility_v1',
    'app_info_v1',
    'tools_v1',
    'data_security_v1',
  ];

  for (const type of AUDIT_TYPES) {
    console.log(
      `  - Setting stake requirement for '${type}' to ${STAKE_AMOUNT}...`,
    );
    await $`dfx canister call ${canisterIds.audit_hub} set_stake_requirement '("${type}", ${STAKE_AMOUNT}:nat)'`;
  }

  for (const type of AUDIT_TYPES) {
    console.log(`    - Minting ${MINT_AMOUNT} '${type}' tokens...`);
    await $`dfx canister call ${canisterIds.audit_hub} mint_tokens '(principal "${AUDITOR_PRINCIPAL}", "${type}", ${MINT_AMOUNT}:nat)'`;
  }

  console.log(
    chalk.yellow(
      `  - Transferring ${USDC_TRANSFER_AMOUNT} USDC units to auditor...`,
    ),
  );
  const transferArgs = `(record { to = record { owner = principal \"${AUDITOR_PRINCIPAL}\"; subaccount = null }; amount = ${USDC_TRANSFER_AMOUNT}:nat })`;
  await $`dfx canister call ${canisterIds.usdc_ledger} icrc1_transfer ${transferArgs}`;
  console.log(chalk.green('    - Transfer complete.'));

  console.log(chalk.green('✅ Audit Hub configured.'));
  console.log('');

  // 3. Initialize the Leaderboard canister
  console.log(chalk.bold('📊 Initializing Leaderboard Canister...'));
  await $`dfx canister call ${canisterIds.leaderboard} init '(principal "${canisterIds.usage_tracker}")'`;
  console.log(chalk.green('✅ Leaderboard initialized.'));
  console.log('');

  // 4. Configure the Orchestrator canister
  console.log(chalk.bold('⚙️ Configuring Orchestrator Canister...'));
  await $`dfx canister call ${canisterIds.mcp_orchestrator} set_usage_tracker_id '(principal "${canisterIds.usage_tracker}")'`;
  console.log(chalk.green('✅ Orchestrator configured.'));
  console.log('');

  // --- Fabricate cycles for the orchestrator ---
  console.log(
    chalk.yellow(
      `  - Fabricating and depositing ${ORCHESTRATOR_CYCLES_IN_TRILLIONS}T cycles into Orchestrator...`,
    ),
  );
  await $`dfx ledger fabricate-cycles --t ${ORCHESTRATOR_CYCLES_IN_TRILLIONS} --canister ${canisterIds.mcp_orchestrator}`;
  console.log(chalk.green('  - Cycles fabricated.'));
  console.log(chalk.green('✅ Orchestrator provisioned.'));
  console.log('');

  // 5. Configure the Search Index canister
  console.log(chalk.bold('🔎 Configuring Search Index Canister...'));
  await $`dfx canister call ${canisterIds.search_index} set_registry_canister_id '(principal "${canisterIds.mcp_registry}")'`;
  console.log(chalk.green('✅ Search Index configured.'));
  console.log('');

  // 6. Configure the Registry canister (the central hub)
  console.log(chalk.bold('📚 Configuring Registry Canister...'));
  console.log('  - Setting Auditor Credentials canister...');
  await $`dfx canister call ${canisterIds.mcp_registry} set_auditor_credentials_canister_id '(principal "${canisterIds.audit_hub}")'`;

  console.log('  - Setting Orchestrator canister...');
  await $`dfx canister call ${canisterIds.mcp_registry} set_orchestrator_canister_id '(principal "${canisterIds.mcp_orchestrator}")'`;

  console.log('  - Setting Search Index canister...');
  await $`dfx canister call ${canisterIds.mcp_registry} set_search_index_canister_id '(principal "${canisterIds.search_index}")'`;

  console.log('  - Setting Usage Tracker canister...');
  await $`dfx canister call ${canisterIds.mcp_registry} set_usage_tracker_canister_id '(principal "${canisterIds.usage_tracker}")'`;

  console.log('  - Setting Bounty Reward Token canister (USDC)...');
  await $`dfx canister call ${canisterIds.mcp_registry} set_bounty_reward_token_canister_id '(principal "${canisterIds.usdc_ledger}")'`;

  console.log(
    '  - Setting Bounty Reward Amount ($0.25 USDC = 250,000 units)...',
  );
  await $`dfx canister call ${canisterIds.mcp_registry} set_bounty_reward_amount '(250_000:nat)'`;

  console.log(chalk.green('✅ Registry configured.'));
  console.log('');

  // 7. Configure the Orchestrator canister
  console.log(chalk.bold('🎭 Configuring Orchestrator Canister...'));
  console.log('  - Setting Registry canister...');
  await $`dfx canister call ${canisterIds.mcp_orchestrator} set_mcp_registry_id '(principal "${canisterIds.mcp_registry}")'`;
  console.log(chalk.green('✅ Orchestrator configured.'));
  console.log('');

  // 8. Configure the Usage Tracker canister
  console.log(chalk.bold('📈 Configuring Usage Tracker Canister...'));
  await $`dfx canister call ${canisterIds.usage_tracker} set_owner '(principal "${canisterIds.mcp_registry}")'`;
  console.log(chalk.green('✅ Usage Tracker configured.'));
  console.log('');

  console.log(
    chalk.bold.green(
      '🎉 Bootstrap complete! All canisters are configured and wired up.',
    ),
  );
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ An error occurred during bootstrap:'), err);
  process.exit(1);
});
