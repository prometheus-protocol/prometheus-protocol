#!/usr/bin/env zx
import { $, chalk } from 'zx';

// ==================================================================================================
// Local Development Setup Script
//
// This script performs LOCAL DEVELOPMENT ONLY operations after deploying canisters:
// - Sets stake requirements for audit types
// - Transfers test USDC to test auditor
// - Funds MCP Registry for sponsoring build bounties
// - Fabricates cycles for the orchestrator
//
// For canister linking/configuration, use: pnpm config:inject
// For verifier registration, use: pnpm exec tsx scripts/register-dev-verifiers.ts
//
// Usage:
//   pnpm setup:local
//
// ==================================================================================================

// --- CONFIGURATION ---
const AUDITOR_PRINCIPAL =
  'zxuwv-zt33i-dtske-3tzt5-iw3b4-mjuif-jc4vr-hz2vk-ky2v4-kyrkv-pqe';

const STAKE_AMOUNT = 300_000; // 0.30 USDC (USDC has 6 decimals, so 300,000 = 0.30 USDC)
const USDC_TRANSFER_AMOUNT = 100_000_000; // Enough for multiple stakes
const REGISTRY_USDC_AMOUNT = 1_000_000_000; // 1,000 USDC for sponsoring build bounties
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
  const mcp_registry = (await $`dfx canister id mcp_registry`).stdout.trim();
  const mcp_orchestrator = (
    await $`dfx canister id mcp_orchestrator`
  ).stdout.trim();
  console.log(chalk.green('✅ Canister IDs fetched.'));
  console.log('');

  // Configure stake requirements (using USDC ledger as token_id, must use pp_owner identity)
  console.log(chalk.bold('💰 Setting stake requirements...'));

  // Step 1: Register audit types to use USDC ledger
  console.log(`  - Registering audit types to use USDC ledger...`);
  await $`dfx identity use pp_owner 2>/dev/null`;
  for (const auditType of AUDIT_TYPES) {
    console.log(`    • ${auditType}`);
    await $`dfx canister call ${audit_hub} register_audit_type '("${auditType}", "${usdc_ledger}")'`;
  }

  // Step 2: Set stake requirement for USDC ledger
  console.log(
    `  - Setting stake requirement for USDC ledger to ${STAKE_AMOUNT}...`,
  );
  await $`dfx canister call ${audit_hub} set_stake_requirement '("${usdc_ledger}", ${STAKE_AMOUNT}:nat)'`;
  await $`dfx identity use pp_owner 2>/dev/null`;
  console.log(chalk.green('✅ Stake requirements set.'));
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

  // Fund MCP Registry for build bounties
  console.log(
    chalk.yellow(
      `💸 Transferring ${REGISTRY_USDC_AMOUNT} USDC units to MCP Registry for build bounties...`,
    ),
  );
  const registryTransferArgs = `(record { to = record { owner = principal \"${mcp_registry}\"; subaccount = null }; amount = ${REGISTRY_USDC_AMOUNT}:nat })`;
  await $`dfx canister call ${usdc_ledger} icrc1_transfer ${registryTransferArgs}`;
  console.log(chalk.green('✅ MCP Registry funded.'));
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
