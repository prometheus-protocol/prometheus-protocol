import type { Command } from 'commander';
import { registerAddControllerCommand } from './add.command.js';
import { registerListControllersCommand } from './list.command.js';
import { registerRemoveControllerCommand } from './remove.command.js';

export function registerControllerCommands(program: Command) {
  const controllerCmd = program
    .command('controller')
    .description('Manage authorized controllers for a namespace.');

  registerAddControllerCommand(controllerCmd);
  registerListControllersCommand(controllerCmd);
  registerRemoveControllerCommand(controllerCmd);
}
