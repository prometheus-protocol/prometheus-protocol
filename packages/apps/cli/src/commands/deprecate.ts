import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { setDeprecationStatus } from '@prometheus-protocol/ic-js';
import { loadDfxIdentity } from '../utils.js';

export function registerDeprecateCommand(program: Command) {
  program
    .command('deprecate')
    .description(
      'Marks a specific version as deprecated, warning operators against its use.',
    )
    .requiredOption(
      '-n, --namespace <ns>',
      'The namespace of the version to deprecate.',
    )
    .requiredOption(
      '-v, --version <version>',
      'The version to deprecate (e.g., 1.2.3).',
    )
    .requiredOption(
      '-r, --reason <text>',
      'The reason for this action (e.g., "Security vulnerability").',
    )
    .option(
      '--undo',
      'Reverses the deprecation, marking the version as safe again.',
      false,
    )
    .action(async (options) => {
      const { namespace, version, reason, undo } = options;
      const shouldDeprecate = !undo;
      const actionText = shouldDeprecate ? 'Deprecating' : 'Restoring';
      const successText = shouldDeprecate ? 'deprecated' : 'restored';

      console.log(
        `\n⚠️  ${actionText} version ${version} for namespace ${namespace}...`,
      );
      console.log(`   Reason: ${reason}`);

      try {
        const identity = loadDfxIdentity(
          execSync('dfx identity whoami').toString().trim(),
        );
        await setDeprecationStatus(identity, {
          namespace,
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
