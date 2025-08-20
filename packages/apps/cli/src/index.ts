#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerSubmitCommand } from './commands/submit.js';
import { registerStatusCommand } from './commands/status.js';
import { registerPublishCommand } from './commands/publish.js';
import { registerRegisterCommand } from './commands/register.js';
import { registerUpgradeCommand } from './commands/upgrade.js';
import { registerUpgradeStatusCommand } from './commands/upgrade-status.js';
import { registerAddControllerCommand } from './commands/add-controller.js';
import { registerRemoveControllerCommand } from './commands/remove-controller.js';
import { registerListVersionsCommand } from './commands/list-versions.js';
import { registerListControllersCommand } from './commands/list-controllers.js';
import { registerDeprecateCommand } from './commands/deprecate.js';
import { registerCreateBountyCommand } from './commands/create-bounty.js';
import { registerAttestGenerateCommand } from './commands/attest-generate.js';
import { registerAttestSubmitCommand } from './commands/attest-submit.js';
import { registerClaimBountyCommand } from './commands/claim-bounty.js';
import { registerDaoGenerateBallotCommand } from './commands/dao-generate-ballot.js';
import { registerDaoFinalizeCommand } from './commands/dao-finalize.js';
import { registerDiscoverCommand } from './commands/discover.js';

const program = new Command();

program
  .name('prometheus-cli')
  .description('A CLI for publishing applications to the Prometheus App Store.')
  .version('0.1.0');

// Register all commands
registerInitCommand(program);
registerSubmitCommand(program);
registerStatusCommand(program);
registerPublishCommand(program);
registerRegisterCommand(program);
registerUpgradeCommand(program);
registerUpgradeStatusCommand(program);
registerAddControllerCommand(program);
registerRemoveControllerCommand(program);
registerListVersionsCommand(program);
registerDeprecateCommand(program);
registerListControllersCommand(program);
registerCreateBountyCommand(program);
registerAttestGenerateCommand(program);
registerAttestSubmitCommand(program);
registerClaimBountyCommand(program);
registerDaoGenerateBallotCommand(program);
registerDaoFinalizeCommand(program);
registerDiscoverCommand(program);

// Exporting for testing purposes
export { program };

// Only parse arguments if the file is being executed directly
if (process.argv[1].endsWith('index.js')) {
  program.parse(process.argv);
}
