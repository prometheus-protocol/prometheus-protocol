import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { claimBounty } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

export function registerClaimBountyCommand(program: Command) {
  program
    // 1. Use a required positional argument for bountyId and an optional one for wasmId.
    .command('claim <bountyId> [wasmId]')
    .description(
      'Claims a bounty. Reads WASM ID from prometheus.yml if not provided.',
    )
    .action(async (bountyIdStr, wasmId) => {
      let targetWasmId = wasmId;

      // 2. If wasmId is missing, try to load it from the config file.
      if (!targetWasmId) {
        console.log(
          'ℹ️ WASM ID not provided, attempting to read from prometheus.yml...',
        );
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error(
            '❌ Error: WASM ID not provided and prometheus.yml not found.',
          );
          console.error(
            '   Run this command from the project root or specify the WASM ID manually.',
          );
          return;
        }

        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;
        if (!manifest.submission?.wasm_path) {
          console.error(
            '❌ Error: `wasm_path` is missing from prometheus.yml.',
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
        targetWasmId = Buffer.from(wasmHash).toString('hex');
      }

      console.log('💰 Claiming bounty...');
      try {
        console.log(`   For WASM ID: ${targetWasmId}`);

        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);
        console.log(`   As Auditor: ${identity.getPrincipal().toText()}`);

        const bountyId = BigInt(bountyIdStr);
        console.log(`   For Bounty ID: ${bountyId}`);

        console.log('\n   📞 Submitting claim to the registry...');
        const claimId = await claimBounty(identity, {
          bounty_id: bountyId,
          wasm_id: targetWasmId, // 3. Use the resolved targetWasmId
        });

        console.log('\n🎉 Success!');
        console.log(
          `   Your claim has been submitted with Claim ID: ${claimId}`,
        );
        console.log('   The funds have been transferred to your account.');
        console.log(
          '   Thank you for contributing to the Prometheus Protocol!',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
