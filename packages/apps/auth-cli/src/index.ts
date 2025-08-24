#!/usr/bin/env node
import path from 'path';
import fs from 'fs';

import { configure as configureIcJs } from '@prometheus-protocol/ic-js';

import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerRegisterCommand } from './commands/register.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerDeleteCommand } from './commands/delete.js';

import packageJson from '../package.json' with { type: 'json' };

const program = new Command();

program
  .name('auth-cli')
  .description(
    'A CLI tool to manage your Prometheus Protocol resource servers.',
  )
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

  const host =
    network === 'ic' ? 'https://icp-api.io' : 'http://127.0.0.1:4943';
  console.log(`[CLI] Host: ${host}`);
  // Configure the shared library with the chosen set of IDs
  configureIcJs({ canisterIds, host, verbose });
});

// Register all the commands
registerListCommand(program);
registerRegisterCommand(program);
registerUpdateCommand(program);
registerDeleteCommand(program);

// Parse the command line arguments
await program.parseAsync(process.argv);
