import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { removeController } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerRemoveControllerCommand(program: Command) {
  program
    // 1. Use positional arguments: <principal> is required, [namespace] is optional.
    .command('remove <principal> [namespace]')
    .description(
      'Revokes upgrade permission from a principal. Reads from prometheus.yml if namespace is omitted.',
    )
    // 2. The action now receives both arguments directly.
    .action(async (principal, namespace) => {
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
        const manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as {
          namespace: string;
        };
        targetNamespace = manifest.namespace;
      }

      console.log(`\n🔑 Revoking permission for controller ${principal}...`);

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(
          `   Removing controller from namespace: ${targetNamespace}`,
        );
        // 4. Use the resolved targetNamespace in the API call.
        await removeController(identity, {
          namespace: targetNamespace,
          controller: principal,
        });

        console.log(
          `\n🎉 Success! Successfully removed controller ${principal}.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
