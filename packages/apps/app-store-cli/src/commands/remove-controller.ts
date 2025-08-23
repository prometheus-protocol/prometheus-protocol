import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { removeController } from '@prometheus-protocol/ic-js';
import { getCurrentIdentityName, loadDfxIdentity } from '../identity.node.js';

export function registerRemoveControllerCommand(program: Command) {
  program
    .command('remove-controller')
    .description(
      'Revokes upgrade permission from a principal for the namespace in prometheus.yml.',
    )
    .requiredOption(
      '-p, --principal <id>',
      'The principal ID of the controller to remove.',
    )
    .action(async (options) => {
      const { principal } = options;
      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found. Please run this command from your project root.',
        );
        return;
      }

      console.log(`\n🔑 Revoking permission for controller ${principal}...`);

      try {
        const manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as {
          namespace: string;
        };
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(
          `   Removing controller from namespace: ${manifest.namespace}`,
        );
        await removeController(identity, {
          namespace: manifest.namespace,
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
