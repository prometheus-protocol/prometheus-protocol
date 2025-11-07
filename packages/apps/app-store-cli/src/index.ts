#!/usr/bin/env node
import path from 'path';
import fs from 'fs';

import { configure as configureIcJs } from '@prometheus-protocol/ic-js';

import { Command } from 'commander';

import { registerInitCommand } from './commands/init.command.js';
import { registerStatusCommand } from './commands/status.command.js';
import { registerPublishCommand } from './commands/publish.command.js';
import { registerReleaseCommand } from './commands/release.command.js';
import { registerDiscoverCommand } from './commands/discover.js';
import { registerBuildCommand } from './commands/build.command.js';
import { registerBountyCommands } from './commands/bounty/bounty.commands.js';
import { registerAttestCommands } from './commands/attest/attest.commands.js';
import { registerLeaderboardCommands } from './commands/leaderboard/leaderboard.commands.js';

import packageJson from '../package.json' with { type: 'json' };

import { fileURLToPath } from 'url';
import { registerCanisterCommands } from './commands/canister/canister.commands.js';
import { registerControllerCommands } from './commands/controller/controller.commands.js';
import { registerVersionCommands } from './commands/version/version.commands.js';
import { registerAppBountiesCommand } from './commands/app-bounties/app-bounties.commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This cli is built with production canister IDs baked in at build time.
const program = new Command();

program
  .name('app-store-cli')
  .description('A CLI for publishing applications to the Prometheus App Store.')
  .version(packageJson.version)
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
    // --- Return short names, not long names ---
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
    console.log('[CLI] Using production canister IDs.');
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
  const host =
    network === 'ic' ? 'https://icp-api.io' : 'http://127.0.0.1:4943';

  console.log(`[CLI] Host: ${host}`);
  configureIcJs({ canisterIds, host, verbose });
});

// --- Register all commands in a logical, user-friendly order ---

// 1. Primary Developer Workflow (The most common entry point)
registerInitCommand(program);
registerBuildCommand(program);
registerStatusCommand(program);
registerPublishCommand(program);
registerReleaseCommand(program); // Automated workflow combining build + publish
registerDiscoverCommand(program);

// 2. Auditor & Bounty Commands (The second major workflow)
registerBountyCommands(program);
registerAttestCommands(program);

// 4. Advanced Management Commands (Less frequent, administrative tasks)
// It's good practice to group these related commands together.
registerCanisterCommands(program); // Assuming you create a parent for register, upgrade, status
registerControllerCommands(program); // Assuming you create a parent for add, remove, list
registerVersionCommands(program); // Assuming you create a parent for list, deprecate

// 5. App Bounties Commands (Related to application-specific bounties)
registerAppBountiesCommand(program);

// 6. Leaderboard Commands (Related to leaderboards)
registerLeaderboardCommands(program);

// Parse the command line arguments
await program.parseAsync(process.argv);
