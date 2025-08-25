// In src/commands/controller/add.command.ts
import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { addController } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerAddControllerCommand(program: Command) {
  program
    .command('add <principal> [namespace]')
    .description(
      'Grants upgrade permission to a principal. Reads from prometheus.yml if namespace is omitted.',
    )
    .action(async (principal, namespace) => {
      let targetNamespace = namespace;

      // --- THIS IS THE CRUCIAL LOGIC THAT FIXES THE BUG ---
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
      // ----------------------------------------------------

      console.log(`\n🔑 Adding new controller ${principal}...`);

      try {
        const currentIdentityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(currentIdentityName);

        console.log(`   Adding controller to namespace: ${targetNamespace}`);
        await addController(identity, {
          namespace: targetNamespace,
          controller: principal,
        });

        console.log(
          `\n🎉 Success! Successfully added controller ${principal}.`,
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
