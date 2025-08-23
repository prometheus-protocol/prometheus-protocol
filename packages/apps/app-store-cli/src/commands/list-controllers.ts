import type { Command } from 'commander';
import {
  getControllers,
  getCurrentIdentityName,
  loadDfxIdentity,
} from '@prometheus-protocol/ic-js';

export function registerListControllersCommand(program: Command) {
  program
    .command('list-controllers')
    .description(
      'Lists all principals authorized to upgrade canisters for a given namespace.',
    )
    .requiredOption(
      '-n, --namespace <ns>',
      'The namespace to list controllers for (e.g., com.my-app).',
    )
    .action(async (options) => {
      const { namespace } = options;

      console.log(`\n🔎 Fetching controllers for namespace: ${namespace}...`);

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);
        const controllers = await getControllers(identity, namespace);

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
