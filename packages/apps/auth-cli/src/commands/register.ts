import type { Command } from 'commander';
import prompts from 'prompts';
import { Principal } from '@dfinity/principal';

// --- Import from your clean service layer and identity helpers ---
import { registerResourceServer, Auth } from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

export function registerRegisterCommand(program: Command) {
  program
    .command('register')
    .description('Register a new IC canister as a resource server.')
    .action(async () => {
      try {
        // --- Load Identity ---
        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);
        console.log(
          `\n📝 Registering a new canister using identity: ${identityName}`,
        );

        // --- Gather Canister Details ---
        const details = await prompts([
          {
            type: 'text',
            name: 'name',
            message: 'Server Name:',
            initial: 'My Monetized Server',
          },
          {
            type: 'text',
            name: 'logo',
            message: 'Logo URL:',
            initial:
              'https://placehold.co/128x128/1a1a1a/ffffff/png?text=My+Canister',
          },
          {
            type: 'text',
            name: 'frontendHost',
            message: 'Frontend Host (for OAuth consent flow):',
            initial: 'https://prometheusprotocol.org/oauth',
          },
          {
            type: 'confirm',
            name: 'willCharge',
            message: 'Will this canister charge users for services?',
            initial: true,
          },
          {
            type: (prev) => (prev ? 'text' : null), // Only ask if willCharge is true
            name: 'tokens',
            message: 'Accepted ICRC-2 Canisters (comma-separated):',
            initial: '53nhb-haaaa-aaaar-qbn5q-cai',
          },
        ]);

        // --- Get and Validate Canister ID ---
        let canisterId: string;
        let servicePrincipal: Principal;
        while (true) {
          const { id } = await prompts({
            type: 'text',
            name: 'id',
            message: 'Please enter the Canister ID to register:',
          });
          try {
            servicePrincipal = Principal.fromText(id);
            canisterId = id;
            break;
          } catch (e) {
            console.error('❌ Invalid Canister ID format. Please try again.');
          }
        }

        // --- Determine URL (Local vs. Production) ---
        const { isLocalDev } = await prompts({
          type: 'confirm',
          name: 'isLocalDev',
          message: 'Is this for local development (using dfx)?',
          initial: true,
        });

        const serverUrl = isLocalDev
          ? `http://127.0.0.1:4943/?canisterId=${canisterId}`
          : `https://${canisterId}.icp0.io`;

        // --- 5. Construct Scopes and Arguments ---
        const finalScopes: [string, string][] = [
          [
            'openid',
            "Grants access to the user's unique identifier (Principal).",
          ],
        ];

        const tokenPrincipals = (details.tokens || '')
          .split(',')
          .map((p: string) => p.trim())
          .filter((p: string) => p)
          .map((p: string) => Principal.fromText(p));

        const args: Auth.RegisterResourceServerArgs = {
          name: details.name,
          initial_service_principal: servicePrincipal,
          logo_uri: details.logo,
          uris: [serverUrl],
          accepted_payment_canisters: tokenPrincipals,
          scopes: finalScopes,
          frontend_host: [details.frontendHost],
        };

        // --- 6. Call the Service Layer and Display Results ---
        console.log(
          '\nRegistering canister with the Prometheus auth server...',
        );
        const result = await registerResourceServer(identity, args);

        console.log('\n🎉 Success! Your canister has been registered.');
        console.table([
          {
            'Canister Name': details.name,
            'Resource Server ID': result.resource_server_id,
            'Registered URL': serverUrl,
            'Frontend Host': details.frontendHost,
          },
        ]);
      } catch (error) {
        console.error(`\n❌ An error occurred: ${(error as Error).message}`);
      }
    });
}
