#!/usr/bin/env zx
import { $, chalk, argv } from 'zx';

// ==================================================================================================
// Register Dev Verifiers Script
//
// This script registers dev verifier accounts using dfx identities (node-1, node-2, etc).
// For each identity, it will:
// 1. Generate an API key
// 2. Transfer USDC for staking
// 3. Deposit stake for specified audit types
//
// Usage:
//   pnpm register:dev-verifiers              # Local network
//   pnpm register:dev-verifiers --network ic # Production network
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

const USDC_TRANSFER_AMOUNT = 100_000_000; // 100 USDC (assuming 6 decimals)
const STAKE_AMOUNT_PER_TYPE = 10_000_000; // 10 USDC per audit type

const AUDIT_TYPES = [
  'build_reproducibility_v1',
  'app_info_v1',
  'tools_v1',
  'data_security_v1',
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

  console.log(chalk.bold.cyan('🔑 Registering dev verifier accounts...'));
  console.log(chalk.dim(`Network: ${NETWORK}`));
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

  // Process each dev identity
  for (const identity of DEV_IDENTITIES) {
    console.log(chalk.bold.yellow(`\n▶️  Processing identity: ${identity}`));
    console.log('─'.repeat(60));

    try {
      // Switch to this identity
      await $`dfx identity use ${identity} 2>/dev/null`;
      const principal = await getPrincipal(identity);
      console.log(chalk.dim(`   Principal: ${principal}`));

      // 1. Generate API key
      console.log(chalk.cyan('   1️⃣  Generating API key...'));
      const apiKeyResult =
        await $`dfx canister call audit_hub generate_api_key --network ${NETWORK}`;
      const apiKeyMatch = apiKeyResult.stdout.match(/"([^"]+)"/);
      const apiKey = apiKeyMatch ? apiKeyMatch[1] : 'unknown';
      console.log(
        chalk.green(`   ✅ API key generated: `) + chalk.cyan(apiKey),
      );

      // 2. Transfer USDC (from default/owner identity)
      console.log(
        chalk.cyan(
          `   2️⃣  Transferring ${USDC_TRANSFER_AMOUNT / 1_000_000} USDC...`,
        ),
      );
      await $`dfx identity use ${originalIdentity} 2>/dev/null`;
      const transferArgs = `(record { to = record { owner = principal \"${principal}\"; subaccount = null }; amount = ${USDC_TRANSFER_AMOUNT}:nat })`;
      await $`dfx canister call ${usdc_ledger} icrc1_transfer ${transferArgs} --network ${NETWORK}`;
      console.log(chalk.green('   ✅ USDC transferred'));

      // Switch back to the verifier identity for staking
      await $`dfx identity use ${identity} 2>/dev/null`;

      // 3. Approve the audit_hub to spend tokens
      console.log(chalk.cyan(`   3️⃣  Approving audit_hub to spend USDC...`));
      const approvalArgs = `(record { spender = record { owner = principal \"${audit_hub}\"; subaccount = null }; amount = ${USDC_TRANSFER_AMOUNT}:nat })`;
      await $`dfx canister call ${usdc_ledger} icrc2_approve ${approvalArgs} --network ${NETWORK}`;
      console.log(chalk.green('   ✅ Approval granted'));

      // 4. Deposit stakes for each audit type
      console.log(chalk.cyan('   4️⃣  Depositing stakes...'));
      for (const auditType of AUDIT_TYPES) {
        console.log(
          chalk.dim(
            `      - Staking ${STAKE_AMOUNT_PER_TYPE / 1_000_000} USDC for '${auditType}'...`,
          ),
        );
        const stakeArgs = `(\"${usdc_ledger}\", ${STAKE_AMOUNT_PER_TYPE}:nat)`;
        await $`dfx canister call ${audit_hub} deposit_stake ${stakeArgs} --network ${NETWORK}`;
      }
      console.log(chalk.green(`   ✅ Stakes deposited for all audit types`));

      // 5. Verify profile
      console.log(chalk.cyan('   5️⃣  Verifying profile...'));
      const profileArgs = `(principal \"${principal}\", \"${usdc_ledger}\")`;
      const profile =
        await $`dfx canister call ${audit_hub} get_verifier_profile ${profileArgs} --network ${NETWORK}`;
      const availableMatch = profile.stdout.match(
        /available_balance_usdc = ([\d_]+)/,
      );
      const available = availableMatch
        ? availableMatch[1].replace(/_/g, '')
        : '0';
      console.log(
        chalk.green(
          `   ✅ Available balance: ${Number(available) / 1_000_000} USDC`,
        ),
      );

      console.log(
        chalk.bold.green(`\n✅ ${identity} registered successfully!`),
      );
    } catch (error) {
      console.error(
        chalk.red.bold(`\n❌ Error processing ${identity}:`),
        error,
      );
      console.log(chalk.yellow('Continuing with next identity...'));
    }
  }

  // Restore original identity
  console.log('');
  console.log(chalk.bold('🔄 Restoring original identity...'));
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;
  console.log(chalk.green(`✅ Restored to: ${originalIdentity}`));
  console.log('');

  console.log(chalk.bold.green('🎉 Dev verifier registration complete!'));
  console.log('');
  console.log(chalk.cyan('Registered verifiers:'));
  for (const identity of DEV_IDENTITIES) {
    await $`dfx identity use ${identity} 2>/dev/null`;
    const principal = (await $`dfx identity get-principal`).stdout.trim();
    console.log(chalk.cyan(`  - ${identity}: ${principal}`));
  }
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;
  console.log('');
  console.log(chalk.cyan('Next steps:'));
  console.log(
    chalk.cyan('  1. List API keys: dfx canister call audit_hub list_api_keys'),
  );
  console.log(
    chalk.cyan(
      '  2. Check balances: dfx canister call audit_hub get_verifier_profile',
    ),
  );
  console.log(chalk.cyan('  3. Create bounties: pnpm seed:bounties'));
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error during verifier registration:'), err);
  process.exit(1);
});
