import { schedulerLogger } from '../utils/logger.js';
import * as cron from 'node-cron';
import {
  AlertConfig,
  AlertResult,
  DatabaseService,
  ConversationMessage,
} from '../types/index.js';
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

    // Remove from database (both alert_configs and user_tasks)
    try {
      await this.database.deleteAlert(alertId);
      await this.database.deleteUserTask(alertId);
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

      // Clear error state when manually enabling
      if (alert.errorState?.disabledDueToError) {
        alert.errorState = undefined;
        schedulerLogger.info('Cleared error state when enabling alert', {
          alertId,
          alertName: alert.name,
        });
      }

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

  async updateAlertInterval(
    alertId: string,
    newInterval: number,
  ): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    // Update the interval
    alert.interval = newInterval;

    // Update in database
    try {
      await this.database.updateAlert(alert);
      schedulerLogger.info('Alert interval updated in database', {
        alertId,
        alertName: alert.name,
        newInterval,
      });
    } catch (error) {
      schedulerLogger.error(
        'Failed to update alert interval in database',
        error instanceof Error ? error : new Error(String(error)),
        { alertId },
      );
      throw error;
    }

    // If the alert is enabled, reschedule it with the new interval
    if (alert.enabled && this.running) {
      schedulerLogger.info('Rescheduling alert with new interval', {
        alertId,
        alertName: alert.name,
        newInterval,
      });
      this.scheduleAlert(alert);
    }
  }

  async clearAlertError(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (alert && alert.errorState?.hasError) {
      alert.errorState = undefined;

      try {
        await this.database.updateAlert(alert);
        schedulerLogger.info('Alert error state cleared', {
          alertId,
          alertName: alert.name,
        });

        // If the alert was disabled due to error and should be re-enabled
        if (alert.enabled && this.running) {
          this.scheduleAlert(alert);
        }

        return true;
      } catch (error) {
        schedulerLogger.error(
          'Failed to clear alert error state in database',
          error instanceof Error ? error : new Error(String(error)),
          { alertId },
        );
        return false;
      }
    }
    return false;
  }

  private async setAlertError(
    alert: AlertConfig,
    errorType: 'permission' | 'auth' | 'other',
    errorMessage: string,
    disableAlert: boolean = false,
  ): Promise<void> {
    const currentError = alert.errorState;
    const errorCount = (currentError?.errorCount || 0) + 1;

    alert.errorState = {
      hasError: true,
      errorType,
      errorMessage,
      errorCount,
      lastErrorDate: new Date(),
      disabledDueToError: disableAlert,
    };

    if (disableAlert) {
      alert.enabled = false;
      const task = this.tasks.get(alert.id);
      if (task) {
        task.stop();
        this.tasks.delete(alert.id);
      }
      schedulerLogger.warn('Alert disabled due to persistent error', {
        alertId: alert.id,
        alertName: alert.name,
        errorType,
        errorCount,
      });
    }

    try {
      await this.database.updateAlert(alert);
    } catch (dbError) {
      schedulerLogger.error(
        'Failed to save alert error state to database',
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { alertId: alert.id },
      );
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

      // Use the userId from the alert config (stored when task was created)
      const userId = alert.userId;

      schedulerLogger.info(`Executing scheduled task with MCP access`, {
        taskName: alert.name,
        userId: userId,
        hasThread: !!alert.threadId,
        isRecurring: alert.recurring !== false,
      });

      // NOTE: Conversation history loading has been disabled for recurring tasks
      // to reduce API costs. Recurring tasks now execute with only their prompt
      // and available MCP tools, without previous conversation context.
      // One-shot tasks also don't need history as they execute once.
      const history: ConversationMessage[] = [];
      schedulerLogger.info(
        `Executing task without conversation history to reduce costs`,
        { taskName: alert.name },
      );

      // Execute the AI prompt with MCP tools - generateResponse handles all tool calling internally
      const result = await this.llmService.generateResponse(
        alert.prompt,
        {
          userId: userId,
          channelId: alert.channelId,
          history: history,
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
        // Use targetChannelId if available, otherwise use channelId
        const targetChannel = alert.targetChannelId || alert.channelId;
        await this.sendAlertMessage(
          targetChannel,
          `🔔 **${alert.name}**\n\n${finalMessage}`,
        );

        // Save the task execution to conversation history so future executions have context
        try {
          if (alert.threadId) {
            // Save to thread history
            await this.database.updateThreadHistory(alert.threadId, {
              role: 'user',
              content: `[Scheduled task: ${alert.name}] ${alert.prompt}`,
            });
            await this.database.updateThreadHistory(alert.threadId, {
              role: 'assistant',
              content: finalMessage,
            });
            schedulerLogger.info('Saved task execution to thread history');
          } else {
            // Save to channel conversation history
            await this.database.saveConversationTurn(
              userId,
              alert.channelId,
              `[Scheduled task: ${alert.name}] ${alert.prompt}`,
              finalMessage,
            );
            schedulerLogger.info(
              'Saved task execution to conversation history',
            );
          }
        } catch (historyError) {
          schedulerLogger.warn('Failed to save task execution to history', {
            error: historyError,
          });
          // Don't fail the task if history save fails
        }

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

      // Clear any existing error state on successful execution
      if (alert.errorState?.hasError) {
        alert.errorState = undefined;
        try {
          await this.database.updateAlert(alert);
          schedulerLogger.info(
            'Cleared error state after successful execution',
            {
              alertId: alert.id,
              alertName: alert.name,
            },
          );
        } catch (dbError) {
          schedulerLogger.error(
            'Failed to clear error state in database',
            dbError instanceof Error ? dbError : new Error(String(dbError)),
            { alertId: alert.id },
          );
        }
      }

      // Update last run time and save to database
      alert.lastRun = new Date();

      // If this is a one-shot task (not recurring), disable it after execution
      if (alert.recurring === false) {
        alert.enabled = false;
        schedulerLogger.info(
          `One-shot task "${alert.name}" executed - disabling and auto-deleting`,
          {
            alertId: alert.id,
            alertName: alert.name,
          },
        );

        // Stop the scheduled task
        const task = this.tasks.get(alert.id);
        if (task) {
          task.stop();
          this.tasks.delete(alert.id);
        }

        try {
          // Update alert_configs table one last time
          await this.database.updateAlert(alert);
          // Also update user_tasks table so list_my_tasks shows correct last run
          await this.database.updateTaskLastRun(alert.id, alert.lastRun);

          // Auto-delete completed one-shot tasks immediately
          await this.removeAlert(alert.id);
          schedulerLogger.info(
            `Auto-deleted completed one-shot task "${alert.name}"`,
            { alertId: alert.id },
          );

          return; // Exit early to avoid duplicate database update below
        } catch (error) {
          schedulerLogger.error(
            'Failed to update one-shot task after execution',
            error instanceof Error ? error : new Error(String(error)),
            { alertId: alert.id },
          );
        }
      }

      try {
        // Update alert_configs table
        await this.database.updateAlert(alert);
        // Also update user_tasks table so list_my_tasks shows correct last run
        await this.database.updateTaskLastRun(alert.id, alert.lastRun);
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
        await this.handlePermissionError(alert, errorMessage, userId);
        return;
      }

      // Check if this is an OAuth/authentication error
      if (
        errorMessage.includes('OAUTH_AUTHORIZATION_REQUIRED') ||
        errorMessage.includes('Refresh token not found') ||
        errorMessage.includes('Invalid grant') ||
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')
      ) {
        await this.handleAuthError(alert, errorMessage, userId);
        return;
      }

      // Regular error - handle with retry logic
      await this.handleRegularError(alert, error, userId);
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

  async clearError(alertId: string): Promise<boolean> {
    return await this.clearAlertError(alertId);
  }

  private async handlePermissionError(
    alert: AlertConfig,
    errorMessage: string,
    userId: string,
  ): Promise<void> {
    // Check if we've already notified about this permission error
    const existingError = alert.errorState;
    const shouldDisable =
      !existingError || (existingError.errorCount || 0) >= 2;

    if (!existingError || existingError.errorType !== 'permission') {
      // First time encountering this permission error - send notification
      schedulerLogger.warn('Alert failed due to permission or access issues', {
        alertName: alert.name,
        channelId: alert.channelId,
        error: errorMessage,
      });

      const permissionErrorMessage =
        `🚫 **Alert Disabled Due to Permission Error**\n\n` +
        `Your alert "${alert.name}" has been disabled because:\n` +
        `${errorMessage}\n\n` +
        `**To fix this:**\n` +
        `• Ensure the bot is still in the server\n` +
        `• Check the bot has "View Channel" and "Send Messages" permissions in the target channel\n` +
        `• Re-invite the bot if needed: Use \`/help\` command for the invite link\n\n` +
        `**To re-enable the alert:**\n` +
        `• Fix the permissions as described above\n` +
        `• Use the \`/alert enable\` command to reactivate the alert\n\n` +
        `The alert will not run again until you manually re-enable it.`;

      // Try to send to the user via DM first, then try the channel
      try {
        const user = await this.client.users.fetch(userId);
        await user.send(permissionErrorMessage);
        schedulerLogger.info('Sent permission error notification via DM', {
          userId,
          alertName: alert.name,
        });
      } catch (dmError) {
        try {
          await this.sendAlertMessage(
            alert.targetChannelId || alert.channelId,
            permissionErrorMessage,
          );
          schedulerLogger.info(
            'Sent permission error notification to channel',
            {
              alertName: alert.name,
            },
          );
        } catch (channelError) {
          schedulerLogger.warn(
            'Could not send permission error notification anywhere',
            {
              userId,
              alertName: alert.name,
              dmError:
                dmError instanceof Error ? dmError.message : String(dmError),
              channelError:
                channelError instanceof Error
                  ? channelError.message
                  : String(channelError),
            },
          );
        }
      }
    }

    // Set error state and disable the alert
    await this.setAlertError(alert, 'permission', errorMessage, shouldDisable);
  }

  private async handleAuthError(
    alert: AlertConfig,
    errorMessage: string,
    userId: string,
  ): Promise<void> {
    // Check if we've already notified about this auth error recently
    const existingError = alert.errorState;
    const shouldNotify =
      !existingError ||
      existingError.errorType !== 'auth' ||
      !existingError.lastErrorDate ||
      Date.now() - existingError.lastErrorDate.getTime() > 24 * 60 * 60 * 1000; // 24 hours

    if (shouldNotify) {
      schedulerLogger.warn('Alert failed due to expired authentication', {
        alertName: alert.name,
        userId: userId,
        error: errorMessage,
      });

      const authErrorMessage =
        `🔐 **Alert Authentication Required**\n\n` +
        `Your alert "${alert.name}" requires re-authentication.\n\n` +
        `Your MCP server connection has expired. Please reconnect your services using the \`/mcp connect\` command to resume automated alerts.\n\n` +
        `The alert will continue trying to run and will work automatically once you reconnect.`;

      try {
        await this.sendAlertMessage(
          alert.targetChannelId || alert.channelId,
          authErrorMessage,
        );
      } catch (sendError) {
        // If we can't send to the channel, try DM
        try {
          const user = await this.client.users.fetch(userId);
          await user.send(authErrorMessage);
          schedulerLogger.info('Sent auth error notification via DM instead', {
            userId,
            alertName: alert.name,
          });
        } catch (dmError) {
          schedulerLogger.error(
            'Could not notify user about auth error',
            dmError instanceof Error ? dmError : new Error(String(dmError)),
            { userId, alertName: alert.name },
          );
        }
      }
    }

    // Set error state but don't disable - user can fix auth and it will resume
    await this.setAlertError(alert, 'auth', errorMessage, false);
  }

  private async handleRegularError(
    alert: AlertConfig,
    error: unknown,
    userId: string,
  ): Promise<void> {
    // Regular error - log and notify, with retry limits
    const errorMessage = error instanceof Error ? error.message : String(error);
    const existingError = alert.errorState;
    const errorCount = (existingError?.errorCount || 0) + 1;

    schedulerLogger.error(
      'Error executing alert',
      error instanceof Error ? error : new Error(String(error)),
      { alertName: alert.name, errorCount },
    );

    // Only send notifications for the first few errors to avoid spam
    if (errorCount <= 3) {
      const regularErrorMessage = `⚠️ Alert "${alert.name}" failed: ${errorMessage}`;
      try {
        await this.sendAlertMessage(
          alert.targetChannelId || alert.channelId,
          regularErrorMessage,
        );
      } catch (sendError) {
        schedulerLogger.error(
          'Could not send error notification to channel',
          sendError instanceof Error ? sendError : new Error(String(sendError)),
          { alertName: alert.name },
        );
      }
    }

    // Disable alert after 5 consecutive failures
    const shouldDisable = errorCount >= 5;
    if (shouldDisable) {
      const disableMessage =
        `🚫 **Alert Disabled After Repeated Failures**\n\n` +
        `Your alert "${alert.name}" has been disabled after ${errorCount} consecutive failures.\n\n` +
        `Last error: ${errorMessage}\n\n` +
        `Please check your alert configuration and use \`/alert enable\` to reactivate it once the issue is resolved.`;

      try {
        const user = await this.client.users.fetch(userId);
        await user.send(disableMessage);
      } catch (dmError) {
        try {
          await this.sendAlertMessage(
            alert.targetChannelId || alert.channelId,
            disableMessage,
          );
        } catch (channelError) {
          schedulerLogger.error(
            'Could not send alert disable notification',
            channelError instanceof Error
              ? channelError
              : new Error(String(channelError)),
            { alertName: alert.name },
          );
        }
      }
    }

    await this.setAlertError(alert, 'other', errorMessage, shouldDisable);
  }
}
