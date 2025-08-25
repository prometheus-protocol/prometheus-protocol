import type { Command } from 'commander';
import { listPendingSubmissions } from '@prometheus-protocol/ic-js';
import {
  loadDfxIdentity,
  getCurrentIdentityName,
} from '../../identity.node.js';

// The function name should match the file's purpose.
export function registerDaoListCommand(program: Command) {
  program
    .command('list')
    .description('Lists all WASM submissions that are ready for DAO review.')
    // 1. Add pagination options for handling large numbers of submissions.
    .option('--limit <number>', 'The number of submissions to fetch', '20')
    .option(
      '--prev <wasm_id>',
      'The WASM ID to start fetching after (for pagination)',
    )
    .action(async (options) => {
      console.log('🔎 Fetching submissions ready for DAO review...');

      try {
        const identity = loadDfxIdentity(getCurrentIdentityName());

        // 2. Call the ic-js library function with the parsed CLI options.
        const submissions = await listPendingSubmissions(identity, {
          take: options.limit ? BigInt(options.limit) : undefined,
          prev: options.prev,
        });

        if (submissions.length === 0) {
          console.log('\n✅ No submissions are currently awaiting review.');
          return;
        }

        // 3. Format the raw data into a human-readable table.
        const formattedSubmissions = submissions.map((sub) => ({
          'WASM ID': sub.wasm_id,
          'Repo URL': sub.repo_url,
          // Convert the commit hash from a byte array to a readable hex string.
          'Commit Hash (hex)': Buffer.from(sub.commit_hash).toString('hex'),
          // Join the array of completed audit types into a single string.
          'Completed Audits': sub.attestation_types.join(', '),
        }));

        console.log('\n📋 Submissions Awaiting Review:');
        console.table(formattedSubmissions);
        console.log(
          '\nUse `app-store dao finalize <wasm_id>` to approve or reject a submission.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
