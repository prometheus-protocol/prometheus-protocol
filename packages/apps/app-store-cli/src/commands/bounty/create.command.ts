import type { Command } from 'commander';
import prompts from 'prompts';
import {
  createBounty,
  approveAllowance,
  getCanisterId,
  Tokens, // 1. Import the entire Tokens module
} from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerCreateBountyCommand(program: Command) {
  program
    // 2. Command now accepts a human-readable token symbol
    .command('create <amount> <token-symbol>')
    .description('Creates a new tokenized bounty for a specific WASM hash.')
    .requiredOption(
      '--wasm-id <string>',
      'The hex-encoded SHA-256 hash of the WASM to create a bounty for.',
    )
    .requiredOption(
      '--audit-type <string>',
      'The specific audit being requested (e.g., "data_safety_v1").',
    )
    .option(
      '--timeout-days <number>',
      'The number of days until the bounty expires.',
      '30',
    )
    .action(async (amountStr, tokenSymbol, options) => {
      console.log('\n💰 Creating new tokenized bounty...');

      try {
        // 3. Dynamic Token Lookup and Validation
        const symbolUpper = tokenSymbol.toUpperCase();
        const token = Object.values(Tokens).find(
          (t) => t.symbol.toUpperCase() === symbolUpper,
        );

        if (!token) {
          const availableSymbols = Object.values(Tokens)
            .map((t) => t.symbol)
            .join(', ');
          console.error(
            `❌ Error: Invalid token symbol "${tokenSymbol}". Available symbols are: ${availableSymbols}`,
          );
          return;
        }

        // 4. Validate WASM ID format
        if (!/^[a-fA-F0-9]{64}$/.test(options.wasmId)) {
          console.error(
            '❌ Error: --wasm-id must be a 64-character hex string (SHA-256 hash).',
          );
          return;
        }

        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        const registryCanisterId = Principal.fromText(
          getCanisterId('MCP_REGISTRY'),
        );

        // 5. Use the token's own method for safe, decimal-aware conversion
        const sanitizedAmount = amountStr.replaceAll('_', '');
        const amountAsBigInt = token.toAtomic(sanitizedAmount);

        // --- Step 1: Confirm the entire operation with the user ---
        console.log('\n--- Review Bounty Details ---');
        console.log(`   Amount: ${sanitizedAmount} ${token.symbol}`);
        console.log(`   Token Canister: ${token.canisterId.toText()}`);
        console.log(`   Audit Type: ${options.auditType}`);
        console.log(`   For WASM ID: ${options.wasmId}`);
        console.log(
          `\nThis will perform two transactions:\n  1. Approve the registry to spend your tokens.\n  2. Create the bounty, transferring the tokens into escrow.`,
        );

        const { confirmed } = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: 'Do you want to proceed?',
          initial: false,
        });

        if (!confirmed) {
          console.log('\nBounty creation cancelled.');
          return;
        }

        // --- Step 2: Perform the two-step transaction ---
        console.log(
          `\n▶️ Step 1/2: Approving registry canister to spend ${sanitizedAmount} ${token.symbol}...`,
        );
        // 6. Use the updated, cleaner API signature for approveAllowance
        await approveAllowance(
          identity,
          token,
          registryCanisterId,
          sanitizedAmount,
        );
        console.log('   ✅ Approval successful.');

        console.log('\n▶️ Step 2/2: Creating bounty on the registry...');
        const timeoutDays = parseInt(options.timeoutDays, 10);
        const timeoutDate =
          BigInt(Date.now()) * 1_000_000n +
          BigInt(timeoutDays) * 24n * 60n * 60n * 1_000_000_000n;

        // 7. Use the updated, cleaner API signature for createBounty
        const bountyId = await createBounty(identity, {
          wasm_id: options.wasmId, // Pass the hex string directly
          audit_type: options.auditType,
          amount: amountAsBigInt,
          token: token, // Pass the entire token object
          timeout_date: timeoutDate,
          validation_canister_id: registryCanisterId,
        });
        console.log('   ✅ Bounty created.');

        console.log('\n🎉 Success!');
        console.log(`   Bounty with ID ${bountyId} is now active.`);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
