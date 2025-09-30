import { schedulerLogger } from '../utils/logger.js';
import * as cron from 'node-cron';
import { AlertConfig, AlertResult, DatabaseService } from '../types/index.js';
import { ConfigManager } from '../config/index.js';
import { Client } from 'discord.js';
import { LLMService } from './llm.js';

export class AlertScheduler {
  private alerts = new Map<string, AlertConfig>();
  private tasks = new Map<string, cron.ScheduledTask>();
  private running = false;

  constructor(
    private client: Client,
    private database: DatabaseService,
    private config: ConfigManager,
    private llmService: LLMService,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Load existing alerts from database
    try {
      const savedAlerts = await this.database.loadAlerts();
      schedulerLogger.info('Loading saved alerts from database', {
        alertCount: savedAlerts.length,
      });

      for (const alert of savedAlerts) {
        this.alerts.set(alert.id, alert);

        // Schedule enabled alerts
        if (alert.enabled) {
          this.scheduleAlert(alert);
        }
      }

      schedulerLogger.info('Alert scheduler started', {
        loadedAlerts: savedAlerts.length,
        scheduledAlerts: Array.from(this.alerts.values()).filter(
          (a) => a.enabled,
        ).length,
      });
    } catch (error) {
      schedulerLogger.error(
        'Failed to load alerts from database on startup',
        error instanceof Error ? error : new Error(String(error)),
      );
      schedulerLogger.info('Alert scheduler started with empty state');
    }
  }

  stop(): void {
    if (!this.running) return;

    // Stop all scheduled tasks
    const taskArray = Array.from(this.tasks.values());
    for (const task of taskArray) {
      task.stop();
    }
    this.tasks.clear();
    this.running = false;
    schedulerLogger.info('Alert scheduler stopped');
  }

  async addAlert(alert: AlertConfig): Promise<void> {
    this.alerts.set(alert.id, alert);

    // Save to database
    try {
      await this.database.saveAlert(alert);
      schedulerLogger.info('Alert added and saved to database', {
        alertId: alert.id,
        alertName: alert.name,
      });
    } catch (error) {
      schedulerLogger.error(
        'Failed to save alert to database',
        error instanceof Error ? error : new Error(String(error)),
        { alertId: alert.id },
      );
    }

    if (alert.enabled && this.running) {
      this.scheduleAlert(alert);
    }
  }

  async removeAlert(alertId: string): Promise<void> {
    const task = this.tasks.get(alertId);
    if (task) {
      task.stop();
      this.tasks.delete(alertId);
    }
    this.alerts.delete(alertId);

    // Remove from database
    try {
      await this.database.deleteAlert(alertId);
      schedulerLogger.info('Alert removed and deleted from database', {
        alertId,
      });
    } catch (error) {
      schedulerLogger.error(
        'Failed to delete alert from database',
        error instanceof Error ? error : new Error(String(error)),
        { alertId },
      );
    }
  }

  async enableAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = true;

      // Update in database
      try {
        await this.database.updateAlert(alert);
        schedulerLogger.info('Alert enabled and updated in database', {
          alertId,
          alertName: alert.name,
        });
      } catch (error) {
        schedulerLogger.error(
          'Failed to update alert in database',
          error instanceof Error ? error : new Error(String(error)),
          { alertId },
        );
      }

      if (this.running) {
        this.scheduleAlert(alert);
      }
    }
  }

  async disableAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = false;

      // Update in database
      try {
        await this.database.updateAlert(alert);
        schedulerLogger.info('Alert disabled and updated in database', {
          alertId,
          alertName: alert.name,
        });
      } catch (error) {
        schedulerLogger.error(
          'Failed to update alert in database',
          error instanceof Error ? error : new Error(String(error)),
          { alertId },
        );
      }

      const task = this.tasks.get(alertId);
      if (task) {
        task.stop();
        this.tasks.delete(alertId);
      }
    }
  }

  private scheduleAlert(alert: AlertConfig): void {
    // Remove existing task if any
    const existingTask = this.tasks.get(alert.id);
    if (existingTask) {
      existingTask.stop();
    }

    // Convert interval to cron expression (for simplicity, using interval in minutes)
    const intervalMinutes = Math.max(1, Math.floor(alert.interval / 60000));
    const cronExpression = `*/${intervalMinutes} * * * *`;

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeAlert(alert);
      },
      {
        scheduled: false,
      },
    );

    task.start();
    this.tasks.set(alert.id, task);
    schedulerLogger.info(
      `Scheduled alert "${alert.name}" with interval ${intervalMinutes} minutes`,
    );
  }

  private async executeAlert(alert: AlertConfig): Promise<void> {
    try {
      schedulerLogger.info(`Executing alert: ${alert.name}`);

      // Extract userId for MCP server access
      const userId = alert.id.split('_')[0];

      schedulerLogger.info(`Executing scheduled task with MCP access`, {
        taskName: alert.name,
        userId: userId,
      });

      // Execute the AI prompt with MCP tools - generateResponse handles all tool calling internally
      const result = await this.llmService.generateResponse(
        alert.prompt,
        {
          userId: userId,
          channelId: alert.channelId,
          history: [],
        },
        userId, // Pass userId for MCP integration
      );

      // The unified generateResponse always returns a string (tool calls are handled internally)
      const finalMessage =
        typeof result === 'string'
          ? result
          : 'Task completed but no response was generated.';

      // Send the result if we have content
      if (finalMessage.trim()) {
        await this.sendAlertMessage(
          alert.channelId,
          `🔔 **${alert.name}**\n\n${finalMessage}`,
        );

        // Save the current state
        await this.database.saveAlertState(
          alert.id,
          { message: finalMessage },
          new Date(),
        );

        schedulerLogger.info(`Task "${alert.name}" completed - response sent`);
      } else {
        schedulerLogger.warn(
          `Task "${alert.name}" completed but generated empty response`,
        );
      }

      // Update last run time and save to database
      alert.lastRun = new Date();
      try {
        await this.database.updateAlert(alert);
      } catch (error) {
        schedulerLogger.error(
          'Failed to update alert lastRun time in database',
          error instanceof Error ? error : new Error(String(error)),
          { alertId: alert.id },
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const userId = alert.id.split('_')[0]; // Extract userId for context

      // Check for permission/access errors first (Discord API errors)
      if (
        errorMessage.includes('Missing Access') ||
        errorMessage.includes('50001') ||
        errorMessage.includes('does not have permission') ||
        errorMessage.includes('Bot is not a member') ||
        (errorMessage.includes('Channel') && errorMessage.includes('not found'))
      ) {
        schedulerLogger.warn(
          'Alert failed due to permission or access issues',
          {
            alertName: alert.name,
            channelId: alert.channelId,
            error: errorMessage,
          },
        );

        // Send a helpful notification explaining the permission issue
        // Try to send to the user via DM if possible, otherwise log the issue
        try {
          const user = await this.client.users.fetch(userId);
          const permissionErrorMessage =
            `🚫 **Alert Permission Error**\n\n` +
            `Your alert "${alert.name}" failed because:\n` +
            `${errorMessage}\n\n` +
            `**To fix this:**\n` +
            `• Ensure the bot is still in the server\n` +
            `• Check the bot has "View Channel" and "Send Messages" permissions\n` +
            `• Re-invite the bot if needed: Use \`/help\` command for the invite link\n\n` +
            `The alert will keep trying to run. Once permissions are fixed, it will work automatically.`;

          await user.send(permissionErrorMessage);
          schedulerLogger.info('Sent permission error notification via DM', {
            userId,
            alertName: alert.name,
          });
        } catch (dmError) {
          schedulerLogger.warn('Could not send DM about permission error', {
            userId,
            alertName: alert.name,
            dmError:
              dmError instanceof Error ? dmError.message : String(dmError),
          });
        }

        return; // Don't treat as a regular error - this is a configuration issue
      }

      // Check if this is an OAuth/authentication error
      if (
        errorMessage.includes('OAUTH_AUTHORIZATION_REQUIRED') ||
        errorMessage.includes('Refresh token not found') ||
        errorMessage.includes('Invalid grant') ||
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')
      ) {
        schedulerLogger.warn('Alert failed due to expired authentication', {
          alertName: alert.name,
          userId: userId,
          error: errorMessage,
        });

        // Send a helpful notification to the user
        const authErrorMessage =
          `🔐 Alert "${alert.name}" requires re-authentication.\n\n` +
          `Your MCP server connection has expired. Please reconnect your services using the \`/mcp connect\` command to resume automated alerts.`;

        try {
          await this.sendAlertMessage(alert.channelId, authErrorMessage);
        } catch (sendError) {
          // If we can't send to the channel, try DM
          try {
            const user = await this.client.users.fetch(userId);
            await user.send(authErrorMessage);
            schedulerLogger.info(
              'Sent auth error notification via DM instead',
              { userId, alertName: alert.name },
            );
          } catch (dmError) {
            schedulerLogger.error(
              'Could not notify user about auth error',
              dmError instanceof Error ? dmError : new Error(String(dmError)),
              { userId, alertName: alert.name },
            );
          }
        }

        // Don't disable the alert - user can fix auth and it will resume
        schedulerLogger.info(
          `Alert "${alert.name}" paused due to auth issues - will retry on next run`,
        );
      } else {
        // Regular error - log and notify
        schedulerLogger.error(
          'Error executing alert',
          error instanceof Error ? error : new Error(String(error)),
          { alertName: alert.name },
        );

        // Send error notification to the channel (if possible)
        const regularErrorMessage = `⚠️ Alert "${alert.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        try {
          await this.sendAlertMessage(alert.channelId, regularErrorMessage);
        } catch (sendError) {
          schedulerLogger.error(
            'Could not send error notification to channel',
            sendError instanceof Error
              ? sendError
              : new Error(String(sendError)),
            { alertName: alert.name },
          );
        }
      }
    }
  }

  private async sendAlertMessage(
    channelId: string,
    message: string,
  ): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        schedulerLogger.error(
          'Channel not found',
          new Error('Channel not found'),
          { channelId },
        );
        throw new Error(
          `Channel ${channelId} not found. The bot may have been removed from the server or the channel may have been deleted.`,
        );
      }

      if (!channel.isTextBased() || !('send' in channel)) {
        schedulerLogger.error(
          'Channel is not text-based',
          new Error('Channel is not text-based'),
          { channelId },
        );
        throw new Error(`Channel ${channelId} is not a text channel.`);
      }

      // Check if the bot has permission to send messages in this channel
      if ('guild' in channel && channel.guild) {
        const botMember = channel.guild.members.me;
        if (!botMember) {
          schedulerLogger.error(
            'Bot member not found in guild',
            new Error('Bot member not found'),
            { channelId },
          );
          throw new Error('Bot is not a member of this server.');
        }

        const permissions = channel.permissionsFor(botMember);
        if (!permissions || !permissions.has('SendMessages')) {
          schedulerLogger.error(
            'Bot lacks SendMessages permission',
            new Error('Missing SendMessages permission'),
            { channelId },
          );
          throw new Error(
            `Bot does not have permission to send messages in channel ${channel.name || channelId}. Please ensure the bot has the "Send Messages" permission in this channel.`,
          );
        }

        if (!permissions.has('ViewChannel')) {
          schedulerLogger.error(
            'Bot lacks ViewChannel permission',
            new Error('Missing ViewChannel permission'),
            { channelId },
          );
          throw new Error(
            `Bot does not have permission to view channel ${channel.name || channelId}. Please ensure the bot has the "View Channel" permission.`,
          );
        }
      }

      await channel.send(message);
      schedulerLogger.info('Alert message sent successfully', { channelId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check for specific Discord API errors
      if (
        errorMessage.includes('Missing Access') ||
        errorMessage.includes('50001')
      ) {
        schedulerLogger.error(
          'Bot missing access to channel - permission denied',
          new Error('Missing Access'),
          { channelId },
        );
        throw new Error(
          `Bot does not have permission to access channel ${channelId}. Please check the bot's permissions or invite the bot to the server with proper permissions.`,
        );
      } else if (
        errorMessage.includes('Unknown Channel') ||
        errorMessage.includes('10003')
      ) {
        schedulerLogger.error(
          'Channel not found or deleted',
          new Error('Unknown Channel'),
          { channelId },
        );
        throw new Error(
          `Channel ${channelId} not found. The channel may have been deleted or the bot may have been removed from the server.`,
        );
      } else if (
        errorMessage.includes('Cannot send messages to this user') ||
        errorMessage.includes('50007')
      ) {
        schedulerLogger.error(
          'Cannot send DM to user',
          new Error('Cannot send DM'),
          { channelId },
        );
        throw new Error(
          `Cannot send direct message to user. The user may have DMs disabled.`,
        );
      }

      schedulerLogger.error(
        'Failed to send alert message to channel',
        error instanceof Error ? error : new Error(String(error)),
        { channelId },
      );

      // Re-throw with the original error message if it's not a known Discord error
      throw error;
    }
  }

  getAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  getAlert(alertId: string): AlertConfig | undefined {
    return this.alerts.get(alertId);
  }
}
