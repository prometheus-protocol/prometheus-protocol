import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  addController,
  getCurrentIdentityName,
  loadDfxIdentity,
} from '@prometheus-protocol/ic-js';

export function registerAddControllerCommand(program: Command) {
  program
    .command('add-controller')
    .description(
      'Grants upgrade permission to a new principal for the namespace in prometheus.yml.',
    )
    .requiredOption(
      '-p, --principal <id>',
      'The principal ID of the controller to add.',
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

      console.log(`\n🔑 Adding new controller ${principal}...`);

      try {
        const manifest = yaml.load(fs.readFileSync(configPath, 'utf-8')) as {
          namespace: string;
        };
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(`   Adding controller to namespace: ${manifest.namespace}`);
        await addController(identity, {
          namespace: manifest.namespace,
          controller: principal,
        });

        console.log(
          `\n🎉 Success! Successfully added controller ${principal}.`,
        );
        console.log('   They are now able to upgrade canisters of this type.');
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
