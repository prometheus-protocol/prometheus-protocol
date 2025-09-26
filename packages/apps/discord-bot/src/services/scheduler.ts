import { schedulerLogger } from '../utils/logger.js';
import * as cron from 'node-cron';
import {
  AlertConfig,
  AlertResult,
  DatabaseService,
  AIFunctionCall,
  AIFunction,
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

      schedulerLogger.info(`Executing scheduled task with MCP access`, {
        taskName: alert.name,
        userId: userId,
      });

      const result = await this.llmService.generateResponse(
        alert.prompt,
        aiContext,
        undefined, // No AI functions for alerts
        userId, // Pass userId for MCP integration
      );

      // Process the AI response - handle tool calls if needed
      let finalMessage = '';

      if (typeof result === 'string') {
        finalMessage = result;
      } else if (Array.isArray(result)) {
        // AI returned function calls - execute them and continue the conversation
        schedulerLogger.info(
          `AI requested ${result.length} tool calls for task execution`,
          {
            taskName: alert.name,
            toolCalls: result.map((fc) => fc.name),
          },
        );

        const finalResult = await this.handleTaskFunctionCalls(
          result,
          userId,
          alert.prompt,
          alert.name,
        );

        if (finalResult && typeof finalResult === 'string') {
          finalMessage = finalResult;
        } else {
          finalMessage = 'Task completed but no response was generated.';
          schedulerLogger.warn(
            'Failed to get final response after tool execution',
            {
              alertName: alert.name,
            },
          );
        }
      }

      // Always send the result (no validation needed)
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

  private async handleTaskFunctionCalls(
    functionCalls: AIFunctionCall[],
    userId: string,
    originalPrompt: string,
    alertName: string,
  ): Promise<string | null> {
    schedulerLogger.info('Executing function calls for scheduled task', {
      taskName: alertName,
      functionCount: functionCalls.length,
      functions: functionCalls.map((fc) => fc.name),
    });

    const functionResults = [];

    // Execute each function call
    for (const functionCall of functionCalls) {
      schedulerLogger.info('Executing function call', {
        alertName,
        functionName: functionCall.name,
      });

      try {
        const result = await this.llmService.handleFunctionCall(
          functionCall,
          userId,
        );
        functionResults.push(result);
        schedulerLogger.info('Function call completed successfully', {
          alertName,
          functionName: functionCall.name,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        functionResults.push({
          error: errorMessage,
        });
        schedulerLogger.error(
          'Function call failed',
          error instanceof Error ? error : new Error(String(error)),
          {
            alertName,
            functionName: functionCall.name,
          },
        );
      }
    }

    // Get MCP functions for proper conversation continuation
    let allFunctions: AIFunction[] = [];
    try {
      allFunctions = await this.llmService.getMCPFunctions(userId);
    } catch (error) {
      schedulerLogger.error(
        'Failed to load MCP functions for conversation continuation',
        error as Error,
        {
          alertName,
        },
      );
    }

    // Use the centralized generateResponse method which handles tool execution internally
    try {
      const contextualResponse = await this.llmService.generateResponse(
        originalPrompt,
        {
          userId,
          channelId: 'scheduler',
          history: [],
        },
        allFunctions,
        userId,
      );

      schedulerLogger.info(
        'Generated final alert response using centralized LLM service',
        {
          alertName,
          responseLength:
            typeof contextualResponse === 'string'
              ? contextualResponse.length
              : contextualResponse.length,
          responsePreview:
            typeof contextualResponse === 'string'
              ? contextualResponse.substring(0, 200)
              : 'Function calls executed',
        },
      );

      // Convert function calls to a descriptive string for the alert
      if (Array.isArray(contextualResponse)) {
        return `Executed ${contextualResponse.length} function calls: ${contextualResponse.map((fc) => fc.name).join(', ')}`;
      }

      return contextualResponse;
    } catch (error) {
      schedulerLogger.error(
        'Failed to continue conversation with tool results',
        error instanceof Error ? error : new Error(String(error)),
        { alertName },
      );

      // Fallback to simple result summary
      let fallback = `Alert "${alertName}" executed:\n\n`;
      for (let i = 0; i < functionCalls.length; i++) {
        const call = functionCalls[i];
        const result = functionResults[i];
        if (result.error) {
          fallback += `❌ ${call.name}: ${result.error}\n`;
        } else if (result.content && Array.isArray(result.content)) {
          const text = result.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join(' ');
          fallback += `✅ ${call.name}: ${text.slice(0, 200)}...\n`;
        } else {
          fallback += `✅ ${call.name}: Success\n`;
        }
      }
      return fallback;
    }
  }
}
