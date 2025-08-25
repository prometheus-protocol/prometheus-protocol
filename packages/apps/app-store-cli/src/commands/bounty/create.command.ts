import type { Command } from 'commander';
import prompts from 'prompts';
import {
  createBounty,
  approveAllowance,
  getCanisterId,
} from '@prometheus-protocol/ic-js';
import { Principal } from '@dfinity/principal';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerCreateBountyCommand(program: Command) {
  program
    .command('create <amount> <token-canister>')
    .description('Creates a new tokenized bounty for a specific WASM hash.')
    // 1. The WASM ID is now a required option, making the command self-contained.
    .requiredOption(
      '--wasm-id <string>',
      'The hex-encoded SHA-256 hash of the WASM to create a bounty for.',
    )
    .requiredOption(
      '--audit-type <string>',
      'The specific audit being requested (e.g., "security_v1").',
    )
    .option(
      '--timeout-days <number>',
      'The number of days until the bounty expires.',
      '30',
    )
    .action(async (amount, tokenCanister, options) => {
      console.log('\n💰 Creating new tokenized bounty...');

      try {
        // 2. Convert the user-provided hex string into a Buffer for the canister call.
        const wasmId = options.wasmId;
        // Add validation for the hash format for better UX.
        if (!/^[a-fA-F0-9]{64}$/.test(wasmId)) {
          console.error(
            '❌ Error: --wasm-id must be a 64-character hex string (SHA-256 hash).',
          );
          return;
        }
        const wasmHash = Buffer.from(wasmId, 'hex');
        console.log(`   For WASM ID: ${wasmId}`);

        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        const registryCanisterIdStr = getCanisterId('MCP_REGISTRY');
        const registryCanisterId = Principal.fromText(registryCanisterIdStr);
        const tokenCanisterPrincipal = Principal.fromText(tokenCanister);

        const sanitizedAmount = amount.replaceAll('_', '');
        const amountAsNumber = Number(sanitizedAmount);
        const amountAsBigInt = BigInt(sanitizedAmount);

        // --- Step 1: Confirm the entire operation with the user ---
        console.log('\n--- Review Bounty Details ---');
        console.log(`   Amount: ${amountAsNumber.toLocaleString()} tokens`);
        console.log(`   Token Canister: ${tokenCanisterPrincipal.toText()}`);
        console.log(`   Audit Type: ${options.auditType}`);
        console.log(
          `\nThis will perform two transactions:\n  1. Approve the registry to spend your tokens.\n  2. Create the bounty, transferring the tokens into escrow.`,
        );
        console.log(
          `(Ensure your account has a small amount extra for transaction fees.)`,
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
          `\n▶️ Step 1/2: Approving registry canister (${registryCanisterId.toText()}) to spend tokens...`,
        );
        await approveAllowance(
          identity,
          amountAsNumber,
          registryCanisterId,
          tokenCanisterPrincipal,
        );
        console.log('   ✅ Approval successful.');

        console.log('\n▶️ Step 2/2: Creating bounty on the registry...');
        const timeoutDays = parseInt(options.timeoutDays, 10);
        const timeoutDate =
          BigInt(Date.now()) * 1_000_000n +
          BigInt(timeoutDays) * 24n * 60n * 60n * 1_000_000_000n;

        // 3. The ic-js call now uses the wasmHash derived from the --wasm-id option.
        const bountyId = await createBounty(identity, {
          wasm_hash: wasmHash,
          audit_type: options.auditType,
          amount: amountAsBigInt,
          token_canister_id: tokenCanisterPrincipal,
          timeout_date: timeoutDate,
          validation_canister_id: registryCanisterId,
        });
        console.log('   ✅ Bounty created.');

        console.log('\n🎉 Success!');
        console.log(`   Bounty with ID ${bountyId} is now active.`);
        console.log(
          '   Auditors can now discover this bounty by running `app-store bounty list`.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
