import type { Command } from 'commander';
import prompts from 'prompts';
import { Principal } from '@dfinity/principal';

// --- Import from your clean service layer and identity helpers ---
import {
  listMyResourceServers,
  updateResourceServer,
  Auth,
} from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

export function registerUpdateCommand(program: Command) {
  program
    .command('update')
    .description('Update the details of an existing registered canister.')
    .action(async () => {
      try {
        // --- 1. Load Identity and Fetch Servers ---
        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);
        console.log(`\nUsing identity: ${identityName}`);
        console.log('Fetching your registered canisters...');

        const existingServers = await listMyResourceServers(identity);

        if (existingServers.length === 0) {
          console.log('You have no canisters registered to update.');
          return;
        }

        // --- 2. Prompt User to Select a Canister ---
        const { serverToManageId } = await prompts({
          type: 'select',
          name: 'serverToManageId',
          message: 'Which canister would you like to update?',
          choices: existingServers.map((s) => ({
            title: `${s.name} (${s.resource_server_id})`,
            value: s.resource_server_id,
          })),
        });

        if (!serverToManageId) {
          console.log('\nUpdate cancelled. Exiting.');
          return;
        }

        const serverToUpdate = existingServers.find(
          (s) => s.resource_server_id === serverToManageId,
        )!;

        // --- 3. Prompt for New Details, Pre-filling with Current Values ---
        const currentlyCharges = serverToUpdate.scopes.some(
          (scope) => scope[0] === 'prometheus:charge',
        );

        console.log(`\n📝 Updating '${serverToUpdate.name}'...`);
        const response = await prompts([
          {
            type: 'text',
            name: 'name',
            message: 'Canister Name:',
            initial: serverToUpdate.name,
          },
          {
            type: 'text',
            name: 'url',
            message: 'Canister URL:',
            initial: serverToUpdate.uris[0],
          },
          {
            type: 'text',
            name: 'logo',
            message: 'Logo URL:',
            initial: serverToUpdate.logo_uri,
          },
          {
            type: 'confirm',
            name: 'willCharge',
            message: 'Will this canister charge users for services?',
            initial: currentlyCharges,
          },
          {
            type: (prev) => (prev ? 'text' : null), // Only ask if willCharge is true
            name: 'tokens',
            message: 'Accepted ICRC-2 Canisters (comma-separated):',
            initial: serverToUpdate.accepted_payment_canisters
              .map((p) => p.toText())
              .join(', '),
          },
        ]);

        // --- 4. Construct Arguments and Call Service Layer ---
        const newTokens = (response.tokens || '')
          .split(',')
          .map((p: string) => p.trim())
          .filter((p: string) => p)
          .map((p: string) => Principal.fromText(p));

        const newScopes: [string, string][] = [
          [
            'openid',
            "Grants access to the user's unique identifier (Principal).",
          ],
        ];
        if (response.willCharge) {
          newScopes.push([
            'prometheus:charge',
            'Allows the canister to request payments from the user.',
          ]);
        }

        // The Candid type expects optional vectors for updates.
        const args: Auth.UpdateResourceServerArgs = {
          resource_server_id: serverToUpdate.resource_server_id,
          name: [response.name],
          uris: [[response.url]],
          logo_uri: [response.logo],
          accepted_payment_canisters: [newTokens],
          scopes: [newScopes],
          service_principals: [], // Not currently supported in this CLI flow
        };

        console.log('\nSending update to the Prometheus auth server...');
        await updateResourceServer(identity, args);

        console.log(
          `\n🎉 Success! Canister '${response.name}' has been updated.`,
        );
      } catch (error) {
        console.error(`\n❌ An error occurred: ${(error as Error).message}`);
      }
    });
}
