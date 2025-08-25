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
    // 1. Use a required positional argument for the file path.
    .command('submit <file>')
    .description('Submits a completed attestation YAML file.')
    // 2. The action now receives the file path directly.
    .action(async (file) => {
      const filePath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        return;
      }

      console.log(`\n🛡️ Submitting attestation from ${file}...`);

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

        console.log('   📞 Calling the registry to file attestation...');
        await fileAttestation(identity, {
          wasm_hash: wasmHash,
          metadata: onChainMetadata,
        });

        console.log('\n🎉 Success! Your attestation has been filed on-chain.');
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
