#!/usr/bin/env node
import path from 'path';
import fs from 'fs';

import { configure as configureIcJs } from '@prometheus-protocol/ic-js';

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

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('prometheus-cli')
  .description('A CLI for publishing applications to the Prometheus App Store.')
  .version('0.1.1')
  .option(
    '-n, --network <network>',
    "The network to use ('ic' or 'local')",
    'ic', // Default to 'ic' for production use
  )
  .option('-v, --verbose', 'Enable verbose logging for debugging');

// This function is ONLY for local development
function loadLocalCanisterIds() {
  const network = 'local';
  const canisterIdsPath = path.resolve(
    // Assuming this file is in dist/, we need to go up one more level
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '.dfx',
    network,
    'canister_ids.json',
  );

  if (!fs.existsSync(canisterIdsPath)) {
    throw new Error(
      `Could not find local canister_ids.json at ${canisterIdsPath}. Run 'dfx deploy' first.`,
    );
  }

  try {
    const canisterIdsJson = JSON.parse(
      fs.readFileSync(canisterIdsPath, 'utf-8'),
    );
    // --- FIX 2: Return short names, not long names ---
    return Object.entries(canisterIdsJson).reduce(
      (acc: Record<string, string>, [name, ids]) => {
        // The key should be 'AUTH_SERVER', not 'CANISTER_ID_AUTH_SERVER'
        acc[name.toUpperCase()] = (ids as Record<string, string>)[network];
        return acc;
      },
      {},
    );
  } catch (e) {
    console.error('Error parsing canister_ids.json:', e);
    throw e; // Re-throw the error to stop execution
  }
}

// This hook will now reliably run before every command's action
program.hook('preAction', (thisCommand) => {
  console.log(`[CLI] Running command: ${thisCommand.name()}`);
  console.log(`[CLI] Network: ${thisCommand.opts().network}`);
  // opts() will now inherit the global --network option
  const { network, verbose } = thisCommand.opts();
  let canisterIds;

  if (network === 'ic') {
    console.log('[CLI] Using baked-in production canister IDs.');
    canisterIds = __PROD_CANISTER_IDS__;

    if (!canisterIds || Object.keys(canisterIds).length === 0) {
      console.error(
        'Error: Production canister IDs were not baked into this build. Please rebuild the CLI.',
      );
      process.exit(1);
    }
  } else if (network === 'local') {
    console.log('[CLI] Using local canister IDs from .dfx directory.');
    canisterIds = loadLocalCanisterIds();
  } else {
    console.error(
      `Error: Invalid network specified: '${network}'. Use 'ic' or 'local'.`,
    );
    process.exit(1);
  }

  // Configure the shared library with the chosen set of IDs
  configureIcJs({ canisterIds, verbose });
});

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
if (process.argv[1].endsWith('cli.js')) {
  program.parse(process.argv);
}
