// In src/commands/dao/dao.commands.ts

import type { Command } from 'commander';
import { registerGenerateBallotCommand } from './generate-ballot.command.js';
import { registerFinalizeCommand } from './finalize.command.js';
import { registerDaoListCommand } from './list.command.js';

export function registerDaoCommands(program: Command) {
  // Create the main 'dao' command
  const daoCmd = program
    .command('dao')
    .description('Manage DAO governance and submission finalization.');

  // Register the individual commands on the new 'daoCmd' instance
  registerDaoListCommand(daoCmd);
  registerGenerateBallotCommand(daoCmd);
  registerFinalizeCommand(daoCmd);
}
