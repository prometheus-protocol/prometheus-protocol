import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  fileAttestation,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';
import { execSync } from 'node:child_process';

export function registerAttestSubmitCommand(program: Command) {
  program
    .command('attest:submit')
    .description('Submits a completed attestation YAML file.')
    .requiredOption(
      '--file <path>',
      'The path to the completed attestation YAML file.',
    )
    .action(async (options) => {
      const filePath = path.resolve(process.cwd(), options.file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        return;
      }

      console.log(`\n🛡️ Submitting attestation from ${options.file}...`);

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

        const identityName = execSync('dfx identity whoami').toString().trim();
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
