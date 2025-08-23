import {
  deleteResourceServer,
  listMyResourceServers,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

import type { Command } from 'commander';
import prompts from 'prompts';

export function registerDeleteCommand(program: Command) {
  program
    .command('delete')
    .description('Delete an existing resource server.')
    .action(async () => {
      try {
        // The command layer is responsible for getting the identity.
        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);

        console.log('Fetching your registered resource servers...');

        // Call the clean service function.
        const existingServers = await listMyResourceServers(identity);

        if (existingServers.length === 0) {
          console.log('You have no resource servers to delete.');
          return;
        }

        const { serverToManageId } = await prompts({
          type: 'select',
          name: 'serverToManageId',
          message: 'Which server would you like to delete?',
          choices: existingServers.map((s) => ({
            title: `${s.name} (${s.resource_server_id})`,
            value: s.resource_server_id,
          })),
        });

        if (!serverToManageId) {
          console.log('\nDelete operation cancelled. Exiting.');
          return;
        }

        const { confirmDelete } = await prompts({
          type: 'confirm',
          name: 'confirmDelete',
          message: `Are you sure you want to delete this server? This action cannot be undone.`,
          initial: false,
        });

        if (confirmDelete) {
          console.log('\nDeleting server...');

          // Call the other clean service function.
          const deleteResult = await deleteResourceServer(
            identity,
            serverToManageId,
          );

          if ('err' in deleteResult) {
            throw new Error(`Failed to delete server: ${deleteResult.err}`);
          }
          console.log('   ✅ Server successfully deleted.');
        } else {
          console.log('\nDelete operation cancelled.');
        }
      } catch (error) {
        console.error(`\n❌ An error occurred: ${(error as Error).message}`);
      }
    });
}
