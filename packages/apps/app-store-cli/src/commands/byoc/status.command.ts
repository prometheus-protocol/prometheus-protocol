import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

import { getExternalBinding } from '@prometheus-protocol/ic-js';

import type { Command } from 'commander';

export function registerByocStatusCommand(program: Command) {
  program
    .command('status [namespace]')
    .description(
      'Check the BYOC external binding status for a namespace.',
    )
    .action(async (namespace: string | undefined) => {
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
        console.log(`\n🔍 Checking external binding for "${targetNamespace}"...\n`);

        const binding = await getExternalBinding(targetNamespace);

        if (!binding) {
          console.log(`   No external canister bound to "${targetNamespace}".`);
          return;
        }

        console.log(`   Namespace:  ${binding.namespace}`);
        console.log(`   Canister:   ${binding.canisterId}`);
        console.log(`   Bound by:   ${binding.boundBy}`);
        console.log(
          `   Bound at:   ${new Date(Number(binding.boundAt / BigInt(1_000_000))).toISOString()}`,
        );
      } catch (error) {
        console.error('\n❌ Status check failed:');
        console.error(error);
        process.exit(1);
      }
    });
}
