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
      'create_monitoring_task',
      new CreateTaskHandler(this.scheduler, this.database),
    );
    this.functions.set('list_user_tasks', new ListTasksHandler(this.database));
    this.functions.set(
      'modify_task',
      new ModifyTaskHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'delete_task',
      new DeleteTaskHandler(this.scheduler, this.database),
    );
    this.functions.set(
      'get_task_status',
      new GetTaskStatusHandler(this.database),
    );
  }

  getFunctions(): AIFunction[] {
    return [
      {
        name: 'create_monitoring_task',
        description:
          'Create a new monitoring task that will periodically execute an AI prompt with MCP tools and alert the user',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description:
                'AI prompt to execute with MCP tools. This prompt will be run periodically and should check for conditions and return alert messages when needed.',
            },
            interval: {
              type: 'string',
              description:
                'How often to execute the prompt (e.g., "5 minutes", "1 hour", "daily")',
              enum: [
                '1 minute',
                '5 minutes',
                '15 minutes',
                '30 minutes',
                '1 hour',
                '6 hours',
                '12 hours',
                'daily',
              ],
            },
            description: {
              type: 'string',
              description: 'Human-readable description of what this task does',
            },
          },
          required: ['prompt', 'interval', 'description'],
        },
      },
      {
        name: 'list_user_tasks',
        description: 'List all monitoring tasks for the current user',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'modify_task',
        description:
          'Modify an existing monitoring task (enable/disable, change interval, etc.)',
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'ID of the task to modify',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether the task should be enabled or disabled',
            },
            interval: {
              type: 'string',
              description: 'New interval for the task',
              enum: [
                '1 minute',
                '5 minutes',
                '15 minutes',
                '30 minutes',
                '1 hour',
                '6 hours',
                '12 hours',
                'daily',
              ],
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'delete_task',
        description: 'Delete a monitoring task completely',
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'ID of the task to delete',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'get_task_status',
        description:
          'Get the current status and last run information for a specific task',
        parameters: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'ID of the task to check',
            },
          },
          required: ['task_id'],
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
    const { prompt, interval, description } = args;

    // Parse interval to milliseconds
    const intervalMs = this.parseInterval(interval);
    if (intervalMs === null) {
      return {
        success: false,
        message: `Invalid interval: ${interval}`,
      };
    }

    // Check if task name already exists for this user
    const existingTasks = await this.database.getUserTasks(context.userId);
    const existingTask = existingTasks.find(
      (task) => task.description === description,
    );
    if (existingTask) {
      return {
        success: false,
        message: `A task named "${description}" already exists. Please choose a different name.`,
      };
    }

    // Create unique task ID
    const taskId = `${context.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Create alert configuration with the prompt
      const alertConfig = {
        id: taskId,
        name: description,
        description: `AI prompt-based task: ${description}`,
        channelId: context.channelId,
        interval: intervalMs,
        enabled: true,
        prompt: prompt,
      };

      // Add to scheduler
      await this.scheduler.addAlert(alertConfig);

      // Save task to database
      await this.database.saveUserTask({
        id: taskId,
        userId: context.userId,
        channelId: context.channelId,
        prompt,
        interval: intervalMs,
        description,
        enabled: true,
        createdAt: new Date(),
      });

      return {
        success: true,
        message: `✅ Created monitoring task: "${description}". Task ID: ${taskId}. I'll execute your prompt every ${interval} and alert you based on the results.`,
        data: { taskId, description, interval, prompt },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private parseInterval(interval: string): number | null {
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

    return intervalMap[interval] || null;
  }
}

class ListTasksHandler implements AIFunctionHandler {
  constructor(private database: DatabaseService) {}

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
        .map(
          (task) =>
            `• **${task.description}** (${task.enabled ? '✅ Active' : '❌ Disabled'})\n` +
            `  ID: \`${task.id}\`\n` +
            `  Prompt: ${task.prompt.length > 100 ? task.prompt.substring(0, 100) + '...' : task.prompt}\n` +
            `  Interval: ${this.formatInterval(task.interval)}\n` +
            `  ${task.lastRun ? `Last run: ${task.lastRun.toLocaleString()}` : 'Never run'}`,
        )
        .join('\n\n');

      return {
        success: true,
        message: `📋 **Your Monitoring Tasks:**\n\n${taskList}`,
        data: { tasks },
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
          // Update scheduler
          const alert = this.scheduler.getAlert(task_id);
          if (alert) {
            alert.interval = intervalMs;
            await this.scheduler.removeAlert(task_id);
            await this.scheduler.addAlert(alert);
          }
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
    // Same as CreateTaskHandler
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

    return intervalMap[interval] || null;
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
  constructor(private database: DatabaseService) {}

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

      const status = task.enabled ? '✅ Active' : '❌ Disabled';
      const lastRun = task.lastRun ? task.lastRun.toLocaleString() : 'Never';
      const nextRun =
        task.enabled && task.lastRun
          ? new Date(task.lastRun.getTime() + task.interval).toLocaleString()
          : 'N/A';

      return {
        success: true,
        message:
          `📊 **Task Status: ${task.description}**\n\n` +
          `Status: ${status}\n` +
          `Prompt: ${task.prompt}\n` +
          `Interval: ${this.formatInterval(task.interval)}\n` +
          `Last run: ${lastRun}\n` +
          `Next run: ${nextRun}`,
        data: { task },
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
