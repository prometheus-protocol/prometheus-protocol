#!/usr/bin/env zx
import { $, chalk, argv } from 'zx';

// ==================================================================================================
// Check Verifier Balances Script
//
// This script checks USDC and audit hub balances for all dev verifier accounts.
// For each identity (node-1 through node-9), it will display:
// 1. USDC wallet balance
// 2. Audit hub available balance
// 3. Audit hub staked balance
//
// Usage:
//   pnpm check:verifier-balances                # Local network
//   pnpm check:verifier-balances --network ic   # Production network
//   pnpm check:verifier-balances --network ic --deposit  # Deposit all wallet funds to available
//
// ==================================================================================================

// --- CONFIGURATION ---
const NETWORK = argv.network || process.env.DFX_NETWORK || 'local';
const DEPOSIT_MODE = argv.deposit || false;
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

async function getUsdcBalance(
  ledgerId: string,
  principal: string,
): Promise<number> {
  try {
    const balanceArgs = `(record { owner = principal \"${principal}\"; subaccount = null })`;
    const result =
      await $`dfx canister call ${ledgerId} icrc1_balance_of ${balanceArgs} --network ${NETWORK}`;
    const match = result.stdout.match(/\((\d[_\d]*) : nat\)/);
    return match ? Number(match[1].replace(/_/g, '')) : 0;
  } catch (error) {
    return 0;
  }
}

async function getAuditHubBalances(
  auditHubId: string,
  principal: string,
  ledgerId: string,
): Promise<{ available: number; staked: number }> {
  try {
    // Get available balance for build_reproducibility_v1 audit type
    const availableArgs = `(principal \"${principal}\", \"build_reproducibility_v1\")`;
    const availableResult =
      await $`dfx canister call ${auditHubId} get_available_balance_by_audit_type ${availableArgs} --network ${NETWORK}`;

    const availableMatch = availableResult.stdout.match(/\((\d[_\d]*) : nat\)/);
    const available = availableMatch
      ? Number(availableMatch[1].replace(/_/g, ''))
      : 0;

    // Get staked balance for the token
    const stakedArgs = `(principal \"${principal}\", \"${ledgerId}\")`;
    const stakedResult =
      await $`dfx canister call ${auditHubId} get_staked_balance ${stakedArgs} --network ${NETWORK}`;

    const stakedMatch = stakedResult.stdout.match(/\((\d[_\d]*) : nat\)/);
    const staked = stakedMatch ? Number(stakedMatch[1].replace(/_/g, '')) : 0;

    return {
      available,
      staked,
    };
  } catch (error) {
    return { available: 0, staked: 0 };
  }
}

function formatUsdc(amount: number): string {
  return (amount / 1_000_000).toFixed(6);
}

async function main() {
  $.verbose = false;

  // Suppress mainnet plaintext identity warning for IC network
  if (NETWORK === 'ic') {
    process.env.DFX_WARNING = '-mainnet_plaintext_identity';
  }

  console.log(
    chalk.bold.cyan('💰 Checking verifier balances across all nodes...'),
  );
  console.log(chalk.dim(`Network: ${NETWORK}`));
  console.log('');

  // Save current identity to restore later
  const originalIdentity = await getCurrentIdentity();

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

  // Table header
  console.log(chalk.bold('📊 Balance Summary:'));
  console.log('─'.repeat(94));
  console.log(
    chalk.bold(
      '  Identity    Principal                       Wallet      Available    Staked     Total',
    ),
  );
  console.log('─'.repeat(94));

  const results: Array<{
    identity: string;
    principal: string;
    wallet: number;
    available: number;
    staked: number;
    total: number;
  }> = [];

  // Check each verifier
  for (const identity of DEV_IDENTITIES) {
    try {
      await $`dfx identity use ${identity} 2>/dev/null`;
      const principal = await getPrincipal(identity);

      // Get balances
      const walletBalance = await getUsdcBalance(usdc_ledger, principal);
      const { available, staked } = await getAuditHubBalances(
        audit_hub,
        principal,
        usdc_ledger,
      );
      const total = walletBalance + available + staked;

      results.push({
        identity,
        principal,
        wallet: walletBalance,
        available,
        staked,
        total,
      });

      // Format principal for display (truncate middle)
      const shortPrincipal =
        principal.length > 28
          ? `${principal.slice(0, 20)}...${principal.slice(-5)}`
          : principal;

      // Color code based on balance status
      const statusColor =
        total < 1_000_000
          ? chalk.red
          : total < 5_000_000
            ? chalk.yellow
            : chalk.green;

      console.log(
        statusColor(
          `  ${identity.padEnd(10)}  ${shortPrincipal.padEnd(28)}  ${formatUsdc(walletBalance).padStart(10)}  ${formatUsdc(available).padStart(11)}  ${formatUsdc(staked).padStart(10)}  ${formatUsdc(total).padStart(10)}`,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        chalk.red(
          `  ${identity.padEnd(12)}  Error fetching balances: ${message}`,
        ),
      );
    }
  }

  console.log('─'.repeat(94));
  console.log('');

  // Deposit wallet funds to available if requested
  if (DEPOSIT_MODE) {
    console.log(
      chalk.bold.yellow('💸 Depositing wallet funds to available balance...'),
    );
    console.log('');

    const APPROVAL_FEE = 10_000; // 0.01 USDC
    const TRANSFER_FEE = 10_000; // 0.01 USDC
    const TOTAL_FEES = APPROVAL_FEE + TRANSFER_FEE; // 0.02 USDC total

    for (const result of results) {
      if (result.wallet > TOTAL_FEES) {
        try {
          await $`dfx identity use ${result.identity} 2>/dev/null`;

          // Amount to credit to available balance (after all fees)
          const depositAmount = result.wallet - TOTAL_FEES;

          // Amount available after approval fee
          const amountAfterApprovalFee = result.wallet - APPROVAL_FEE;

          // Approve for amount after approval fee (so transfer_from can pull depositAmount + its fee)
          const approveArgs = `(record { spender = record { owner = principal \"${audit_hub}\"; subaccount = null }; amount = ${amountAfterApprovalFee} : nat })`;
          await $`dfx canister call ${usdc_ledger} icrc2_approve ${approveArgs} --network ${NETWORK}`;

          // Call deposit_stake with the amount we want credited (transfer_from will pull this + fee from wallet)
          const depositArgs = `(\"${usdc_ledger}\", ${depositAmount} : nat)`;
          await $`dfx canister call ${audit_hub} deposit_stake ${depositArgs} --network ${NETWORK}`;

          console.log(
            chalk.green(
              `  ✅ ${result.identity}: Deposited ${formatUsdc(depositAmount)} USDC (${formatUsdc(TOTAL_FEES)} USDC in fees)`,
            ),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(
            chalk.red(
              `  ❌ ${result.identity}: Failed to deposit - ${message}`,
            ),
          );
        }
      } else if (result.wallet > 0) {
        console.log(
          chalk.yellow(
            `  ⚠️  ${result.identity}: Wallet balance ${formatUsdc(result.wallet)} USDC too low (need at least ${formatUsdc(TOTAL_FEES)} USDC for fees)`,
          ),
        );
      }
    }

    console.log('');
    console.log(
      chalk.green(
        '✅ Deposit complete! Run the script again to see updated balances.',
      ),
    );
    await $`dfx identity use ${originalIdentity} 2>/dev/null`;
    return;
  }

  // Summary statistics
  const totalWallet = results.reduce((sum, r) => sum + r.wallet, 0);
  const totalAvailable = results.reduce((sum, r) => sum + r.available, 0);
  const totalStaked = results.reduce((sum, r) => sum + r.staked, 0);
  const grandTotal = totalWallet + totalAvailable + totalStaked;

  console.log(chalk.bold('📈 Total Across All Verifiers:'));
  console.log(chalk.cyan(`  Wallet USDC:   ${formatUsdc(totalWallet)} USDC`));
  console.log(
    chalk.cyan(`  Available:     ${formatUsdc(totalAvailable)} USDC`),
  );
  console.log(chalk.cyan(`  Staked:        ${formatUsdc(totalStaked)} USDC`));
  console.log(
    chalk.bold.cyan(`  Grand Total:   ${formatUsdc(grandTotal)} USDC`),
  );
  console.log('');

  // Identify low balance nodes
  const lowBalanceNodes = results.filter((r) => r.total < 1_000_000);
  if (lowBalanceNodes.length > 0) {
    console.log(chalk.bold.red('⚠️  Low Balance Nodes (< 1 USDC):'));
    for (const node of lowBalanceNodes) {
      console.log(
        chalk.red(`  - ${node.identity}: ${formatUsdc(node.total)} USDC total`),
      );
    }
    console.log('');
  }

  // Restore original identity
  await $`dfx identity use ${originalIdentity} 2>/dev/null`;

  console.log(chalk.green('✅ Balance check complete!'));
}

main().catch((err) => {
  console.error(chalk.red.bold('❌ Error checking balances:'), err);
  process.exit(1);
});
