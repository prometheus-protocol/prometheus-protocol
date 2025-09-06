// packages/cli/src/commands/bounty/reserve.command.ts

import type { Command } from 'commander';
import {
  deserializeIcrc16Value,
  getBounty,
  getStakeRequirement,
  reserveBounty,
} from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';
import prompts from 'prompts';
import {
  ICRC16,
  ICRC16Map,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';

const getChallengeParam = (params: ICRC16, key: string): string | null => {
  if ('Map' in params) {
    const map = params.Map as ICRC16Map;
    const entry = map.find(([k]) => k === key);
    if (entry && 'Text' in entry[1]) {
      return entry[1].Text;
    }
  }
  return null;
};

export function registerReserveBountyCommand(program: Command) {
  program
    .command('reserve <bounty-id>')
    .description(
      'Reserves a bounty by staking reputation tokens, granting an exclusive lock.',
    )
    .action(async (bountyIdStr: string) => {
      const bountyId = BigInt(bountyIdStr);
      console.log(`\n Reserving bounty #${bountyId}...`);

      try {
        // Step 1: Get the current user's identity
        const identityName = getCurrentIdentityName();
        console.log(`   🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        // Step 2: Fetch bounty details to determine the required audit type
        console.log('   🔍 Fetching bounty details...');
        const bounty = await getBounty(bountyId);
        if (!bounty) {
          throw new Error(`Bounty with ID ${bountyId} not found.`);
        }

        const auditType = getChallengeParam(
          bounty.challenge_parameters,
          'audit_type',
        );

        if (!auditType) {
          throw new Error(
            'Could not determine required audit_type from bounty details.',
          );
        }

        // Step 3: Fetch the required stake amount from the Audit Hub canister
        console.log(`   🔍 Checking stake requirement for '${auditType}'...`);
        const stakeAmount = await getStakeRequirement(auditType);
        if (!stakeAmount) {
          throw new Error(
            `No stake requirement is configured for '${auditType}' on-chain.`,
          );
        }
        console.log(`   ✅ Required stake: ${stakeAmount} ${auditType} tokens`);

        // Step 4: Ask the user for confirmation before staking
        const { confirm } = await prompts([
          {
            type: 'confirm',
            name: 'confirm',
            message: `This will stake ${stakeAmount} '${auditType}' tokens from identity '${identityName}'. Proceed?`,
          },
        ]);

        if (!confirm) {
          console.log('   ❌ Operation cancelled by user.');
          return;
        }

        // Step 5: Call the simplified library function to execute the reservation
        console.log('   📞 Calling the Audit Hub to reserve...');
        await reserveBounty(identity, {
          bounty_id: bountyId,
          token_id: auditType,
        });

        console.log(
          `\n🎉 Success! You have reserved bounty #${bountyId}. You may now file an attestation for it.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
