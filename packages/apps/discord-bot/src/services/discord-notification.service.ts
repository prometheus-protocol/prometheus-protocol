import { Client } from 'discord.js';
import logger from '../utils/logger.js';

/**
 * Service for sending Discord notifications to users
 */
export class DiscordNotificationService {
  constructor(private discordClient: Client) {}

  /**
   * Send a private message to a user with OAuth authorization URL
   */
  async sendAuthRequiredMessage(
    userId: string,
    serverName: string,
    authUrl: string,
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);

      const message =
        `🔐 **Authentication Required**\n\n` +
        `The MCP server **${serverName}** requires OAuth authentication before you can connect.\n\n` +
        `**Click here to authorize:** ${authUrl}\n\n` +
        `After completing the authorization, the connection will be established automatically.`;

      await user.send(message);

      logger.info(
        `[DiscordNotification] Sent auth required message to user ${userId} for server ${serverName}`,
      );
    } catch (error) {
      logger.error(
        `[DiscordNotification] Failed to send auth message to user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      // Don't throw - notification failure shouldn't break the auth flow
    }
  }

  /**
   * Send a connection success notification to a user
   */
  async sendConnectionSuccessMessage(
    userId: string,
    serverName: string,
    toolCount: number,
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);

      const message =
        `🎉 **Connection Successful!**\n\n` +
        `✅ **${serverName}** is now connected!\n` +
        `🔧 **${toolCount} tools** are now available for use.\n\n` +
        `You can use \`!mcp tools\` to see what's available, or just start using them in AI chats.`;

      await user.send(message);

      logger.info(
        `[DiscordNotification] Sent connection success message to user ${userId} for server ${serverName}`,
      );
    } catch (error) {
      logger.error(
        `[DiscordNotification] Failed to send success message to user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Send a tools ready notification to a user
   */
  async sendToolsReadyMessage(
    userId: string,
    serverName: string,
    toolCount: number,
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);

      const message =
        `🛠️ **Tools Ready!**\n\n` +
        `🎉 **${serverName}** has finished loading!\n` +
        `🔧 **${toolCount} tools** are now available for use.\n\n` +
        `You can use \`!mcp tools\` to see what's available, or just start using them in AI chats.`;

      await user.send(message);

      logger.info(
        `[DiscordNotification] Sent tools ready message to user ${userId} for server ${serverName}`,
      );
    } catch (error) {
      logger.error(
        `[DiscordNotification] Failed to send tools ready message to user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Send a connection error notification to a user
   */
  async sendConnectionErrorMessage(
    userId: string,
    serverName: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);

      const message =
        `❌ **Connection Failed**\n\n` +
        `There was an issue connecting to **${serverName}**:\n\n` +
        `**Error:** ${errorMessage}\n\n` +
        `Please try again with \`!mcp connect ${serverName}\` or check the server status.`;

      await user.send(message);

      logger.info(
        `[DiscordNotification] Sent connection error message to user ${userId} for server ${serverName}`,
      );
    } catch (error) {
      logger.error(
        `[DiscordNotification] Failed to send error message to user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
