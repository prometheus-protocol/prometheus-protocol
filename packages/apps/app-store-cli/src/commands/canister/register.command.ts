import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { registerCanister } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

interface Manifest {
  namespace: string;
}

export function registerRegisterCanisterCommand(program: Command) {
  program
    // 1. Use positional arguments: <canister-id> is required, [namespace] is optional.
    .command('register <canister-id> [namespace]')
    .description(
      'Links a canister to a namespace. Reads from prometheus.yml if namespace is omitted.',
    )
    // 2. The action now receives the arguments directly.
    .action(async (canisterId, namespace) => {
      let targetNamespace = namespace;

      // 3. If namespace is missing, try to load it from the config file.
      if (!targetNamespace) {
        console.log(
          'ℹ️ Namespace not provided, attempting to read from prometheus.yml...',
        );
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error(
            '❌ Error: Namespace not provided and prometheus.yml not found.',
          );
          console.error(
            '   Run this command from your project root or specify a namespace manually.',
          );
          return;
        }
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;
        targetNamespace = manifest.namespace;
      }

      console.log(
        `\n🔗 Registering canister ${canisterId} to namespace ${targetNamespace}...`,
      );

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        // 4. Use the resolved targetNamespace and the canisterId argument in the API call.
        await registerCanister(identity, {
          canister_id: canisterId,
          namespace: targetNamespace,
        });

        console.log(`\n🎉 Success! Canister ${canisterId} is now registered.`);
        console.log(
          '   You can now use the `canister upgrade` command for this canister.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(
          '   Ensure you have been added as a controller for this namespace.',
        );
        console.error(error);
      }
    });
}
