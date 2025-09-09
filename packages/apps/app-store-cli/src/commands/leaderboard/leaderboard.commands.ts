// In src/commands/attest/attest.commands.ts

import type { Command } from 'commander';
import { registerListLeaderboardCommand } from './list.command.js';

export function registerLeaderboardCommands(program: Command) {
  // Create the main 'leaderboard' command
  const leaderboardCmd = program
    .command('leaderboard')
    .description('Manage leaderboards.');

  // Register the individual commands on the new 'leaderboardCmd' instance
  registerListLeaderboardCommand(leaderboardCmd);
}
