import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

import { unregisterExternalCanister } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

import type { Command } from 'commander';

export function registerByocUnregisterCommand(program: Command) {
  program
    .command('unregister <canister-id> [namespace]')
    .description(
      'Remove an external canister binding from the Prometheus registry.',
    )
    .action(async (canisterId: string, namespace: string | undefined) => {
      // Resolve namespace from prometheus.yml if not provided
      let targetNamespace = namespace;
      if (!targetNamespace) {
        const configPath = path.join(process.cwd(), 'prometheus.yml');
        if (fs.existsSync(configPath)) {
          const manifest = yaml.load(
            fs.readFileSync(configPath, 'utf-8'),
          ) as { namespace?: string };
          targetNamespace = manifest?.namespace;
        }
      }

      if (!targetNamespace) {
        console.error(
          '\n❌ Namespace is required. Provide it as an argument or run from a directory with prometheus.yml.',
        );
        process.exit(1);
      }

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(`\n🔗 Unregistering external canister...`);
        console.log(`   Namespace:  ${targetNamespace}`);
        console.log(`   Canister:   ${canisterId}`);
        console.log(`   Identity:   ${currentIdentityName}`);

        await unregisterExternalCanister(identity, {
          namespace: targetNamespace,
          canisterId,
        });

        console.log(`\n🎉 External canister unregistered successfully!`);
        console.log(`   Namespace "${targetNamespace}" is now unbound.`);
      } catch (error) {
        console.error('\n❌ Unregistration failed:');
        console.error(error);
        process.exit(1);
      }
    });
}
