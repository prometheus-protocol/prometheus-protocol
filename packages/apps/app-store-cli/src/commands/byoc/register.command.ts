import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

import { registerExternalCanister } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

import type { Command } from 'commander';

export function registerByocRegisterCommand(program: Command) {
  program
    .command('register <canister-id> [namespace]')
    .description(
      'Register an externally-deployed canister with the Prometheus registry for discovery.',
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

        console.log(`\n🔗 Registering external canister...`);
        console.log(`   Namespace:  ${targetNamespace}`);
        console.log(`   Canister:   ${canisterId}`);
        console.log(`   Identity:   ${currentIdentityName}`);

        const binding = await registerExternalCanister(identity, {
          namespace: targetNamespace,
          canisterId,
        });

        console.log(`\n🎉 External canister registered successfully!`);
        console.log(`   Namespace:  ${binding.namespace}`);
        console.log(`   Canister:   ${binding.canisterId}`);
        console.log(`   Bound by:   ${binding.boundBy}`);
      } catch (error) {
        console.error('\n❌ Registration failed:');
        console.error(error);
        process.exit(1);
      }
    });
}
