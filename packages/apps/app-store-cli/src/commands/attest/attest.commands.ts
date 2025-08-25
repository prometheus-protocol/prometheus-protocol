// In src/commands/attest/attest.commands.ts

import type { Command } from 'commander';
import { registerGenerateAttestationCommand } from './generate.command.js';
import { registerSubmitAttestationCommand } from './submit.command.js';

export function registerAttestCommands(program: Command) {
  // Create the main 'attest' command
  const attestCmd = program
    .command('attest')
    .description('Manage audit attestations.');

  // Register the individual commands on the new 'attestCmd' instance
  registerGenerateAttestationCommand(attestCmd);
  registerSubmitAttestationCommand(attestCmd);
}
