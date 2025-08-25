import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { getVersions } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

interface Manifest {
  namespace: string;
}

export function registerListVersionsCommand(program: Command) {
  program
    // 1. Use an optional positional argument for the namespace.
    .command('list [namespace]')
    .description(
      'Lists all published versions. Reads from prometheus.yml if namespace is omitted.',
    )
    // 2. The action now receives the optional namespace directly.
    .action(async (namespace) => {
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
        `\n🔎 Fetching versions for namespace: ${targetNamespace}...`,
      );

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        // 4. Use the resolved targetNamespace in the API call.
        const versions = await getVersions(identity, targetNamespace);

        if (versions.length === 0) {
          console.log('   No versions found for this namespace.');
          return;
        }

        // The existing console.table is a great way to display this!
        console.table(versions);
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
