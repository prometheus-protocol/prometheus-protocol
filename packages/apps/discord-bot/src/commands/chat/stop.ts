import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import {
  BaseCommand,
  CommandContext,
  CommandResponse,
  CommandCategory,
} from '../../types/index.js';
import { chatLogger } from '../../utils/logger.js';

// Global map to track active processing sessions
export const activeProcessingSessions = new Map<string, boolean>();

// Helper function to check if a session should be interrupted
export function shouldInterrupt(userId: string, channelId: string): boolean {
  const sessionKey = `${userId}-${channelId}`;
  return activeProcessingSessions.get(sessionKey) === true;
}

// Helper function to start tracking a session
export function startSession(userId: string, channelId: string): void {
  const sessionKey = `${userId}-${channelId}`;
  activeProcessingSessions.set(sessionKey, false);
}

// Helper function to end tracking a session
export function endSession(userId: string, channelId: string): void {
  const sessionKey = `${userId}-${channelId}`;
  activeProcessingSessions.delete(sessionKey);
}

export class StopCommand extends BaseCommand {
  name = 'stop';
  description = 'Stop the current AI processing in this thread/channel';
  category = CommandCategory.CHAT;

  getSlashCommand(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.channelId;
    const sessionKey = `${interaction.user.id}-${channelId}`;

    chatLogger.info('Stop command executed', {
      userId: interaction.user.id,
      channelId,
      sessionKey,
    });

    // Check if there's an active session
    if (activeProcessingSessions.has(sessionKey)) {
      // Set the interrupt flag
      activeProcessingSessions.set(sessionKey, true);

      await interaction.reply({
        content:
          '🛑 **Processing interrupted.** The AI will stop after completing the current operation.',
        ephemeral: true,
      });

      chatLogger.info('Processing session interrupted', { sessionKey });
    } else {
      await interaction.reply({
        content: 'ℹ️ No active AI processing found in this thread/channel.',
        ephemeral: true,
      });

      chatLogger.info('No active session found to stop', { sessionKey });
    }
  }
}
