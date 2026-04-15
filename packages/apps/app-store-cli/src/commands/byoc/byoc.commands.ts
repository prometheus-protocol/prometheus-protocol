import type { Command } from 'commander';
import { registerByocRegisterCommand } from './register.command.js';
import { registerByocUnregisterCommand } from './unregister.command.js';
import { registerByocStatusCommand } from './status.command.js';

export function registerByocCommands(program: Command) {
  const byocCmd = program
    .command('byoc')
    .description(
      'Bring Your Own Canister — register externally-deployed canisters with Prometheus for discovery.',
    );

  registerByocRegisterCommand(byocCmd);
  registerByocUnregisterCommand(byocCmd);
  registerByocStatusCommand(byocCmd);
}
