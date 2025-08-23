#!/usr/bin/env node

import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerRegisterCommand } from './commands/register.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerDeleteCommand } from './commands/delete.js';

async function main() {
  const program = new Command();

  program
    .name('prometheus-configure')
    .description(
      'A CLI tool to manage your Prometheus Protocol resource servers.',
    )
    .version('0.1.0');

  // Register all the commands
  registerListCommand(program);
  registerRegisterCommand(program);
  registerUpdateCommand(program);
  registerDeleteCommand(program);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('\n❌ An unexpected error occurred:');
  console.error(`   ${err.message}`);
  process.exit(1);
});
