// In src/commands/canister/canister.commands.ts

import type { Command } from 'commander';
import { registerUpgradeCanisterCommand } from './upgrade.command.js';
import { registerCanisterStatusCommand } from './status.command.js';

export function registerCanisterCommands(program: Command) {
  // Create the main 'canister' command
  const canisterCmd = program
    .command('canister')
    .description('Manage live application canisters on the IC.');

  // Register the individual commands on the new 'canisterCmd' instance
  registerUpgradeCanisterCommand(canisterCmd);
  registerCanisterStatusCommand(canisterCmd);
}
