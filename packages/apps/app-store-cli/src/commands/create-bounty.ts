import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import prompts from 'prompts';
import {
  createBounty,
  approveAllowance,
  loadDfxIdentity,
  getCurrentIdentityName, // Import the approval function
} from '@prometheus-protocol/ic-js';
import { Principal } from '@dfinity/principal';

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

export function registerCreateBountyCommand(program: Command) {
  program
    .command('create-bounty')
    .description(
      'Creates a new tokenized bounty for the WASM in prometheus.yml.',
    )
    .requiredOption(
      '--amount <number>',
      'The bounty amount in the smallest unit of the token (e.g., 100_000_000 for 1 token with 8 decimals).',
    )
    .requiredOption(
      '--token-canister <principal>',
      'The canister ID of the ICRC-1 token to be used for the reward.',
    )
    .requiredOption(
      '--audit-type <string>',
      'The specific audit being requested (e.g., "security", "tools").',
    )
    .option(
      '--timeout-days <number>',
      'The number of days until the bounty expires.',
      '30',
    )
    .action(async (options) => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run `prom-cli init` first.',
        );
        return;
      }

      console.log('\n💰 Creating new tokenized bounty from manifest...');

      try {
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        if (!manifest.submission || !manifest.submission.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. Please ensure `wasm_path` is set.',
          );
          return;
        }

        const wasmPath = path.resolve(
          process.cwd(),
          manifest.submission.wasm_path,
        );
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest();
        console.log(
          `   For WASM Hash: ${Buffer.from(wasmHash).toString('hex')}`,
        );

        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        const registryCanisterIdStr = process.env.REGISTRY_CANISTER_ID;
        if (!registryCanisterIdStr) {
          console.error(
            '❌ Configuration Error: The REGISTRY_CANISTER_ID environment variable is not set.',
          );
          console.error(
            '   Set the environment variable like this: \`export REGISTRY_CANISTER_ID=ufxgi-4p777-77774-qaadq-cai\`',
          );
          return;
        }
        const registryCanisterId = Principal.fromText(registryCanisterIdStr);
        const tokenCanisterPrincipal = Principal.fromText(
          options.tokenCanister,
        );

        // --- The Fix: Sanitize the amount string before converting to BigInt ---
        // The user might input "100_000_000" for readability, which is not a valid
        // string for the BigInt() constructor. We must remove the underscores first.
        const sanitizedAmount = options.amount.replaceAll('_', '');

        // 1. A 'number' for the approveAllowance function, which expects it.
        const amountAsNumber = Number(sanitizedAmount);
        // 2. A 'BigInt' for the createBounty function, which needs it for the canister call.
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
          '   Auditors can see this bounty by running `prom-cli status` and claim it by filing the required attestation.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
