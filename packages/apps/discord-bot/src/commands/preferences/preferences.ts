import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  InteractionContextType,
  EmbedBuilder,
} from 'discord.js';
import {
  BaseCommand,
  CommandResponse,
  CommandCategory,
  DatabaseService,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class PreferencesCommand extends BaseCommand {
  name = 'timezone';
  description = 'Set or view your timezone for better AI assistance';
  category = CommandCategory.UTILITY;

  constructor(private database: DatabaseService) {
    super();
  }

  getSlashCommand(): SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set')
          .setDescription(
            'Set your timezone (e.g., America/New_York, Europe/London, Asia/Tokyo)',
          )
          .addStringOption((option) =>
            option
              .setName('timezone')
              .setDescription('Your timezone - start typing to search')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('view')
          .setDescription('View your current timezone setting'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('clear')
          .setDescription('Clear your timezone preference'),
      )
      .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel,
      ]);
  }

  async handleAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'timezone') {
      const query = focusedOption.value.toLowerCase();

      // Popular timezones organized by region
      const popularTimezones = [
        // North America
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Phoenix',
        'America/Anchorage',
        'Pacific/Honolulu',
        'America/Toronto',
        'America/Vancouver',
        'America/Mexico_City',

        // Europe
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Europe/Rome',
        'Europe/Madrid',
        'Europe/Amsterdam',
        'Europe/Brussels',
        'Europe/Vienna',
        'Europe/Stockholm',
        'Europe/Moscow',
        'Europe/Istanbul',
        'Europe/Athens',

        // Asia
        'Asia/Tokyo',
        'Asia/Seoul',
        'Asia/Shanghai',
        'Asia/Hong_Kong',
        'Asia/Singapore',
        'Asia/Bangkok',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Jakarta',
        'Asia/Manila',

        // Australia & Pacific
        'Australia/Sydney',
        'Australia/Melbourne',
        'Australia/Brisbane',
        'Australia/Perth',
        'Pacific/Auckland',
        'Pacific/Fiji',

        // South America
        'America/Sao_Paulo',
        'America/Buenos_Aires',
        'America/Santiago',
        'America/Lima',

        // Africa
        'Africa/Cairo',
        'Africa/Johannesburg',
        'Africa/Lagos',
        'Africa/Nairobi',
      ];

      // Filter timezones based on user input
      let filtered = popularTimezones;

      if (query.length > 0) {
        filtered = popularTimezones.filter((tz) => {
          const tzLower = tz.toLowerCase();
          const city = tz.split('/')[1]?.toLowerCase() || '';
          const continent = tz.split('/')[0]?.toLowerCase() || '';

          // Match against full timezone, city name, or continent
          return (
            tzLower.includes(query) ||
            city.includes(query) ||
            continent.includes(query)
          );
        });
      }

      // Limit to 25 choices (Discord's limit)
      const choices = filtered.slice(0, 25).map((tz) => ({
        name: tz.replace('_', ' '),
        value: tz,
      }));

      await interaction.respond(choices);
    }
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ ephemeral: true });

      let response: CommandResponse;

      switch (subcommand) {
        case 'set': {
          const timezone = interaction.options.getString('timezone', true);
          response = await this.handleSetTimezone(
            interaction.user.id,
            timezone,
          );
          break;
        }
        case 'view':
          response = await this.handleViewTimezone(interaction.user.id);
          break;
        case 'clear':
          response = await this.handleClearTimezone(interaction.user.id);
          break;
        default:
          response = {
            content: `❌ Subcommand "${subcommand}" is not implemented.`,
          };
          break;
      }

      await interaction.editReply({
        content: response.content || undefined,
        embeds: response.embeds || undefined,
      });
    } catch (error) {
      logger.error('Error executing timezone command', error as Error, {
        service: 'TimezoneCommand',
        userId: interaction.user.id,
        subcommand,
      });

      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(`❌ Error: ${errorMessage}`);
        } else {
          await interaction.reply({
            content: `❌ Error: ${errorMessage}`,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error message', replyError as Error, {
          service: 'TimezoneCommand',
        });
      }
    }
  }

  private async handleSetTimezone(
    userId: string,
    timezone: string,
  ): Promise<CommandResponse> {
    try {
      // Validate timezone format
      if (!this.isValidTimezone(timezone)) {
        return {
          content: `❌ Invalid timezone format. Please use IANA timezone format (e.g., \`America/New_York\`, \`Europe/London\`, \`Asia/Tokyo\`).\n\nYou can find your timezone at: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`,
        };
      }

      // Get existing preferences
      const existingPrefs = await this.database.getUserPreferences(userId);

      // Update with new timezone
      const updatedPrefs = {
        ...existingPrefs,
        timezone: timezone,
      };

      await this.database.saveUserPreferences(userId, updatedPrefs);

      // Get current time in the user's timezone for confirmation
      const currentTime = this.getCurrentTimeInTimezone(timezone);

      return {
        content: `✅ Timezone set to **${timezone}**\n\nYour current local time: **${currentTime}**\n\nThe AI will now use your timezone when discussing times and dates.`,
      };
    } catch (error) {
      logger.error('Error setting timezone', error as Error, {
        service: 'TimezoneCommand',
        userId,
        timezone,
      });
      return {
        content: '❌ Failed to set timezone. Please try again later.',
      };
    }
  }

  private async handleViewTimezone(userId: string): Promise<CommandResponse> {
    try {
      const prefs = await this.database.getUserPreferences(userId);

      if (!prefs || !prefs.timezone) {
        return {
          content:
            '📋 You have no timezone set.\n\nUse `/timezone set <timezone>` to set your timezone.\n\nFind your timezone at: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
        };
      }

      const currentTime = this.getCurrentTimeInTimezone(prefs.timezone);

      const embed = new EmbedBuilder()
        .setTitle('🌍 Your Timezone')
        .setColor(0x5865f2)
        .setDescription(`**${prefs.timezone}**\n\nCurrent time: ${currentTime}`)
        .setTimestamp();

      return {
        content: '',
        embeds: [embed],
      };
    } catch (error) {
      logger.error('Error viewing timezone', error as Error, {
        service: 'TimezoneCommand',
        userId,
      });
      return {
        content: '❌ Failed to retrieve timezone. Please try again later.',
      };
    }
  }

  private async handleClearTimezone(userId: string): Promise<CommandResponse> {
    try {
      // Get existing preferences and remove timezone
      const existingPrefs = await this.database.getUserPreferences(userId);
      const updatedPrefs = { ...existingPrefs };
      delete updatedPrefs.timezone;

      await this.database.saveUserPreferences(userId, updatedPrefs);

      return {
        content: '✅ Timezone preference cleared successfully.',
      };
    } catch (error) {
      logger.error('Error clearing timezone', error as Error, {
        service: 'TimezoneCommand',
        userId,
      });
      return {
        content: '❌ Failed to clear timezone. Please try again later.',
      };
    }
  }

  /**
   * Validate timezone string - basic check for IANA format
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      // Try to format a date with the timezone
      // This will throw if the timezone is invalid
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      }).format(new Date());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current time in the specified timezone
   */
  private getCurrentTimeInTimezone(timezone: string): string {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
      return formatter.format(now);
    } catch (error) {
      return 'Unable to determine current time';
    }
  }
}
