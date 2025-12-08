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

/**
 * Get the channel ID to use for conversation history storage.
 *
 * For DMs: Returns the actual DM channel ID so each DM conversation has its own history.
 * Unlike tool connections, conversation history should be specific to each DM channel.
 *
 * For Guild channels: Returns the actual channel ID.
 *
 * For Threads: Returns the parent channel ID so threads share their parent's conversation history.
 */
export function getConversationChannelId(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
): string {
  // In DMs, use the actual channel ID for separate conversation history
  if (!interaction.inGuild()) {
    return interaction.channelId;
  }

  // In threads, use the parent channel's conversation history
  if (interaction.channel?.isThread()) {
    return interaction.channel.parentId || interaction.channelId;
  }

  // Regular guild channels use their own ID
  return interaction.channelId;
}
