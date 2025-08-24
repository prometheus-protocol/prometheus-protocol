import type { Command } from 'commander';

// --- 1. Import from your clean service layer and identity helpers ---
import { listMyResourceServers } from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

export function registerListCommand(program: Command) {
  program
    .command('list')
    .description('List all resource servers registered by your identity.')
    .action(async () => {
      try {
        // --- The command layer is responsible for loading the identity ---
        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);

        console.log(`Using identity: ${identityName}`);
        console.log('Fetching your registered resource servers...');

        // --- Call the clean service function ---
        // The service layer handles the actor creation and throws on error.
        const servers = await listMyResourceServers(identity);

        // --- The presentation logic remains in the command layer ---
        if (servers.length === 0) {
          console.log('You have no resource servers registered.');
          return;
        }

        console.table(
          servers.map((s) => ({
            Name: s.name,
            'Resource Server ID': s.resource_server_id,
            URL: s.uris[0],
            // Extract just the scope name from each tuple for a clean display.
            Scopes: s.scopes.map((scope) => scope[0]).join(', '),
          })),
        );
      } catch (error) {
        // --- Add robust error handling ---
        console.error(`\n❌ An error occurred: ${(error as Error).message}`);
      }
    });
}
