import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  args: string[];
  userId: string;
  channelId: string;
  guildId?: string;
  threadId?: string; // Optional: thread ID for posting alerts when in a thread
}

export interface CommandResponse {
  content: string;
  ephemeral?: boolean;
  files?: any[];
  embeds?: any[];
  components?: any[]; // Support action rows (buttons) for richer UX
  additionalMessages?: string[]; // For responses that need to be split into multiple messages
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

  // Execute slash command - now required
  abstract executeSlash(
    interaction: ChatInputCommandInteraction,
  ): Promise<void>;

  // Handle autocomplete interactions - optional
  handleAutocomplete?(interaction: AutocompleteInteraction): Promise<void>;

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
