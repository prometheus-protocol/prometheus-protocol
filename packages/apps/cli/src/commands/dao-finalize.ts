import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { finalizeVerification } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity, serializeToIcrc16Map } from '../utils.js';
import { execSync } from 'node:child_process';
import { VerificationOutcome } from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';

export function registerDaoFinalizeCommand(program: Command) {
  program
    .command('dao:finalize')
    .description('Submits a completed DAO decision ballot.')
    .requiredOption(
      '--file <path>',
      'The path to the completed decision ballot YAML file.',
    )
    .action(async (options) => {
      console.log('🗳️ Finalizing DAO verification...');
      try {
        const filePath = path.resolve(process.cwd(), options.file);
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

        let outcome: VerificationOutcome;
        if (ballot.outcome === 'Verified') {
          outcome = { Verified: null };
        } else if (ballot.outcome === 'Rejected') {
          outcome = { Rejected: null };
        } else {
          console.error(
            "❌ Error: Invalid 'outcome' in ballot. Must be 'Verified' or 'Rejected'.",
          );
          return;
        }

        const onChainMetadata = serializeToIcrc16Map(ballot.metadata);

        const identityName = execSync('dfx identity whoami').toString().trim();
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
