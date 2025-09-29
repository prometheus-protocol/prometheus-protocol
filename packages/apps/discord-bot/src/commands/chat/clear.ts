import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  EmbedBuilder,
} from 'discord.js';
import {
  BaseCommand,
  CommandContext,
  CommandResponse,
  CommandCategory,
  DatabaseService,
} from '../../types/index.js';
import { chatLogger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/errors.js';

export class ClearChatCommand extends BaseCommand {
  name = 'clear-chat';
  description = 'Clear the AI chat memory/conversation history';
  category = CommandCategory.CHAT;

  constructor(private database: DatabaseService) {
    super();
  }

  getSlashCommand(): SlashCommandBuilder | SlashCommandOptionsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addBooleanOption((option) =>
        option
          .setName('confirm')
          .setDescription('Confirm that you want to clear the chat memory')
          .setRequired(true),
      )
      .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel,
      ]);
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const confirm = interaction.options.getBoolean('confirm', true);

    try {
      await interaction.deferReply({ ephemeral: true });

      if (!confirm) {
        await interaction.editReply({
          content: '❌ Chat memory clearing cancelled. Set `confirm` to `true` to proceed.',
        });
        return;
      }

      const context: CommandContext = {
        userId: interaction.user.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId || undefined,
        interaction,
        args: [], // No args for this command
      };

      const response = await this.executeInternal(context);

      if (response.embeds) {
        await interaction.editReply({
          content: response.content,
          embeds: response.embeds,
        });
      } else {
        await interaction.editReply({ content: response.content });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(`❌ Error: ${errorMessage}`);
        } else {
          await interaction.reply(`❌ Error: ${errorMessage}`);
        }
      } catch (replyError) {
        chatLogger.error(
          'Failed to send error message:',
          replyError instanceof Error
            ? replyError
            : new Error(String(replyError)),
        );
      }
    }
  }

  private async executeInternal(context: CommandContext): Promise<CommandResponse> {
    chatLogger.info('Clear chat command executed', {
      userId: context.userId,
      channelId: context.channelId,
    });

    try {
      // Clear conversation history for this user and channel
      const deletedCount = await this.database.clearConversationHistory(
        context.userId,
        context.channelId,
      );

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🧹 Chat Memory Cleared')
        .setDescription(
          `Successfully cleared ${deletedCount} message${deletedCount !== 1 ? 's' : ''} from the AI chat memory.`,
        )
        .addFields(
          {
            name: 'What was cleared?',
            value: 'All previous conversation history between you and the AI in this channel.',
          },
          {
            name: 'What happens next?',
            value: 'The AI will start fresh with no memory of previous conversations in this channel.',
          },
        )
        .setTimestamp();

      chatLogger.info('Chat memory cleared successfully', {
        userId: context.userId,
        channelId: context.channelId,
        deletedCount,
      });

      return {
        content: '✅ Chat memory has been cleared successfully!',
        embeds: [embed],
        ephemeral: true,
      };
    } catch (error) {
      chatLogger.error('Failed to clear chat memory', error as Error, {
        userId: context.userId,
        channelId: context.channelId,
      });

      return {
        content: '❌ Failed to clear chat memory. Please try again later.',
        ephemeral: true,
      };
    }
  }
}