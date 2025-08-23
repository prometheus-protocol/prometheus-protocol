import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import {
  claimBounty,
  getCurrentIdentityName,
  loadDfxIdentity,
} from '@prometheus-protocol/ic-js';

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

export function registerClaimBountyCommand(program: Command) {
  program
    .command('claim-bounty')
    .description(
      'Claims a bounty for the WASM in prometheus.yml using your current identity.',
    )
    .requiredOption(
      '--bounty-id <number>',
      'The ID of the bounty you wish to claim.',
    )
    .action(async (options) => {
      console.log('💰 Claiming bounty...');
      try {
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error(
            '❌ Error: `prometheus.yml` not found. Please run this in the project directory.',
          );
          return;
        }

        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;

        if (!manifest.submission?.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. `wasm_path` is missing.',
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

        // The wasm_id is the lowercase hex string of the hash
        const wasmId = Buffer.from(wasmHash).toString('hex');
        console.log(`   For WASM ID: ${wasmId}`);

        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);
        console.log(`   As Auditor: ${identity.getPrincipal().toText()}`);

        const bountyId = BigInt(options.bountyId);
        console.log(`   For Bounty ID: ${bountyId}`);

        console.log('\n   📞 Submitting claim to the registry...');
        const claimId = await claimBounty(identity, {
          bounty_id: bountyId,
          wasm_id: wasmId,
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
