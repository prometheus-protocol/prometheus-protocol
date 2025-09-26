import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { CommandRegistryImpl } from './commands/registry.js';
import { ChatCommand } from './commands/chat/chat.js';
import { MCPCommand } from './commands/mcp/mcp.js';
import { TasksCommand } from './commands/tasks/tasks.js';
import logger from './utils/logger.js';
// You might need to import your services if the command constructors need them
// For this script, we can often pass 'null' or a mock if the constructor allows it,
// since we only need the command definition, not its execution logic.

// --- CONFIGURATION ---
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID; // Your Test Server ID

if (!token || !clientId || !guildId) {
  throw new Error(
    'DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID must be set in your .env file.',
  );
}

// --- COMMAND LOADING ---
// This part mimics your bot's setup to get the command definitions.
// We pass 'null as any' because we don't need the full services for just building the command data.
const commandRegistry = new CommandRegistryImpl();
commandRegistry.register(new ChatCommand(null as any, null as any));
commandRegistry.register(new MCPCommand(null as any, null as any));
commandRegistry.register(new TasksCommand(null as any, null as any));

const commands = commandRegistry
  .getAllCommands()
  .map((cmd) => {
    if ('getSlashCommand' in cmd && typeof cmd.getSlashCommand === 'function') {
      // Assuming getSlashCommand returns a SlashCommandBuilder or similar
      const slashCommandData = cmd.getSlashCommand();
      if (slashCommandData instanceof SlashCommandBuilder) {
        return slashCommandData.toJSON();
      }
    }
    return null;
  })
  .filter(Boolean); // Filter out any commands that aren't slash commands

logger.info(`📝 [Deploy] Found ${commands.length} slash commands to register`);
logger.debug('📝 [Deploy] Commands to register', { service: 'CommandDeploy', commands });

// --- DEPLOYMENT ---
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info('🔄 [Deploy] Started refreshing application (/) commands');

    // Deploy to guild for instant updates
    logger.info('🏠 [Deploy] Deploying to guild...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    logger.info('✅ [Deploy] Guild commands deployed');

    // Also deploy globally for better reliability
    logger.info('🌐 [Deploy] Deploying globally...');
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    logger.info('✅ [Deploy] Global commands deployed');

    logger.info('✅ [Deploy] Successfully reloaded application (/) commands');
  } catch (error) {
    logger.error('❌ [Deploy] Command deployment failed:', error instanceof Error ? error : new Error(String(error)));
  }
})();
