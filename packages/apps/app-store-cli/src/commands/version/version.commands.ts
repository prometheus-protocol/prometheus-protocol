// In src/commands/version/version.commands.ts

import type { Command } from 'commander';
import { registerListVersionsCommand } from './list.command.js';
import { registerDeprecateVersionCommand } from './deprecate.command.js';

export function registerVersionCommands(program: Command) {
  // Create the main 'version' command
  const versionCmd = program
    .command('version')
    .description('Manage published application versions.');

  // Register the individual commands on the new 'versionCmd' instance
  registerListVersionsCommand(versionCmd);
  registerDeprecateVersionCommand(versionCmd);
}
