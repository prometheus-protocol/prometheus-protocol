// In src/commands/bounty/bounty.commands.ts

import type { Command } from 'commander';
import { registerCreateBountyCommand } from './create.command.js';
import { registerClaimBountyCommand } from './claim.command.js';
import { registerListBountiesCommand } from './list.command.js';

export function registerBountyCommands(program: Command) {
  // Create the main 'bounty' command
  const bountyCmd = program
    .command('bounty')
    .description('Manage bounties for application audits.');

  // Register the individual commands on the new 'bountyCmd' instance
  registerCreateBountyCommand(bountyCmd);
  registerClaimBountyCommand(bountyCmd);
  registerListBountiesCommand(bountyCmd);
}
