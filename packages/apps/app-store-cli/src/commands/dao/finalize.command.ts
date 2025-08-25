import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  finalizeVerification,
  Registry,
  serializeToIcrc16Map,
} from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerFinalizeCommand(program: Command) {
  program
    // 1. Use a required positional argument for the file path.
    .command('finalize <file>')
    .description('Submits a completed DAO decision ballot.')
    // 2. The action now receives the file path directly.
    .action(async (file) => {
      console.log(`\n🗳️ Submitting DAO ballot from ${file}...`);
      try {
        const filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ Error: File not found at ${filePath}`);
          return;
        }

        const ballot = yaml.load(fs.readFileSync(filePath, 'utf-8')) as any;
        if (!ballot.wasm_id || !ballot.outcome || !ballot.metadata) {
          console.error(
            '❌ Error: Ballot is malformed. It must contain `wasm_id`, `outcome`, and `metadata` keys.',
          );
          return;
        }

        let outcome: Registry.VerificationOutcome;
        // A small improvement: use .toLowerCase() for more robust input checking.
        if (ballot.outcome.toLowerCase() === 'verified') {
          outcome = { Verified: null };
        } else if (ballot.outcome.toLowerCase() === 'rejected') {
          outcome = { Rejected: null };
        } else {
          console.error(
            "❌ Error: Invalid 'outcome' in ballot. Must be 'Verified' or 'Rejected'.",
          );
          return;
        }

        const onChainMetadata = serializeToIcrc16Map(ballot.metadata);

        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        console.log('   📞 Submitting final decision to the registry...');
        await finalizeVerification(identity, {
          wasm_id: ballot.wasm_id,
          outcome: outcome,
          metadata: onChainMetadata,
        });

        console.log(
          '\n🎉 Success! The verification status has been finalized on-chain.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
