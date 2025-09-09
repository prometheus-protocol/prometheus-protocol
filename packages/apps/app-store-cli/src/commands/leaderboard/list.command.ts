import type { Command } from 'commander';
import {
  getUserLeaderboard,
  getServerLeaderboard,
} from '@prometheus-protocol/ic-js';
import { Table } from 'console-table-printer';

// Helper function to print a formatted table to the console.
const printLeaderboard = (
  title: string,
  data: { rank: number; principal: string; invocations: string }[],
) => {
  if (data.length === 0) {
    console.log(`\nℹ️ The ${title} is currently empty.`);
    return;
  }

  const p = new Table({
    title: `🏆 ${title} 🏆`,
    columns: [
      { name: 'rank', title: 'Rank', alignment: 'left' },
      { name: 'principal', title: 'Principal', alignment: 'left' },
      { name: 'invocations', title: 'Total Invocations', alignment: 'right' },
    ],
  });

  p.addRows(data);
  p.printTable();
};

export function registerListLeaderboardCommand(program: Command) {
  // Create a parent 'leaderboard' command to group related actions.

  program
    .command('list <type>')
    .description(
      "Displays the Top Users or Top Servers leaderboard. <type> must be 'users' or 'servers'.",
    )
    .action(async (type: string) => {
      if (type !== 'users' && type !== 'servers') {
        console.error(
          "❌ Error: Invalid type specified. Argument must be either 'users' or 'servers'.",
        );
        return;
      }

      console.log(
        `\n📞 Fetching the ${type === 'users' ? 'Top Users' : 'Top Servers'} leaderboard...`,
      );

      try {
        if (type === 'users') {
          const leaderboardData = await getUserLeaderboard();
          const formattedData = leaderboardData.map((entry) => ({
            rank: Number(entry.rank),
            principal: entry.user.toText(),
            invocations: Number(entry.total_invocations).toLocaleString(),
          }));
          printLeaderboard('Top Users Leaderboard', formattedData);
        } else {
          // type === 'servers'
          const leaderboardData = await getServerLeaderboard();
          const formattedData = leaderboardData.map((entry) => ({
            rank: Number(entry.rank),
            principal: entry.server.toText(),
            invocations: Number(entry.total_invocations).toLocaleString(),
          }));
          printLeaderboard('Top Servers Leaderboard', formattedData);
        }
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
