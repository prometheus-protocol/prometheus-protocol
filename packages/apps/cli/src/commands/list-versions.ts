import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { getVersions } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

export function registerListVersionsCommand(program: Command) {
  program
    .command('list-versions')
    .description('Lists all published versions for a given namespace.')
    .requiredOption(
      '-n, --namespace <ns>',
      'The namespace to list versions for (e.g., com.my-app).',
    )
    .action(async (options) => {
      const { namespace } = options;

      console.log(`\n🔎 Fetching versions for namespace: ${namespace}...`);

      try {
        const identity = loadDfxIdentity(
          execSync('dfx identity whoami').toString().trim(),
        );
        const versions = await getVersions(identity, namespace);

        if (versions.length === 0) {
          console.log('   No versions found for this namespace.');
          return;
        }

        console.table(versions);
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
