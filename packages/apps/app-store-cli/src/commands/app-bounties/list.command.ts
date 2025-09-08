import type { Command } from 'commander';
import { getAllAppBounties } from '@prometheus-protocol/ic-js';

export function registerListBountiesCommand(program: Command) {
  program
    .command('list')
    .description('Lists all app bounties on the canister.')
    .action(async () => {
      console.log('🔎 Fetching all app bounties...');
      try {
        const bounties = await getAllAppBounties();

        if (bounties.length === 0) {
          console.log('\n✅ No bounties found on the canister.');
          return;
        }

        const formattedBounties = bounties.map((b) => ({
          ID: Number(b.id),
          Title: b.title,
          Status: b.status,
          Reward: `${b.reward_amount} ${b.reward_token}`,
        }));

        console.log('\n📋 Current App Bounties:');
        console.table(formattedBounties);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
