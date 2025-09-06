import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  fileAttestation,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerSubmitAttestationCommand(program: Command) {
  program
    .command('submit <file>')
    .description(
      'Submits a completed attestation YAML file for a specific bounty.',
    )
    // --- CHANGE 1: Add a required option for the bounty ID ---
    .requiredOption(
      '-b, --bounty-id <id>',
      'The ID of the bounty this attestation is for',
    )
    // --- CHANGE 2: Update the action to receive the options object ---
    .action(async (file, options) => {
      const filePath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        return;
      }

      // --- CHANGE 3: Get the bounty ID from the options ---
      const bountyId = BigInt(options.bountyId);

      console.log(
        `\n🛡️ Submitting attestation from ${file} for bounty #${bountyId}...`,
      );

      try {
        const manifest = yaml.load(fs.readFileSync(filePath, 'utf-8')) as any;

        if (!manifest.wasm_hash || !manifest.metadata) {
          console.error(
            '❌ Error: Manifest is malformed. It must contain `wasm_hash` and `metadata` keys.',
          );
          return;
        }

        const wasmHash = manifest.wasm_hash;
        const onChainMetadata = serializeToIcrc16Map(manifest.metadata);

        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        console.log(
          `   📞 Calling the registry to file attestation for bounty #${bountyId}...`,
        );
        // --- CHANGE 4: Pass the bounty_id to the library function ---
        await fileAttestation(identity, {
          wasm_hash: wasmHash,
          metadata: onChainMetadata,
          bounty_id: bountyId, // The new, required property
        });

        console.log(
          `\n🎉 Success! Your attestation has been filed on-chain for bounty #${bountyId}.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
