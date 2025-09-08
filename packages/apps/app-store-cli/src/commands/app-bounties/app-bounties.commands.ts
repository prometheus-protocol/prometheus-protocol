import type { Command } from 'commander';
import { registerGenerateBountyCommand } from './generate.command.js';
import { registerListBountiesCommand } from './list.command.js';
import { registerPublishBountyCommand } from './publish.command.js';

export function registerAppBountiesCommand(program: Command) {
  const appCommand = program
    .command('app-bounties')
    .description('Manage application bounties on the Prometheus App Store.');

  registerGenerateBountyCommand(appCommand);
  registerListBountiesCommand(appCommand);
  registerPublishBountyCommand(appCommand);
}
