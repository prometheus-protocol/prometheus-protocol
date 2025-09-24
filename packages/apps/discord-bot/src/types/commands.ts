import {
  Message,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface CommandContext {
  message?: Message;
  interaction?: ChatInputCommandInteraction;
  args: string[];
  userId: string;
  channelId: string;
  guildId?: string;
}

export interface CommandResponse {
  content: string;
  ephemeral?: boolean;
  files?: any[];
  embeds?: any[];
  components?: any[]; // Support action rows (buttons) for richer UX
}

export abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract category: CommandCategory;

  // For slash commands
  abstract getSlashCommand():
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder;

  // For text commands
  abstract aliases?: string[];

  // Execute the command
  abstract execute(context: CommandContext): Promise<CommandResponse | void>;

  // Permission check
  canExecute(context: CommandContext): boolean {
    return true; // Override in subclasses for permissions
  }
}

export enum CommandCategory {
  CHAT = 'chat',
  ALERTS = 'alerts',
  UTILITY = 'utility',
  ADMIN = 'admin',
}

export interface CommandRegistry {
  register(command: BaseCommand): void;
  getCommand(name: string): BaseCommand | undefined;
  getCommandsByCategory(category: CommandCategory): BaseCommand[];
  getAllCommands(): BaseCommand[];
}
