import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';

/**
 * Get the channel ID to use for MCP tool connections.
 *
 * For DMs: Returns 'dm' so all DM conversations share the same tool context.
 * This allows users to connect MCP servers once in their personal DM with the bot,
 * and then use those tools in DMs with other users without reconnecting.
 *
 * For Guild channels: Returns the actual channel ID so each channel has its own tool context.
 *
 * For Threads: Returns the parent channel ID so threads share their parent's tool context.
 */
export function getToolChannelId(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): string {
  // All DMs share a unified 'dm' tool context
  if (!interaction.inGuild()) {
    return 'dm';
  }

  // In threads, use the parent channel's tool context
  if (interaction.channel?.isThread()) {
    return interaction.channel.parentId || interaction.channelId;
  }

  // Regular guild channels use their own ID
  return interaction.channelId;
}
