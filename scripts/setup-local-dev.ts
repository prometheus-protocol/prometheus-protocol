#!/usr/bin/env zx
import { $, chalk } from 'zx';

// ==================================================================================================
// Local Development Setup Script
//
// This script performs LOCAL DEVELOPMENT ONLY operations after deploying canisters:
// - Sets stake requirements for audit types
// - Transfers test USDC to test auditor
// - Configures and funds bounty_sponsor canister
// - Configures registry to use bounty_sponsor
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
const BOUNTY_SPONSOR_USDC_AMOUNT = 10_000_000_000; // 10,000 USDC for sponsoring bounties
const ORCHESTRATOR_CYCLES_IN_TRILLIONS = 100; // 100T cycles

const AUDIT_TYPES = ['build_reproducibility_v1', 'tools_v1'];

// Bounty reward amounts per audit type (in USDC micros - 6 decimals)
const BOUNTY_REWARDS: Record<string, number> = {
  build_reproducibility_v1: 250_000, // 0.25 USDC
  tools_v1: 100_000, // 0.10 USDC (fast audit)
};

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

  const bounty_sponsor = (
    await $`dfx canister id bounty_sponsor`
  ).stdout.trim();
  const mcp_orchestrator = (
    await $`dfx canister id mcp_orchestrator`
  ).stdout.trim();
  console.log(chalk.green('✅ Canister IDs fetched.'));
  console.log('');

  // Configure stake requirements (using USDC ledger as token_id, must use pp_owner identity)
  console.log(chalk.bold('💰 Setting stake requirements...'));

  // Set stake requirement for each audit type (audit_type, token_id, amount)
  console.log(`  - Setting stake requirements for audit types...`);
  await $`dfx identity use pp_owner 2>/dev/null`;
  for (const auditType of AUDIT_TYPES) {
    console.log(`    • ${auditType}: ${STAKE_AMOUNT} (token: ${usdc_ledger})`);
    await $`dfx canister call ${audit_hub} set_stake_requirement '("${auditType}", "${usdc_ledger}", ${STAKE_AMOUNT}:nat)'`;
  }
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

  // Configure bounty_sponsor canister
  console.log(chalk.bold('🎯 Configuring bounty_sponsor canister...'));
  await $`dfx identity use pp_owner 2>/dev/null`;

  console.log(`  - Setting reward amounts for audit types...`);
  for (const auditType of AUDIT_TYPES) {
    const rewardAmount = BOUNTY_REWARDS[auditType];
    console.log(`    • ${auditType}: ${rewardAmount / 1_000_000} USDC`);
    await $`dfx canister call ${bounty_sponsor} set_reward_amount_for_audit_type '("${auditType}", ${rewardAmount}:nat)'`;
  }

  console.log(chalk.green('✅ Bounty sponsor configured.'));
  console.log('');

  // Fund bounty_sponsor with USDC
  console.log(
    chalk.yellow(
      `💸 Transferring ${BOUNTY_SPONSOR_USDC_AMOUNT} USDC units to bounty_sponsor...`,
    ),
  );
  const sponsorTransferArgs = `(record { to = record { owner = principal \"${bounty_sponsor}\"; subaccount = null }; amount = ${BOUNTY_SPONSOR_USDC_AMOUNT}:nat })`;
  await $`dfx canister call ${usdc_ledger} icrc1_transfer ${sponsorTransferArgs}`;
  console.log(chalk.green('✅ Bounty sponsor funded.'));
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
