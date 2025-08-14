import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { registerCanister } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

export function registerRegisterCommand(program: Command) {
  program
    .command('register')
    .description(
      'Links a canister you control to a namespace, enabling future upgrades.',
    )
    .requiredOption(
      '-c, --canister <id>',
      'The principal ID of the canister to register.',
    )
    .requiredOption(
      '-n, --namespace <ns>',
      'The namespace to associate the canister with (e.g., com.my-app).',
    )
    .action(async (options) => {
      const { canister, namespace } = options;

      console.log(
        `\n🔗 Registering canister ${canister} to namespace ${namespace}...`,
      );

      try {
        const identity = loadDfxIdentity(
          execSync('dfx identity whoami').toString().trim(),
        );

        await registerCanister(identity, {
          canister_id: canister,
          namespace: namespace,
        });

        console.log(`\n🎉 Success! Canister ${canister} is now registered.`);
        console.log(
          '   You can now use the `upgrade` command for this canister.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(
          '   Ensure you have been added as a controller for this namespace.',
        );
        console.error(error);
      }
    });
}
