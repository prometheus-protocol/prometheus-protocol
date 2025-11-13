#!/usr/bin/env zx
import { $, chalk, argv } from 'zx';

// ==================================================================================================
// Top Up Verifiers Script
//
// This script tops up all dev verifier accounts with additional USDC and deposits it to audit hub.
// For each identity, it will:
// 1. Transfer USDC from owner to verifier wallet
// 2. Approve audit_hub to spend the USDC
// 3. Deposit the USDC as available balance in audit hub
//
// Usage:
//   pnpm topup:verifiers                    # Local network, default 10 USDC each
//   pnpm topup:verifiers --amount 20        # Local network, 20 USDC each
//   pnpm topup:verifiers --network ic       # Production network, default 10 USDC each
//   pnpm topup:verifiers --network ic --amount 50  # Production, 50 USDC each
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

// Default to 10 USDC per node, can be overridden via --amount flag
const TOPUP_AMOUNT_USDC = argv.amount || 10;
const TOPUP_AMOUNT = TOPUP_AMOUNT_USDC * 1_000_000; // Convert to smallest unit (6 decimals)

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

  // Suppress mainnet plaintext identity warning for IC network
  if (NETWORK === 'ic') {
    process.env.DFX_WARNING = '-mainnet_plaintext_identity';
  }

  console.log(chalk.bold.cyan('💰 Topping up verifier accounts...'));
  console.log(chalk.dim(`Network: ${NETWORK}`));
  console.log(chalk.dim(`Amount per node: ${TOPUP_AMOUNT_USDC} USDC`));
  console.log('');

  // Save current identity to restore later
  const originalIdentity = await getCurrentIdentity();
  console.log(chalk.dim(`Current identity: ${originalIdentity}`));
  console.log('');

  // Get canister IDs
  console.log(chalk.bold('🔍 Fetching canister IDs...'));
  const audit_hub = (
    await $`dfx canister id audit_hub --network ${NETWORK}`
  ).stdout.trim();
  const usdc_ledger = (
    await $`dfx canister id usdc_ledger --network ${NETWORK}`
  ).stdout.trim();
  console.log(chalk.green(`✅ audit_hub: ${audit_hub}`));
  console.log(chalk.green(`✅ usdc_ledger: ${usdc_ledger}`));
  console.log('');

  let successCount = 0;
  let failCount = 0;

  // Process each dev identity
  for (const identity of DEV_IDENTITIES) {
    console.log(chalk.bold.yellow(`\n▶️  Processing identity: ${identity}`));
    console.log('─'.repeat(60));

    try {
      // Get the verifier's principal
      await $`dfx identity use ${identity} 2>/dev/null`;
      const principal = await getPrincipal(identity);
      console.log(chalk.dim(`   Principal: ${principal}`));

      // 1. Transfer USDC (from owner identity)
      console.log(
        chalk.cyan(`   1️⃣  Transferring ${TOPUP_AMOUNT_USDC} USDC...`),
      );
      await $`dfx identity use ${originalIdentity} 2>/dev/null`;
      const transferArgs = `(record { to = record { owner = principal \"${principal}\"; subaccount = null }; amount = ${TOPUP_AMOUNT}:nat })`;
      await $`dfx canister call ${usdc_ledger} icrc1_transfer ${transferArgs} --network ${NETWORK}`;
      console.log(chalk.green('   ✅ USDC transferred to wallet'));

      // Switch back to the verifier identity
      await $`dfx identity use ${identity} 2>/dev/null`;

      // 2. Approve the audit_hub to spend tokens (amount + fee for transfer_from)
      console.log(chalk.cyan(`   2️⃣  Approving audit_hub to spend USDC...`));
      const FEE = 10_000; // USDC fee is 0.01 USDC
      const approvalArgs = `(record { spender = record { owner = principal \"${audit_hub}\"; subaccount = null }; amount = ${TOPUP_AMOUNT + FEE}:nat })`;
      await $`dfx canister call ${usdc_ledger} icrc2_approve ${approvalArgs} --network ${NETWORK}`;
      console.log(chalk.green('   ✅ Approval granted'));

      // 3. Deposit to audit hub
      console.log(chalk.cyan('   3️⃣  Depositing to audit hub...'));
      const depositArgs = `(\"${usdc_ledger}\", ${TOPUP_AMOUNT}:nat)`;
      const depositResult =
        await $`dfx canister call ${audit_hub} deposit_stake ${depositArgs} --network ${NETWORK}`;

      // Check if deposit was successful
      if (depositResult.stdout.includes('err')) {
        throw new Error(`Deposit failed: ${depositResult.stdout}`);
      }

      console.log(
        chalk.green(
          `   ✅ Deposited ${TOPUP_AMOUNT_USDC} USDC to available balance`,
        ),
      );

      // 4. Verify new balance
      console.log(chalk.cyan('   4️⃣  Verifying new balance...'));
      const balanceArgs = `(principal \"${principal}\", \"tools_v1\")`;
      const balanceResult =
        await $`dfx canister call ${audit_hub} get_available_balance_by_audit_type ${balanceArgs} --network ${NETWORK}`;
      // Parse the balance from output like "(1_000_000 : nat)"
      const availableMatch = balanceResult.stdout.match(/\(?([\d_]+)/);
      const available = availableMatch
        ? availableMatch[1].replace(/_/g, '')
        : '0';
      console.log(
        chalk.green(
          `   ✅ New available balance: ${Number(available) / 1_000_000} USDC`,
        ),
      );

      console.log(chalk.bold.green(`\n✅ ${identity} topped up successfully!`));
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        chalk.red.bold(`\n❌ Error processing ${identity}:`),
        message,
      );
      console.log(chalk.yellow('Continuing with next identity...'));
      failCount++;
    }
  }

  // Restore original identity
  console.log('');
  console.log(chalk.bold('🔄 Restoring original identity...'));
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;
  console.log(chalk.green(`✅ Restored to: ${originalIdentity}`));
  console.log('');

  // Summary
  console.log(chalk.bold.cyan('📊 Top-up Summary:'));
  console.log(
    chalk.green(`  ✅ Successful: ${successCount}/${DEV_IDENTITIES.length}`),
  );
  if (failCount > 0) {
    console.log(
      chalk.red(`  ❌ Failed: ${failCount}/${DEV_IDENTITIES.length}`),
    );
  }
  console.log(
    chalk.cyan(
      `  💰 Total distributed: ${successCount * TOPUP_AMOUNT_USDC} USDC`,
    ),
  );
  console.log('');

  if (successCount === DEV_IDENTITIES.length) {
    console.log(chalk.bold.green('🎉 All verifiers topped up successfully!'));
  } else {
    console.log(
      chalk.bold.yellow(
        '⚠️  Some verifiers failed to top up. Check errors above.',
      ),
    );
  }
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error during top-up:'), err);
  process.exit(1);
});
