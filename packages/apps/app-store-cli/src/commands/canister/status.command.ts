import type { Command } from 'commander';
import { getUpgradeStatus } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerCanisterStatusCommand(program: Command) {
  program
    // 1. Rename the command to 'status' to fit the 'canister status' structure.
    .command('status')
    // 2. Update the description to be clear about its identity-scoped nature.
    .description(
      "Polls the orchestrator to check the status of your identity's last initiated upgrade.",
    )
    // 3. The action remains exactly the same, as it correctly takes no arguments.
    .action(async () => {
      console.log("\n🔎 Checking your identity's last upgrade status...");

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        const maxRetries = 20; // Poll for up to 1 minute (20 * 3s)

        for (let i = 0; i < maxRetries; i++) {
          const status = await getUpgradeStatus(identity);

          if ('Success' in status) {
            console.log(
              `\n🎉 Success! Upgrade completed at timestamp ${status.Success}.`,
            );
            return;
          }

          if ('Failed' in status) {
            console.error(
              `\n❌ Failure! Upgrade failed at timestamp ${status.Failed[0]}.`,
            );
            console.error(`   Reason: ${status.Failed[1]}`);
            return;
          }

          if ('InProgress' in status) {
            process.stdout.write(
              `   ... still in progress (attempt ${i + 1}/${maxRetries})\r`,
            );
            await sleep(3000); // Wait 3 seconds before polling again
          }
        }

        console.log(
          '\n Polling timed out. The upgrade is still in progress. Please check again later.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
