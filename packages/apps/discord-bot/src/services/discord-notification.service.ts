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
}
