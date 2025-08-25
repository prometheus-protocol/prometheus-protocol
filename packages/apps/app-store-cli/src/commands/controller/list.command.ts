import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { getControllers } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerListControllersCommand(program: Command) {
  program
    // Use square brackets to make the argument optional
    .command('list [namespace]')
    .description(
      'Lists controllers for a namespace. Reads from prometheus.yml if namespace is omitted.',
    )
    .action(async (namespace) => {
      let targetNamespace = namespace;

      // If the user didn't provide a namespace, try to find it in the config file.
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

      console.log(
        `\n🔎 Fetching controllers for namespace: ${targetNamespace}...`,
      );

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        // Use the resolved targetNamespace
        const controllers = await getControllers(identity, targetNamespace);

        if (controllers.length === 0) {
          console.log('   No controllers found for this namespace.');
          return;
        }

        console.log('\nAuthorized Controllers:');
        controllers.forEach((controller) => {
          console.log(`  - ${controller}`);
        });
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
