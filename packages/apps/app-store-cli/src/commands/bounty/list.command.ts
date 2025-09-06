// packages/cli/src/commands/bounty/list.command.ts

import type { Command } from 'commander';
import { Principal } from '@dfinity/principal';
// --- CHANGE 1: Import the new getBountyLock function ---
import {
  listBounties,
  getBountyLock,
  BountyFilterInput,
} from '@prometheus-protocol/ic-js';
import {
  loadDfxIdentity,
  getCurrentIdentityName,
} from '../../identity.node.js';

export function registerListBountiesCommand(program: Command) {
  program
    .command('list')
    .description('Lists and filters all available bounties on the network.')
    .option('--status <status>', "Filter by status ('Open' or 'Claimed')")
    .option(
      '--audit-type <type>',
      'Filter by a specific audit type (e.g., security_v1)',
    )
    .option(
      '--creator <principal>',
      'Filter by the principal of the bounty creator',
    )
    .option('--limit <number>', 'The number of bounties to fetch', '20')
    .option(
      '--prev <bounty_id>',
      'The bounty ID to start fetching after (for pagination)',
    )
    .action(async (options) => {
      console.log('🔎 Fetching available bounties...');

      try {
        const identity = loadDfxIdentity(getCurrentIdentityName());

        const filters: BountyFilterInput[] = [];
        if (options.status) {
          if (options.status !== 'Open' && options.status !== 'Claimed') {
            throw new Error("Status must be either 'Open' or 'Claimed'.");
          }
          filters.push({ status: options.status });
        }
        if (options.auditType) {
          filters.push({ audit_type: options.auditType });
        }
        if (options.creator) {
          filters.push({ creator: Principal.fromText(options.creator) });
        }

        const bounties = await listBounties(identity, {
          filter: filters.length > 0 ? filters : undefined,
          take: options.limit ? BigInt(options.limit) : undefined,
          prev: options.prev ? BigInt(options.prev) : undefined,
        });

        if (bounties.length === 0) {
          console.log('ℹ️ No bounties found matching the criteria.');
          return;
        }

        // --- CHANGE 2: Fetch lock statuses for all bounties in parallel ---
        console.log('   Checking reservation statuses...');
        const lockStatuses = await Promise.all(
          bounties.map((b) => getBountyLock(b.id.toString())),
        );

        // --- CHANGE 3: Update the formatting logic to include the new status ---
        const formattedBounties = bounties.map((bounty, index) => {
          const wasmId =
            Buffer.from(
              bounty.challengeParameters?.wasm_hash as string,
            ).toString('hex') || 'N/A';
          const auditType =
            (bounty.challengeParameters?.audit_type as string) || 'Unknown';

          // New, more detailed status logic
          let status: string;
          if (bounty.claimedTimestamp) {
            status = '✅ Claimed';
          } else if (lockStatuses[index]) {
            // If a lock exists for this bounty
            status = '🔒 Reserved';
          } else {
            status = '🟢 Open';
          }

          return {
            'Bounty ID': bounty.id,
            Reward: `${bounty.tokenAmount.toLocaleString()} tokens`,
            'Audit Type': auditType,
            'WASM ID': wasmId,
            Status: status, // Use the new, more detailed status
          };
        });

        console.table(formattedBounties);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
