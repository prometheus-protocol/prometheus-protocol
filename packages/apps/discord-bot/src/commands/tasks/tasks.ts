import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import {
  BaseCommand,
  CommandContext,
  CommandResponse,
  CommandCategory,
  DatabaseService,
} from '../../types/index.js';
import { TaskManagementFunctions } from '../../ai-functions/task-management.js';
import { ErrorHandler } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class TasksCommand extends BaseCommand {
  name = 'tasks';
  description = 'Manage monitoring tasks and alerts';
  category = CommandCategory.UTILITY;

  constructor(
    private taskFunctions: TaskManagementFunctions,
    private database: DatabaseService,
  ) {
    super();
  }

  getSlashCommand():
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a new monitoring task')
          .addStringOption((option) =>
            option
              .setName('name')
              .setDescription(
                'A short, memorable name for this task (e.g., "weather-check")',
              )
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName('description')
              .setDescription('What should this task monitor?')
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName('prompt')
              .setDescription('AI prompt to execute (what conditions to check)')
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName('interval')
              .setDescription('How often to check')
              .setRequired(true)
              .addChoices(
                { name: '1 minute', value: '1 minute' },
                { name: '5 minutes', value: '5 minutes' },
                { name: '15 minutes', value: '15 minutes' },
                { name: '30 minutes', value: '30 minutes' },
                { name: '1 hour', value: '1 hour' },
                { name: '6 hours', value: '6 hours' },
                { name: '12 hours', value: '12 hours' },
                { name: 'Daily', value: 'daily' },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('list').setDescription('List all your tasks'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('status')
          .setDescription('Get status of a specific task')
          .addStringOption((option) =>
            option
              .setName('task_name')
              .setDescription('Name of the task to check')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('enable')
          .setDescription('Enable a task')
          .addStringOption((option) =>
            option
              .setName('task_name')
              .setDescription('Name of the task to enable')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('disable')
          .setDescription('Disable a task')
          .addStringOption((option) =>
            option
              .setName('task_name')
              .setDescription('Name of the task to disable')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a task permanently')
          .addStringOption((option) =>
            option
              .setName('task_name')
              .setDescription('Name of the task to delete')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('modify')
          .setDescription('Modify task interval')
          .addStringOption((option) =>
            option
              .setName('task_name')
              .setDescription('Name of the task to modify')
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName('interval')
              .setDescription('New interval')
              .setRequired(true)
              .addChoices(
                { name: '1 minute', value: '1 minute' },
                { name: '5 minutes', value: '5 minutes' },
                { name: '15 minutes', value: '15 minutes' },
                { name: '30 minutes', value: '30 minutes' },
                { name: '1 hour', value: '1 hour' },
                { name: '6 hours', value: '6 hours' },
                { name: '12 hours', value: '12 hours' },
                { name: 'Daily', value: 'daily' },
              ),
          ),
      );
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    console.log('🔍 Tasks executeSlash called:', {
      interactionId: interaction.id,
      isDeferred: interaction.deferred,
      isReplied: interaction.replied,
      userId: interaction.user.id,
      subcommand,
    });

    try {
      // Defer the reply since some operations might take time
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
        console.log(
          `✅ Successfully deferred reply for interaction: ${interaction.id}`,
        );
      }

      const context: CommandContext = {
        interaction,
        args: [], // Not used in slash commands, but required by interface
        userId: interaction.user.id,
        channelId: interaction.channelId!,
        guildId: interaction.guildId!,
      };

      const response = await this.executeInternal(
        subcommand,
        interaction,
        context,
      );

      if (response.embeds) {
        await interaction.editReply({ embeds: response.embeds });
      } else {
        await interaction.editReply(response.content || 'Command completed.');
      }
    } catch (error) {
      logger.error(
        'Error in tasks command:',
        error instanceof Error ? error : new Error(String(error)),
      );

      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(`❌ Error: ${errorMessage}`);
        } else {
          await interaction.reply(`❌ Error: ${errorMessage}`);
        }
      } catch (replyError) {
        logger.error(
          'Failed to send error message:',
          replyError instanceof Error
            ? replyError
            : new Error(String(replyError)),
        );
      }
    }
  }

  private async executeInternal(
    subcommand: string,
    interaction: ChatInputCommandInteraction,
    context: CommandContext,
  ): Promise<CommandResponse> {
    const functionContext = {
      userId: context.userId,
      channelId: context.channelId,
      guildId: context.guildId,
      username: interaction.user.username || 'Unknown',
    };

    switch (subcommand) {
      case 'create': {
        const name = interaction.options.getString('name', true);
        const prompt = interaction.options.getString('prompt', true);
        const interval = interaction.options.getString('interval', true);

        const result = await this.taskFunctions.executeFunction(
          'create_monitoring_task',
          { description: name, prompt, interval },
          functionContext,
        );

        return {
          content: result.message,
          embeds: result.success
            ? [
                new EmbedBuilder()
                  .setColor(0x00ff00)
                  .setTitle('✅ Task Created Successfully')
                  .setDescription(
                    `Task "${name}" has been created and will run every ${interval}.`,
                  )
                  .addFields(
                    { name: 'Task Name', value: name, inline: false },
                    { name: 'Interval', value: interval, inline: true },
                    {
                      name: 'Prompt',
                      value:
                        prompt.length > 100
                          ? prompt.substring(0, 100) + '...'
                          : prompt,
                      inline: false,
                    },
                  )
                  .setTimestamp(),
              ]
            : [
                new EmbedBuilder()
                  .setColor(0xff0000)
                  .setTitle('❌ Failed to Create Task')
                  .setDescription(result.message)
                  .setTimestamp(),
              ],
        };
      }

      case 'list': {
        const result = await this.taskFunctions.executeFunction(
          'list_user_tasks',
          {},
          functionContext,
        );

        if (!result.success) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Failed to List Tasks')
                .setDescription(result.message)
                .setTimestamp(),
            ],
          };
        }

        const tasks = result.data?.tasks || [];

        if (tasks.length === 0) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('📋 Your Tasks')
                .setDescription(
                  "You don't have any monitoring tasks set up yet.\n\nUse `/tasks create` to create your first task!",
                )
                .setTimestamp(),
            ],
          };
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('📋 Your Monitoring Tasks')
          .setTimestamp();

        tasks.forEach((task: any, index: number) => {
          const status = task.enabled ? '✅ Active' : '❌ Disabled';
          const interval = this.formatInterval(task.interval);
          const lastRun = task.lastRun
            ? new Date(task.lastRun).toLocaleString()
            : 'Never';

          embed.addFields({
            name: `${index + 1}. ${task.description}`,
            value: `**Status:** ${status}\n**Interval:** ${interval}\n**Last Run:** ${lastRun}`,
            inline: false,
          });
        });

        return { content: '', embeds: [embed] };
      }

      case 'status': {
        const taskName = interaction.options.getString('task_name', true);

        // Get task ID from name
        const taskId = await this.getTaskIdFromName(
          taskName,
          functionContext.userId,
          functionContext.username,
        );
        if (!taskId) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription(
                  `Task "${taskName}" not found. Use \`/tasks list\` to see your tasks.`,
                )
                .setTimestamp(),
            ],
          };
        }

        const result = await this.taskFunctions.executeFunction(
          'get_task_status',
          { task_id: taskId },
          functionContext,
        );

        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setColor(result.success ? 0x0099ff : 0xff0000)
              .setTitle(result.success ? '📊 Task Status' : '❌ Error')
              .setDescription(result.message)
              .setTimestamp(),
          ],
        };
      }

      case 'enable': {
        const taskName = interaction.options.getString('task_name', true);

        // Get task ID from name
        const taskId = await this.getTaskIdFromName(
          taskName,
          functionContext.userId,
          functionContext.username,
        );
        if (!taskId) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription(
                  `Task "${taskName}" not found. Use \`/tasks list\` to see your tasks.`,
                )
                .setTimestamp(),
            ],
          };
        }

        const result = await this.taskFunctions.executeFunction(
          'modify_task',
          { task_id: taskId, enabled: true },
          functionContext,
        );

        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setColor(result.success ? 0x00ff00 : 0xff0000)
              .setTitle(result.success ? '✅ Task Enabled' : '❌ Error')
              .setDescription(result.message)
              .setTimestamp(),
          ],
        };
      }

      case 'disable': {
        const taskName = interaction.options.getString('task_name', true);

        // Get task ID from name
        const taskId = await this.getTaskIdFromName(
          taskName,
          functionContext.userId,
          functionContext.username,
        );
        if (!taskId) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription(
                  `Task "${taskName}" not found. Use \`/tasks list\` to see your tasks.`,
                )
                .setTimestamp(),
            ],
          };
        }

        const result = await this.taskFunctions.executeFunction(
          'modify_task',
          { task_id: taskId, enabled: false },
          functionContext,
        );

        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setColor(result.success ? 0xffff00 : 0xff0000)
              .setTitle(result.success ? '⏸️ Task Disabled' : '❌ Error')
              .setDescription(result.message)
              .setTimestamp(),
          ],
        };
      }

      case 'delete': {
        const taskName = interaction.options.getString('task_name', true);
        console.log('🗑️ DELETE DEBUG: Attempting to delete task:', taskName);

        // Get task ID from name
        const taskId = await this.getTaskIdFromName(
          taskName,
          functionContext.userId,
          functionContext.username,
        );
        console.log('🗑️ DELETE DEBUG: Found task ID:', taskId);

        if (!taskId) {
          console.log('🗑️ DELETE DEBUG: Task not found');
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription(
                  `Task "${taskName}" not found. Use \`/tasks list\` to see your tasks.`,
                )
                .setTimestamp(),
            ],
          };
        }

        console.log('🗑️ DELETE DEBUG: Calling delete_task function...');
        const result = await this.taskFunctions.executeFunction(
          'delete_task',
          { task_id: taskId },
          functionContext,
        );
        console.log('🗑️ DELETE DEBUG: Delete result:', {
          success: result.success,
          message: result.message,
        });

        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setColor(result.success ? 0xff6600 : 0xff0000)
              .setTitle(result.success ? '🗑️ Task Deleted' : '❌ Error')
              .setDescription(result.message)
              .setTimestamp(),
          ],
        };
      }

      case 'modify': {
        const taskName = interaction.options.getString('task_name', true);
        const interval = interaction.options.getString('interval', true);

        // Get task ID from name
        const taskId = await this.getTaskIdFromName(
          taskName,
          functionContext.userId,
          functionContext.username,
        );
        if (!taskId) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('❌ Error')
                .setDescription(
                  `Task "${taskName}" not found. Use \`/tasks list\` to see your tasks.`,
                )
                .setTimestamp(),
            ],
          };
        }

        const result = await this.taskFunctions.executeFunction(
          'modify_task',
          { task_id: taskId, interval },
          functionContext,
        );

        const embed = new EmbedBuilder()
          .setColor(result.success ? 0x00ff00 : 0xff0000)
          .setTitle(result.success ? '✅ Task Modified' : '❌ Error')
          .setDescription(result.message)
          .setTimestamp();

        if (result.success) {
          embed.addFields({
            name: 'New Interval',
            value: interval,
            inline: true,
          });
        }

        return {
          content: '',
          embeds: [embed],
        };
      }

      default:
        return {
          content: `Unknown subcommand: ${subcommand}`,
        };
    }
  }

  private async getTaskIdFromName(
    taskNameOrId: string,
    userId: string,
    username: string,
  ): Promise<string | null> {
    try {
      console.log(
        '🔍 TASK LOOKUP DEBUG: Looking for task name or ID:',
        taskNameOrId,
      );

      // Check if input looks like a task ID (contains userId prefix)
      if (taskNameOrId.startsWith(userId + '_')) {
        console.log(
          '🔍 TASK LOOKUP DEBUG: Input appears to be a task ID, returning as-is',
        );
        return taskNameOrId;
      }

      // Get all user tasks and find by description (name)
      const result = await this.taskFunctions.executeFunction(
        'list_user_tasks',
        {},
        { userId, channelId: '', guildId: '', username },
      );

      if (!result.success || !result.data?.tasks) {
        console.log('🔍 TASK LOOKUP DEBUG: No tasks found or error');
        return null;
      }

      console.log(
        '🔍 TASK LOOKUP DEBUG: Available tasks:',
        result.data.tasks.map((t: any) => ({
          id: t.id,
          description: t.description,
        })),
      );
      const task = result.data.tasks.find(
        (t: any) => t.description === taskNameOrId,
      );
      console.log('🔍 TASK LOOKUP DEBUG: Found matching task:', task);
      return task ? task.id : null;
    } catch (error) {
      return null;
    }
  }

  async handleAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    console.log('🎯 TASKS AUTOCOMPLETE HANDLER CALLED');
    const focusedOption = interaction.options.getFocused(true);
    console.log('🎯 FOCUSED OPTION:', focusedOption);

    try {
      if (focusedOption.name === 'task_name') {
        console.log('🎯 FETCHING TASKS FOR AUTOCOMPLETE...');
        // Get user's tasks for autocomplete
        const result = await this.taskFunctions.executeFunction(
          'list_user_tasks',
          {},
          {
            userId: interaction.user.id,
            channelId: interaction.channelId || '',
            guildId: interaction.guildId || '',
            username:
              interaction.user.username ||
              interaction.user.displayName ||
              'Unknown',
          },
        );

        console.log('🎯 TASK FUNCTION RESULT:', {
          success: result.success,
          hasData: !!result.data,
          taskCount: result.data?.tasks?.length || 0,
        });

        let choices: { name: string; value: string }[] = [];

        if (result.success && result.data?.tasks) {
          // Get the subcommand to filter tasks appropriately
          const subcommand = interaction.options.getSubcommand();
          console.log('🎯 SUBCOMMAND FOR FILTERING:', subcommand);

          choices = result.data.tasks
            .filter((task: any) => {
              // Basic filters
              if (!task.description || task.description.trim().length === 0) {
                return false;
              }

              // Text search filter
              if (
                !task.description
                  .toLowerCase()
                  .includes(focusedOption.value.toLowerCase())
              ) {
                return false;
              }

              // Context-aware filtering based on subcommand
              if (subcommand === 'disable') {
                // For disable command, only show enabled tasks
                return task.enabled === true;
              } else if (subcommand === 'enable') {
                // For enable command, only show disabled tasks
                return task.enabled === false;
              }

              // For other commands (delete, view, etc.), show all tasks
              return true;
            })
            .slice(0, 25) // Discord limit
            .map((task: any) => {
              const description = task.description.trim();
              // Add status indicator to the display name for better UX
              const statusIcon = task.enabled ? '🟢' : '🔴';
              const nameWithStatus = `${statusIcon} ${description}`;

              // Use truncated description as display name, but task ID as value for reliable lookup
              const name =
                nameWithStatus.length > 100
                  ? nameWithStatus.substring(0, 97) + '...'
                  : nameWithStatus;
              // Use task ID as value - this ensures exact lookup will work
              const value = task.id;
              return {
                name: name,
                value: value,
              };
            });
        }

        console.log('🎯 AUTOCOMPLETE CHOICES:', choices.length);
        await interaction.respond(choices);
        console.log('🎯 AUTOCOMPLETE RESPONSE SENT');
      } else {
        console.log('🎯 NON-TASK_NAME OPTION, RESPONDING WITH EMPTY');
        await interaction.respond([]);
      }
    } catch (error) {
      console.error('🎯 ERROR IN AUTOCOMPLETE:', error);
      await interaction.respond([]);
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
