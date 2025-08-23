import type { Command } from 'commander';
import {
  getCurrentIdentityName,
  getVersions,
  loadDfxIdentity,
} from '@prometheus-protocol/ic-js';

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
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
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
