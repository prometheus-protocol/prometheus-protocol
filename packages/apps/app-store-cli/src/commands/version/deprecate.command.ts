import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { setDeprecationStatus } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

interface Manifest {
  namespace: string;
}

export function registerDeprecateVersionCommand(program: Command) {
  program
    // 1. Use positional arguments: <version> is required, [namespace] is optional.
    .command('deprecate <version> [namespace]')
    .description(
      'Marks a version as deprecated. Reads from prometheus.yml if namespace is omitted.',
    )
    // 2. Keep 'reason' and 'undo' as options.
    .requiredOption(
      '-r, --reason <text>',
      'The reason for this action (e.g., "Security vulnerability").',
    )
    .option(
      '--undo',
      'Reverses the deprecation, marking the version as safe again.',
      false,
    )
    // 3. The action now receives the positional arguments directly.
    .action(async (version, namespace, options) => {
      let targetNamespace = namespace;

      // 4. If namespace is missing, try to load it from the config file.
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

      const { reason, undo } = options;
      const shouldDeprecate = !undo;
      const actionText = shouldDeprecate ? 'Deprecating' : 'Restoring';
      const successText = shouldDeprecate ? 'deprecated' : 'restored';

      console.log(
        `\n⚠️  ${actionText} version ${version} for namespace ${targetNamespace}...`,
      );
      console.log(`   Reason: ${reason}`);

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        // 5. Use the resolved targetNamespace and the version argument in the API call.
        await setDeprecationStatus(identity, {
          namespace: targetNamespace,
          version,
          deprecate: shouldDeprecate,
          reason,
        });

        console.log(
          `\n🎉 Success! Version ${version} has been ${successText}.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
