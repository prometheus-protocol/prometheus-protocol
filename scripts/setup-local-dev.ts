#!/usr/bin/env zx
import { $, chalk } from 'zx';

// ==================================================================================================
// Local Development Setup Script
//
// This script performs LOCAL DEVELOPMENT ONLY operations after deploying canisters:
// - Mints initial auditor reputation tokens
// - Transfers test USDC to test auditor
// - Fabricates cycles for the orchestrator
//
// For canister linking/configuration, use: pnpm config:inject
//
// Usage:
//   pnpm setup:local
//
// ==================================================================================================

// --- CONFIGURATION ---
const AUDITOR_PRINCIPAL =
  'zxuwv-zt33i-dtske-3tzt5-iw3b4-mjuif-jc4vr-hz2vk-ky2v4-kyrkv-pqe';

const STAKE_AMOUNT = 1; // 1 USDC (adjust based on your token decimals)
const MINT_AMOUNT = 100; // Initial reputation tokens per category
const USDC_TRANSFER_AMOUNT = 100_000_000; // Enough for multiple stakes
const ORCHESTRATOR_CYCLES_IN_TRILLIONS = 100; // 100T cycles

const AUDIT_TYPES = [
  'build_reproducibility_v1',
  'app_info_v1',
  'tools_v1',
  'data_security_v1',
];

// --- MAIN SCRIPT ---

async function main() {
  $.verbose = false;

  console.log(
    chalk.bold.cyan('🚀 Setting up local development environment...'),
  );
  console.log('');

  // Get canister IDs
  console.log(chalk.bold('🔍 Fetching canister IDs...'));
  const audit_hub = (await $`dfx canister id audit_hub`).stdout.trim();
  const usdc_ledger = (await $`dfx canister id usdc_ledger`).stdout.trim();
  const mcp_orchestrator = (
    await $`dfx canister id mcp_orchestrator`
  ).stdout.trim();
  console.log(chalk.green('✅ Canister IDs fetched.'));
  console.log('');

  // Configure stake requirements
  console.log(chalk.bold('💰 Setting stake requirements...'));
  for (const type of AUDIT_TYPES) {
    console.log(
      `  - Setting stake requirement for '${type}' to ${STAKE_AMOUNT}...`,
    );
    await $`dfx canister call ${audit_hub} set_stake_requirement '("${type}", ${STAKE_AMOUNT}:nat)'`;
  }
  console.log(chalk.green('✅ Stake requirements set.'));
  console.log('');

  // Mint initial auditor tokens
  console.log(chalk.bold('🎫 Minting initial auditor tokens...'));
  for (const type of AUDIT_TYPES) {
    console.log(`  - Minting ${MINT_AMOUNT} '${type}' tokens...`);
    await $`dfx canister call ${audit_hub} mint_tokens '(principal "${AUDITOR_PRINCIPAL}", "${type}", ${MINT_AMOUNT}:nat)'`;
  }
  console.log(chalk.green('✅ Auditor tokens minted.'));
  console.log('');

  // Transfer USDC
  console.log(
    chalk.yellow(
      `💸 Transferring ${USDC_TRANSFER_AMOUNT} USDC units to auditor...`,
    ),
  );
  const transferArgs = `(record { to = record { owner = principal \"${AUDITOR_PRINCIPAL}\"; subaccount = null }; amount = ${USDC_TRANSFER_AMOUNT}:nat })`;
  await $`dfx canister call ${usdc_ledger} icrc1_transfer ${transferArgs}`;
  console.log(chalk.green('✅ USDC transfer complete.'));
  console.log('');

  // Fabricate cycles
  console.log(
    chalk.yellow(
      `⚡ Fabricating ${ORCHESTRATOR_CYCLES_IN_TRILLIONS}T cycles for Orchestrator...`,
    ),
  );
  await $`dfx ledger fabricate-cycles --t ${ORCHESTRATOR_CYCLES_IN_TRILLIONS} --canister ${mcp_orchestrator}`;
  console.log(chalk.green('✅ Cycles fabricated.'));
  console.log('');

  console.log(chalk.bold.green('🎉 Local development setup complete!'));
  console.log('');
  console.log(chalk.cyan('Next steps:'));
  console.log(
    chalk.cyan('  1. Verify canister configuration: pnpm config:check'),
  );
  console.log(chalk.cyan('  2. If needed, auto-configure: pnpm config:inject'));
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error during local setup:'), err);
  process.exit(1);
});
