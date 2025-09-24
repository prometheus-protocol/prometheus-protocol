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
    for (const task of this.tasks.values()) {
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

      // Get last state from database
      const lastState = await this.database.getLastAlertState(alert.id);

      // Extract userId for MCP server access
      const userId = alert.id.split('_')[0];

      // Execute the AI prompt with MCP tools to get the result
      const aiContext = {
        userId: userId,
        channelId: alert.channelId,
        history: [],
      };

      schedulerLogger.info(`Executing alert with MCP access`, {
        alertName: alert.name,
        userId: userId,
      });

      const result = await this.llmService.generateResponse(
        alert.prompt,
        aiContext,
        undefined, // No AI functions for alerts
        userId, // Pass userId for MCP integration
      );

      // Process the AI response
      let shouldAlert = false;
      let alertMessage = '';

      if (typeof result === 'string') {
        // Check if this is an actual alert vs. instructions/debugging output
        const isValidAlert = this.isValidAlertResponse(result);

        if (isValidAlert) {
          shouldAlert = true;
          alertMessage = result;
        } else {
          // AI returned instructions/debugging info instead of executing tools
          schedulerLogger.warn(
            'AI returned non-alert text (likely due to missing MCP tools)',
            {
              alertName: alert.name,
              responsePreview:
                result.substring(0, 200) + (result.length > 200 ? '...' : ''),
            },
          );
          shouldAlert = false;
        }
      } else if (Array.isArray(result)) {
        // AI returned function calls - this shouldn't trigger alerts directly
        // The function calls would handle their own outputs
        shouldAlert = false;
      }

      if (shouldAlert) {
        // Send the alert message
        await this.sendAlertMessage(
          alert.channelId,
          `🔔 **${alert.name}**\n\n${alertMessage}`,
        );

        // Save the current state
        await this.database.saveAlertState(
          alert.id,
          { message: alertMessage },
          new Date(),
        );

        schedulerLogger.info(
          `Alert "${alert.name}" triggered - AI response received`,
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
          `Your MCP server connection has expired. Please reconnect your services using the \`!mcp connect\` command to resume automated alerts.`;

        await this.sendAlertMessage(alert.channelId, authErrorMessage);

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

        // Send error notification to the channel
        const regularErrorMessage = `⚠️ Alert "${alert.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        await this.sendAlertMessage(alert.channelId, regularErrorMessage);
      }
    }
  }

  private async sendAlertMessage(
    channelId: string,
    message: string,
  ): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (channel?.isTextBased() && 'send' in channel) {
        await channel.send(message);
      }
    } catch (error) {
      schedulerLogger.error(
        'Failed to send alert message to channel',
        error instanceof Error ? error : new Error(String(error)),
        { channelId },
      );
    }
  }

  getAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  getAlert(alertId: string): AlertConfig | undefined {
    return this.alerts.get(alertId);
  }

  private isValidAlertResponse(response: string): boolean {
    // Check if the response looks like actual alert content vs. instructions/debugging
    const trimmed = response.trim();

    // Skip empty responses
    if (!trimmed) {
      return false;
    }

    // Check for common patterns that indicate this is instructions, not an alert
    const instructionPatterns = [
      /^Creating a periodic monitoring task/i,
      /^Monitor.*weather.*and alert/i,
      /^Instructions for each run:/i,
      /^Periodic run instructions:/i,
      /^\{.*"prompt".*"interval".*\}$/s, // JSON objects
      /Call the MCP tool/i,
      /Parse the response for:/i,
      /Trigger an alert ONLY if/i,
      /Your.*monitoring task is set to run/i,
      /I'll alert only when/i,
      /You can say.*monitoring tasks/i,
    ];

    // If any instruction pattern matches, this is not a valid alert
    for (const pattern of instructionPatterns) {
      if (pattern.test(trimmed)) {
        return false;
      }
    }

    // Valid alerts typically:
    // - Start with "ALERT:" or similar urgent keywords
    // - Are concise (under 500 chars typically)
    // - Don't contain JSON or technical instructions

    // Look for alert keywords
    const alertKeywords = [
      'ALERT:',
      'WARNING:',
      'SEVERE:',
      'URGENT:',
      'EMERGENCY:',
      'CRITICAL:',
    ];
    const hasAlertKeyword = alertKeywords.some((keyword) =>
      trimmed.toUpperCase().includes(keyword),
    );

    // If it has alert keywords, it's likely valid
    if (hasAlertKeyword) {
      return true;
    }

    // If it's very long (>1000 chars), probably instructions
    if (trimmed.length > 1000) {
      return false;
    }

    // If it contains quotes around JSON-looking content, probably instructions
    if (trimmed.includes('"prompt"') || trimmed.includes('"interval"')) {
      return false;
    }

    // For other cases, assume it's a valid alert if it's reasonably short
    // and doesn't match obvious instruction patterns
    return trimmed.length <= 500;
  }
}
