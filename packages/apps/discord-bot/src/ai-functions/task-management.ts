import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import {
  AIFunction,
  AIFunctionHandler,
  AIFunctionContext,
  AIFunctionResult,
} from '../types/index.js';
import { AlertScheduler } from '../services/scheduler.js';
import { DatabaseService } from '../types/index.js';

export class TaskManagementFunctions {
  private functions: Map<string, AIFunctionHandler> = new Map();

  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {
    this.registerFunctions();
  }

  private registerFunctions(): void {
    this.functions.set(
      'create_task',
      new CreateTaskHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'list_my_tasks',
      new ListTasksHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'update_task',
      new ModifyTaskHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'delete_task',
      new DeleteTaskHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'check_task_status',
      new GetTaskStatusHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'save_user_timezone',
      new SaveTimezoneHandler(this.database),
    );
  }

  getFunctions(): AIFunction[] {
    return [
      {
        name: 'create_task',
        title: 'Create Task',
        description:
          'Create a new scheduled task for the current user. Use this to set up recurring monitoring or one-time checks using their available tools. IMPORTANT: Tasks execute without conversation history to reduce costs - make prompts self-contained with all necessary context.\n\nTIME & TIMEZONE IMPORTANT:\n- All tasks run on UTC time internally\n- Current UTC time: ' +
          new Date().toISOString() +
          '\n- If user specifies a specific time (like "6:45pm"), ASK them what timezone they mean\n- Once you learn their timezone, call save_user_timezone to remember it for future use\n- Always confirm the time in BOTH UTC and their local timezone to avoid confusion\n- Example: "I\'ll run this at 6:45 PM your time (which is 1:45 AM UTC tomorrow)"\n- For natural language times, calculate the delay from NOW',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description:
                'Clear, descriptive title for this task. Examples: "Check my account balance", "Monitor match predictions", "Alert me about market changes"',
            },
            prompt: {
              type: 'string',
              description:
                "The AI prompt that will be executed when this task runs. IMPORTANT: Tasks don't have access to conversation history, so this prompt must be completely self-contained. Include all necessary context, parameters, and instructions. Use the user's available tools to gather information.",
            },
            recurring: {
              type: 'boolean',
              description:
                'True = task repeats at the interval indefinitely. False = task runs once then stops automatically.',
            },
            interval: {
              type: 'string',
              description:
                'How often to run this task. You MUST handle time parsing and provide one of:\n\n1. Predefined interval: "1 minute", "5 minutes", "15 minutes", "30 minutes", "1 hour", "6 hours", "12 hours", "daily"\n\n2. Milliseconds as string: For natural language times (like "at 6:45pm", "in 2 hours", "tomorrow at noon"), YOU calculate the milliseconds from NOW and pass it as a string number. Example: User says "in 2 hours" -> you pass "7200000" (2 * 60 * 60 * 1000)\n\nFor specific times (like "6:45pm"), first ask user their timezone, then calculate milliseconds until that time.\n\nIMPORTANT: When confirming with user, explain the time in BOTH UTC and their local timezone to avoid confusion.',
            },
          },
          required: ['title', 'prompt', 'recurring', 'interval'],
        },
      },
      {
        name: 'list_my_tasks',
        title: 'List My Tasks',
        description:
          'List all scheduled tasks belonging to the current user, showing their status, intervals, and when they last ran.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'update_task',
        title: 'Update Task',
        description:
          'Update an existing task. Use this to enable/disable a task or change how often it runs. IMPORTANT: Always call list_my_tasks first to get the correct task_id.',
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description:
                'The exact task ID from list_my_tasks output. This is a UUID like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".',
            },
            enabled: {
              type: 'boolean',
              description:
                'Set to true to enable/resume the task, false to pause it',
            },
            interval: {
              type: 'string',
              description:
                'Change how often the task runs. Same rules as create_task: predefined intervals OR milliseconds as string for natural language times.',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'delete_task',
        title: 'Delete Task',
        description:
          'Permanently delete a scheduled task. This cannot be undone. IMPORTANT: Always call list_my_tasks first to get the correct task_id before deleting.',
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description:
                'The exact task ID from list_my_tasks output. This is a UUID like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'check_task_status',
        title: 'Check Task Status',
        description:
          "Get detailed information about a specific task including when it last ran, if it's enabled, and any recent results. IMPORTANT: Always call list_my_tasks first to get the correct task_id.",
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description:
                'The exact task ID from list_my_tasks output. This is a UUID like "a1b2c3d4-e5f6-7890-abcd-ef1234567890".',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'save_user_timezone',
        title: 'Save User Timezone',
        description:
          'Save the user\'s timezone for future reference. Use this when you learn the user\'s timezone through conversation (e.g., they mention "I\'m in Eastern time" or "I\'m in New York"). This will help provide better time-related assistance in the future.\n\nIMPORTANT: Validate the timezone first by checking if it\'s a valid IANA timezone identifier (e.g., "America/New_York", "Europe/London", "Asia/Tokyo").',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description:
                'IANA timezone identifier (e.g., "America/New_York", "Europe/London", "Asia/Tokyo", "America/Los_Angeles"). Must be a valid timezone name.',
            },
          },
          required: ['timezone'],
        },
      },
    ];
  }

  async executeFunction(
    name: string,
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const handler = this.functions.get(name);
    if (!handler) {
      return {
        success: false,
        message: `Function ${name} not found`,
      };
    }

    try {
      return await handler.execute(args, context);
    } catch (error) {
      logger.error(
        `Error executing function ${name}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        success: false,
        message: `Error executing function: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Individual function handlers
class CreateTaskHandler implements AIFunctionHandler {
  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const { prompt, interval, title, recurring = true } = args;

    // Parse interval to milliseconds
    const intervalMs = this.parseInterval(interval);
    if (intervalMs === null) {
      return {
        success: false,
        message: `Invalid interval: ${interval}`,
      };
    }

    // Check if task title already exists for this user
    const existingTasks = await this.database.getUserTasks(context.userId);
    const existingTask = existingTasks.find(
      (task) => task.description === title,
    );
    if (existingTask) {
      return {
        success: false,
        message: `A task titled "${title}" already exists. Please choose a different title.`,
      };
    }

    // Create unique task ID using UUID
    const taskId = randomUUID();

    try {
      // Create alert configuration with the prompt
      const alertConfig = {
        id: taskId,
        name: title,
        description: recurring
          ? `Recurring task: ${title}`
          : `One-shot task: ${title}`,
        userId: context.userId, // Include userId for MCP tool access
        channelId: context.channelId, // Parent channel for MCP tool access
        targetChannelId: context.threadId || context.channelId, // Post alerts to thread if available
        threadId: context.threadId, // Store thread ID for loading thread history
        interval: intervalMs,
        enabled: true,
        prompt: prompt,
        recurring: recurring,
      };

      // Add to scheduler
      await this.scheduler.addAlert(alertConfig);

      // Save task to database
      await this.database.saveUserTask({
        id: taskId,
        userId: context.userId,
        channelId: context.channelId, // Parent channel for MCP tool access
        targetChannelId: context.threadId || context.channelId, // Post alerts to thread if available
        prompt,
        interval: intervalMs,
        description: title,
        enabled: true,
        recurring: recurring,
        createdAt: new Date(),
      });

      const taskType = recurring ? 'recurring' : 'one-shot';
      const executionMsg = recurring
        ? `I'll execute your prompt every ${interval}`
        : `I'll execute your prompt once in ${interval}`;

      return {
        success: true,
        message: `✅ Created ${taskType} task: "${title}". ${executionMsg} and alert you based on the results.`,
        data: { taskId, title, interval, prompt, recurring },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private parseInterval(interval: string): number | null {
    // First check predefined intervals
    const intervalMap: Record<string, number> = {
      '1 minute': 60 * 1000,
      '5 minutes': 5 * 60 * 1000,
      '15 minutes': 15 * 60 * 1000,
      '30 minutes': 30 * 60 * 1000,
      '1 hour': 60 * 60 * 1000,
      '6 hours': 6 * 60 * 60 * 1000,
      '12 hours': 12 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
    };

    if (intervalMap[interval]) {
      return intervalMap[interval];
    }

    // Try to parse as a number (milliseconds passed directly by AI)
    const numericInterval = parseInt(interval, 10);
    if (!isNaN(numericInterval) && numericInterval > 0) {
      return numericInterval;
    }

    // If it's not a predefined interval or number, AI should have already calculated it
    console.log('⚠️ Received unexpected interval format:', interval);
    return null;
  }
}

class ListTasksHandler implements AIFunctionHandler {
  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    try {
      const tasks = await this.database.getUserTasks(context.userId);

      if (tasks.length === 0) {
        return {
          success: true,
          message:
            "You don't have any monitoring tasks set up yet. You can ask me to create one by saying something like 'Monitor the leaderboard every 5 minutes and alert me if I drop out of first place'.",
          data: { tasks: [] },
        };
      }

      const taskList = tasks
        .map((task, index) => {
          const alert = this.scheduler.getAlert(task.id);
          const errorState = alert?.errorState;

          let statusIcon = task.enabled ? '✅ Active' : '❌ Disabled';
          let errorInfo = '';

          if (errorState?.hasError) {
            if (errorState.errorType === 'permission') {
              statusIcon = '🚫 Permission Error';
              errorInfo = '\n  ⚠️ Alert disabled due to permission issues';
            } else if (errorState.errorType === 'auth') {
              statusIcon = '🔐 Auth Required';
              errorInfo = '\n  ⚠️ Authentication needed';
            } else if (errorState.errorType === 'other') {
              statusIcon = `⚠️ Error (${errorState.errorCount || 1}x)`;
              if (errorState.disabledDueToError) {
                errorInfo = '\n  🚫 Alert disabled due to repeated failures';
              }
            }
          }

          const truncatedPrompt =
            task.prompt.length > 100
              ? task.prompt.substring(0, 100) + '...'
              : task.prompt;

          // Determine task type
          const taskType =
            task.recurring === false ? '🎯 One-Shot' : '🔄 Recurring';

          return (
            `${index + 1}. **${task.description}** (${statusIcon})\n` +
            `   Task ID: \`${task.id}\`\n` +
            `   Type: ${taskType}\n` +
            `   Prompt: ${truncatedPrompt}\n` +
            `   Interval: ${this.formatInterval(task.interval)}\n` +
            `   ${task.lastRun ? `Last run: ${task.lastRun.toLocaleString()}` : 'Never run'}` +
            errorInfo
          );
        })
        .join('\n\n');

      // Include task ID mapping in data for LLM reference
      const taskMapping = tasks.map((task, index) => ({
        number: index + 1,
        id: task.id,
        description: task.description,
        enabled: task.enabled,
      }));

      return {
        success: true,
        message: `📋 **Your Monitoring Tasks:**\n\n${taskList}\n\n_To modify or delete a task, use its Task ID shown above._`,
        data: { tasks, taskMapping },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private formatInterval(ms: number): string {
    const minutes = ms / (60 * 1000);
    const hours = ms / (60 * 60 * 1000);
    const days = ms / (24 * 60 * 60 * 1000);

    if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

class ModifyTaskHandler implements AIFunctionHandler {
  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const { task_id, enabled, interval } = args;

    try {
      // Get task from database
      const task = await this.database.getUserTask(context.userId, task_id);
      if (!task) {
        return {
          success: false,
          message: `Task with ID ${task_id} not found.`,
        };
      }

      // Update enabled status
      if (typeof enabled === 'boolean') {
        if (enabled) {
          // When re-enabling a task, update its target location to current context
          // This allows users to move alerts to different channels/threads
          const alert = this.scheduler.getAlert(task_id);
          if (alert) {
            // Update target channel to current location
            alert.targetChannelId = context.threadId || context.channelId;
            alert.threadId = context.threadId;

            // Also update channelId if we're in a different channel (for MCP tool access)
            if (context.channelId) {
              alert.channelId = context.channelId;
            }

            // Update in database
            await this.database.updateAlert(alert);
          }

          await this.scheduler.enableAlert(task_id);
        } else {
          await this.scheduler.disableAlert(task_id);
        }
        await this.database.updateTaskEnabled(task_id, enabled);
      }

      // Update interval
      if (interval) {
        const intervalMs = this.parseInterval(interval);
        if (intervalMs) {
          // Update scheduler with new interval - this will reschedule if enabled
          await this.scheduler.updateAlertInterval(task_id, intervalMs);
          await this.database.updateTaskInterval(task_id, intervalMs);
        }
      }

      return {
        success: true,
        message: `✅ Updated task "${task.description}".`,
        data: { taskId: task_id },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to modify task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private parseInterval(interval: string): number | null {
    // Same as CreateTaskHandler - supports predefined intervals and numeric milliseconds
    const intervalMap: Record<string, number> = {
      '1 minute': 60 * 1000,
      '5 minutes': 5 * 60 * 1000,
      '15 minutes': 15 * 60 * 1000,
      '30 minutes': 30 * 60 * 1000,
      '1 hour': 60 * 60 * 1000,
      '6 hours': 6 * 60 * 60 * 1000,
      '12 hours': 12 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
    };

    if (intervalMap[interval]) {
      return intervalMap[interval];
    }

    // Try to parse as a number (milliseconds passed directly by AI)
    const numericInterval = parseInt(interval, 10);
    if (!isNaN(numericInterval) && numericInterval > 0) {
      return numericInterval;
    }

    console.log('⚠️ Received unexpected interval format:', interval);
    return null;
  }
}

class DeleteTaskHandler implements AIFunctionHandler {
  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const { task_id } = args;

    try {
      // Verify task belongs to user
      const task = await this.database.getUserTask(context.userId, task_id);
      if (!task) {
        return {
          success: false,
          message: `Task with ID ${task_id} not found.`,
        };
      }

      // Remove from scheduler
      await this.scheduler.removeAlert(task_id);

      // Remove from database
      await this.database.deleteUserTask(task_id);

      return {
        success: true,
        message: `✅ Deleted task "${task.description}".`,
        data: { taskId: task_id },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

class GetTaskStatusHandler implements AIFunctionHandler {
  constructor(
    private scheduler: AlertScheduler,
    private database: DatabaseService,
  ) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const { task_id } = args;

    try {
      const task = await this.database.getUserTask(context.userId, task_id);
      if (!task) {
        return {
          success: false,
          message: `Task with ID ${task_id} not found.`,
        };
      }

      const alert = this.scheduler.getAlert(task_id);
      const errorState = alert?.errorState;

      let status = task.enabled ? '✅ Active' : '❌ Disabled';
      let errorInfo = '';

      // Note: Completed one-shot tasks are deleted immediately, so this case shouldn't occur
      // But we'll keep the check in case there's any delay in deletion
      if (task.recurring === false && task.lastRun && !task.enabled) {
        status = '✔️ Completed (One-Shot)';
        errorInfo =
          '\nℹ️ This task ran once and has been automatically disabled. It will be deleted momentarily.';
      } else if (errorState?.hasError) {
        if (errorState.errorType === 'permission') {
          status = '🚫 Permission Error (Disabled)';
          errorInfo = `\nError: ${errorState.errorMessage}\nOccurred: ${errorState.lastErrorDate?.toLocaleString() || 'Unknown'}\nSuggestion: Fix bot permissions and use /modify_task to re-enable`;
        } else if (errorState.errorType === 'auth') {
          status = '🔐 Authentication Required';
          errorInfo = `\nError: ${errorState.errorMessage}\nOccurred: ${errorState.lastErrorDate?.toLocaleString() || 'Unknown'}\nSuggestion: Reconnect your MCP services using /mcp connect`;
        } else if (errorState.errorType === 'other') {
          status = `⚠️ Error (${errorState.errorCount || 1}x failures)`;
          if (errorState.disabledDueToError) {
            status += ' - Disabled';
          }
          errorInfo = `\nLast Error: ${errorState.errorMessage}\nOccurred: ${errorState.lastErrorDate?.toLocaleString() || 'Unknown'}\nSuggestion: Check your task configuration and re-enable if needed`;
        }
      }

      const lastRun = task.lastRun ? task.lastRun.toLocaleString() : 'Never';

      // For one-shot tasks, there is no next run (they run once and stop)
      let nextRun = 'N/A';
      if (
        task.recurring !== false &&
        task.enabled &&
        task.lastRun &&
        !errorState?.disabledDueToError
      ) {
        // Only show next run for recurring tasks
        nextRun = new Date(
          task.lastRun.getTime() + task.interval,
        ).toLocaleString();
      } else if (task.recurring === false && !task.lastRun && task.enabled) {
        // One-shot task that hasn't run yet
        nextRun = 'Scheduled (one-time)';
      }

      const taskType =
        task.recurring === false ? '🎯 One-Shot' : '🔄 Recurring';

      return {
        success: true,
        message:
          `📊 **Task Status: ${task.description}**\n\n` +
          `Status: ${status}\n` +
          `Type: ${taskType}\n` +
          `Prompt: ${task.prompt}\n` +
          `Interval: ${this.formatInterval(task.interval)}\n` +
          `Last run: ${lastRun}\n` +
          `Next run: ${nextRun}` +
          errorInfo,
        data: { task, alert },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private formatInterval(ms: number): string {
    const minutes = ms / (60 * 1000);
    const hours = ms / (60 * 60 * 1000);
    const days = ms / (24 * 60 * 60 * 1000);

    if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

class SaveTimezoneHandler implements AIFunctionHandler {
  constructor(private database: DatabaseService) {}

  async execute(
    args: Record<string, any>,
    context: AIFunctionContext,
  ): Promise<AIFunctionResult> {
    const { timezone } = args;

    // Validate timezone
    try {
      // Test if the timezone is valid by creating a date formatter
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch (error) {
      return {
        success: false,
        message: `"${timezone}" is not a valid timezone identifier. Please use IANA timezone names like "America/New_York", "Europe/London", or "Asia/Tokyo".`,
      };
    }

    try {
      // Get existing preferences
      const existingPrefs = await this.database.getUserPreferences(
        context.userId,
      );

      // Update timezone
      const updatedPrefs = {
        ...existingPrefs,
        timezone: timezone,
      };

      await this.database.saveUserPreferences(context.userId, updatedPrefs);

      // Show current time in their timezone as confirmation
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      const localTime = formatter.format(new Date());

      return {
        success: true,
        message: `✅ Saved your timezone as ${timezone}. Your current local time is: ${localTime}`,
        data: { timezone, localTime },
      };
    } catch (error) {
      console.error('Failed to save timezone:', error);
      return {
        success: false,
        message: `Failed to save timezone: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
