import {
  BaseCommand,
  CommandResponse,
  CommandCategory,
} from '../../types/index.js';
import { MCPService } from '../../services/mcp/index.js';
import { OAuthAuthorizationRequiredError } from '../../services/mcp/auth.js';
import {
  EmbedBuilder,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  InteractionContextType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

export class MCPCommand extends BaseCommand {
  name = 'mcp';
  description = 'Manage Model Context Protocol (MCP) server connections';
  category = CommandCategory.UTILITY;

  constructor(private mcpService: MCPService) {
    super();
  }

  getSlashCommand(): SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List your connected servers'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('connect')
          .setDescription(
            'Connect to an MCP server (opens a private form for URL)',
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('reconnect')
          .setDescription(
            'Reconnect to an MCP server (disconnects first if connected)',
          )
          .addStringOption((option) =>
            option
              .setName('server-name')
              .setDescription('Name of the server to reconnect to')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('disconnect')
          .setDescription('Disconnect from an MCP server')
          .addStringOption((option) =>
            option
              .setName('server-name')
              .setDescription('Name of the server to disconnect from')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Permanently delete/remove an MCP server connection')
          .addStringOption((option) =>
            option
              .setName('server-name')
              .setDescription('Name of the server to permanently remove')
              .setRequired(true)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('tools')
          .setDescription('List available tools from connected servers'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('status').setDescription('Show MCP system status'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('debug')
          .setDescription('Show connection diagnostics (troubleshooting)'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('cleanup')
          .setDescription('Clean up stale/corrupted connections'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('repair')
          .setDescription(
            'Repair corrupted database records (fixes missing server_url)',
          ),
      )
      .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel,
      ]);
  }

  /**
   * Get the effective channel ID for MCP operations.
   * For DMs, returns 'dm' so all DM conversations share the same tool context.
   * If the interaction is in a thread, returns the parent channel ID.
   * Otherwise, returns the interaction's channel ID.
   */
  private async getEffectiveChannelId(
    interaction: ChatInputCommandInteraction,
  ): Promise<string> {
    // DMs share a unified tool context across all DM conversations
    if (!interaction.inGuild()) {
      return 'dm';
    }

    // Check if we're in a thread
    if (interaction.channel?.isThread()) {
      // Return the parent channel ID
      return interaction.channel.parentId || interaction.channelId;
    }
    // Not in a thread, use the regular channel ID
    return interaction.channelId;
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Special case: connect shows a modal, so don't defer
    if (subcommand === 'connect') {
      // Get the correct channel ID (parent channel if in a thread)
      const channelId = await this.getEffectiveChannelId(interaction);

      console.log('🔍 MCP executeSlash (connect):', {
        interactionId: interaction.id,
        userId: interaction.user.id,
        subcommand,
        channelId,
        isThread: interaction.channel?.isThread(),
      });

      // Show modal for URL input (keeps URL private)
      const modal = new ModalBuilder()
        .setCustomId(`mcp_connect_${interaction.user.id}`)
        .setTitle('Connect to MCP Server');

      const urlInput = new TextInputBuilder()
        .setCustomId('mcp_server_url')
        .setLabel('MCP Server URL')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://your-mcp-server.com')
        .setRequired(true);

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
        urlInput,
      );

      modal.addComponents(actionRow);

      await interaction.showModal(modal);
      return; // Modal submission will be handled separately
    }

    // CRITICAL: Defer FIRST, before ANY other processing (except connect)
    // Discord requires acknowledgment within 3 seconds
    let deferred = false;
    try {
      // Make connection-related commands ephemeral for privacy
      const ephemeralCommands = [
        'list',
        'tools',
        'reconnect',
        'disconnect',
        'delete',
      ];
      const shouldBeEphemeral = ephemeralCommands.includes(subcommand);
      await interaction.deferReply({ ephemeral: shouldBeEphemeral });
      deferred = true;
      console.log('✅ Successfully deferred MCP command');
    } catch (error) {
      console.error('❌ CRITICAL: Failed to defer MCP command:', error);
      // If we can't defer, we can't respond at all
      return;
    }

    // Get the correct channel ID (parent channel if in a thread)
    const channelId = await this.getEffectiveChannelId(interaction);

    console.log('🔍 MCP executeSlash:', {
      interactionId: interaction.id,
      userId: interaction.user.id,
      subcommand,
      deferred,
      channelId,
      isThread: interaction.channel?.isThread(),
    });

    let response: CommandResponse | void;

    try {
      // Route to existing handlers
      switch (subcommand) {
        case 'list':
          response = await this.handleList(interaction.user.id, channelId);
          break;
        case 'connect':
          // This case is now handled above before deferring
          return;
        case 'reconnect': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleReconnect(
            serverName,
            interaction.user.id,
            channelId,
          );
          break;
        }
        case 'disconnect': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleDisconnect(
            serverName,
            interaction.user.id,
            channelId,
          );
          break;
        }
        case 'delete': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleDelete(
            serverName,
            interaction.user.id,
            channelId,
          );
          break;
        }
        case 'tools':
          response = await this.handleTools(interaction.user.id, channelId);
          break;
        case 'status':
          response = await this.handleStatus();
          break;
        case 'debug':
          response = await this.handleDebug(interaction.user.id, channelId);
          break;
        case 'cleanup':
          response = await this.handleCleanup(interaction.user.id, channelId);
          break;
        case 'repair':
          response = await this.handleRepair(interaction.user.id, channelId);
          break;
        default:
          response = {
            content: `❌ Subcommand "${subcommand}" is not implemented.`,
          };
          break;
      }

      // Send the response using editReply since we deferred
      logger.info(`Sending response to Discord for subcommand ${subcommand}:`, {
        service: 'MCPCommand',
        hasContent: !!response?.content,
        hasEmbeds: !!response?.embeds,
        contentPreview: response?.content?.substring(0, 100),
      });

      if (response) {
        await interaction.editReply({
          content: response.content || undefined,
          embeds: response.embeds || undefined,
          files: response.files || undefined,
          components: response.components || undefined,
        });
        logger.info(
          `Successfully sent response to Discord for subcommand ${subcommand}`,
        );
      } else {
        await interaction.editReply({ content: '✅ Done.' });
        logger.info(
          `Sent default 'Done' response for subcommand ${subcommand}`,
        );
      }
    } catch (error) {
      console.error(`Error executing /mcp ${subcommand}:`, error);
      logger.error(
        `Outer catch block triggered for subcommand ${subcommand}`,
        error as Error,
        {
          service: 'MCPCommand',
        },
      );

      await interaction.editReply({
        content: '❌ An unexpected error occurred while running this command.',
      });
      logger.info(
        `Sent error response to Discord for subcommand ${subcommand}`,
      );
    }
  }

  private async handleList(
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      const connections = await this.mcpService.getUserConnections(
        userId,
        channelId,
      );

      if (connections.length === 0) {
        return {
          content:
            '📋 You have no MCP server connections. Use `/mcp connect <url>` to connect to a server.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Your MCP Connections')
        .setDescription(
          `You have ${connections.length} MCP server connection${connections.length !== 1 ? 's' : ''}`,
        )
        .setColor(0x00ae86);

      // Display connections without registry lookups
      for (const conn of connections) {
        const statusEmoji =
          conn.status === 'connected'
            ? '🟢'
            : conn.status === 'error'
              ? '🔴'
              : '🟡';
        const parsedTools = JSON.parse(conn.tools || '[]') as Tool[];

        // Use stored data directly
        const displayName = conn.server_name || 'Unknown Server';
        const description = conn.description || '';

        // Truncate error message to prevent Discord field value limit issues
        const truncatedError =
          conn.error_message && conn.error_message.length > 200
            ? conn.error_message.substring(0, 200) + '...'
            : conn.error_message;

        // Build value array with description and other details
        const valueLines = [
          description
            ? `**Description:** ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`
            : '',
          `**Status:** ${conn.status} | **Tools:** ${parsedTools.length}`,
          conn.server_url ? `**URL:** ${conn.server_url}` : '',
          truncatedError ? `**Error:** ${truncatedError}` : '',
          conn.last_connected
            ? `**Last Connected:** ${conn.last_connected.toDateString()}`
            : '',
        ].filter(Boolean);

        // Ensure the entire field value doesn't exceed Discord's 1024 character limit
        const fieldValue = valueLines.join('\n');
        const truncatedValue =
          fieldValue.length > 1024
            ? fieldValue.substring(0, 1021) + '...'
            : fieldValue;

        embed.addFields([
          {
            name: `${statusEmoji} ${displayName}`,
            value: truncatedValue,
            inline: false,
          },
        ]);
      }

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('MCP list error:', error);
      return {
        content:
          '❌ Error retrieving your connections. Please try again later.',
      };
    }
  }

  private async handleConnect(
    url: string,
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    if (!url) {
      return {
        content: '❌ Please provide a valid MCP server URL.',
      };
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) {
        return {
          content: '❌ URL must use HTTP or HTTPS protocol.',
        };
      }
    } catch (error) {
      return {
        content:
          '❌ Invalid URL format. Please provide a valid HTTP/HTTPS URL.',
      };
    }

    try {
      // Generate a simple UUID for this connection
      const serverId = randomUUID();

      logger.info(
        `Attempting to connect to MCP server at ${url} for user ${userId}`,
      );

      const connection = await this.mcpService.connectToServer(
        serverId,
        userId,
        url, // Pass the URL directly
        channelId, // Pass the actual channel ID
      );

      if (connection.status === 'connected') {
        return {
          content:
            `✅ Successfully connected to **${connection.server_name}**!\n` +
            `🔗 URL: ${url}\n` +
            `Use \`/mcp tools\` to see what you can do.`,
        };
      } else if (connection.status === 'auth-required') {
        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('🔐 Authorization Needed')
              .setDescription(
                `You need to authorize **${connection.server_name}** before tools can be used.\n\n` +
                  `**Next Steps:**\n` +
                  `• Check your DMs to authorize access.\n` +
                  `• Complete the sign-in / consent flow.\n`,
              )
              .setColor(0xff9500)
              .setFooter({
                text: 'OAuth flow in progress – callback & token persistence coming soon.',
              }),
          ],
        };
      } else {
        return {
          content: `❌ Failed to connect to server: ${connection.error_message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      logger.error(
        `MCP connect error for ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        content: `❌ Error connecting to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleReconnect(
    serverName: string,
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    if (!serverName) {
      return {
        content:
          '❌ Please provide a server name. Use `/mcp list` to see your connections.',
      };
    }

    try {
      // Resolve server name to ID
      const serverId = await this.mcpService.resolveServerNameToId(
        userId,
        serverName,
        channelId,
      );
      if (!serverId) {
        return {
          content: `❌ Could not find a connection with the name "${serverName}". Use \`/mcp list\` to see your connections.`,
        };
      }

      logger.info(
        `Attempting to reconnect to MCP server ${serverName} for user ${userId}`,
      );

      // Check current connection status from database
      const connections = await this.mcpService.getUserConnections(
        userId,
        channelId,
      );
      const currentConnection = connections.find(
        (conn: any) => conn.server_id === serverId,
      );

      // Only disconnect if the server is currently connected
      // Skip disconnect for error/disconnected states to avoid hanging
      if (currentConnection?.status === 'connected') {
        try {
          await this.mcpService.disconnectFromServer(
            serverId,
            userId,
            channelId,
          );
          logger.info(`Disconnected ${serverName} before reconnecting`);
        } catch (disconnectError) {
          logger.debug(
            `Disconnect before reconnect failed: ${disconnectError instanceof Error ? disconnectError.message : String(disconnectError)}`,
          );
        }
      } else {
        logger.info(
          `Skipping disconnect for ${serverName} - current status: ${currentConnection?.status || 'unknown'}`,
        );
      }

      const connection = await this.mcpService.autoReconnectAfterOAuth(
        serverId,
        userId,
        channelId,
      );

      logger.info(`Reconnect result for ${serverName}:`, {
        service: 'MCPCommand',
        success: connection.success,
        status: connection.status || 'undefined',
        message: connection.message || 'no message',
      });

      if (connection.success && connection.status === 'connected') {
        return {
          content:
            `✅ Successfully reconnected to **${serverName}**!\n` +
            `Use \`/mcp tools\` to see what you can do.`,
        };
      } else if (connection.status === 'auth-required') {
        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('🔐 Authorization Needed')
              .setDescription(
                `You need to authorize **${serverName}** before reconnecting.\n\n` +
                  `**Next Steps:**\n` +
                  `• Check your DMs to authorize access.\n` +
                  `• Complete the sign-in / consent flow.\n` +
                  `• Once authorized, the connection will be established automatically.\n`,
              )
              .setColor(0xff9500)
              .setFooter({
                text: 'Complete authorization to reconnect',
              }),
          ],
        };
      } else {
        return {
          content: `❌ Failed to reconnect to server: ${connection.message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      logger.error(
        `MCP reconnect error for ${serverName}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        content: `❌ Error reconnecting to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleDisconnect(
    serverName: string,
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    if (!serverName) {
      return {
        content:
          '❌ Please provide a server name. Use `/mcp list` to see your connections.',
      };
    }

    try {
      // Resolve server name to ID
      const serverId = await this.mcpService.resolveServerNameToId(
        userId,
        serverName,
        channelId,
      );
      if (!serverId) {
        return {
          content: `❌ Could not find a connection with the name "${serverName}". Use \`/mcp list\` to see your connections.`,
        };
      }

      await this.mcpService.disconnectFromServer(serverId, userId, channelId);
      return {
        content: `✅ Disconnected from server: **${serverName}**`,
      };
    } catch (error) {
      console.error('MCP disconnect error:', error);
      return {
        content: `❌ Error disconnecting from server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleDelete(
    serverName: string,
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    if (!serverName) {
      return {
        content:
          '❌ Please provide a server name. Use `/mcp list` to see your connections.',
      };
    }

    try {
      // Resolve server name to ID
      const serverId = await this.mcpService.resolveServerNameToId(
        userId,
        serverName,
        channelId,
      );
      if (!serverId) {
        return {
          content: `❌ Could not find a connection with the name "${serverName}". Use \`/mcp list\` to see your connections.`,
        };
      }

      await this.mcpService.deleteServerConnection(serverId, userId, channelId);
      return {
        content: `🗑️ Permanently deleted server connection: **${serverName}**\n\n⚠️ This action cannot be undone. All connection data and OAuth tokens have been removed.`,
      };
    } catch (error) {
      console.error('MCP delete error:', error);
      return {
        content: `❌ Error deleting server connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleTools(
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      const tools = await this.mcpService.getAvailableTools(userId, channelId);

      if (tools.length === 0) {
        return {
          content:
            '🔧 No tools available. Connect to MCP servers using `/mcp connect <server-id>` first.',
        };
      }

      // Group tools by server
      const toolsByServer = tools.reduce(
        (acc, tool) => {
          if (!acc[tool.server_name]) {
            acc[tool.server_name] = [];
          }
          acc[tool.server_name].push(tool);
          return acc;
        },
        {} as Record<string, typeof tools>,
      );

      let message = `🛠️ **Available MCP Tools**\n\nYou have access to **${tools.length} tools** from your connected servers.\n\n`;

      Object.entries(toolsByServer).forEach(([serverName, serverTools]) => {
        message += `🔌 **${serverName}**\n`;
        serverTools.forEach((tool) => {
          const displayName = tool.title || tool.name;
          message += `• **${displayName}**: ${tool.description}\n`;
        });
        message += '\n';
      });

      return { content: message };
    } catch (error) {
      console.error('MCP tools error:', error);
      return {
        content: '❌ Error retrieving available tools. Please try again later.',
      };
    }
  }

  private async handleStatus(): Promise<CommandResponse> {
    try {
      const status = await this.mcpService.getSystemStatus();

      const embed = new EmbedBuilder()
        .setTitle('📊 MCP System Status')
        .setColor(0x00ff00)
        .addFields(
          {
            name: '👥 Active Connections',
            value: status.userConnections.toString(),
            inline: true,
          },
          {
            name: '🛠️ Available Tools',
            value: status.availableTools.toString(),
            inline: true,
          },
        );

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('MCP status error:', error);
      return {
        content: '❌ Error retrieving system status. Please try again later.',
      };
    }
  }

  private async handleDebug(
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      const diagnostics = await this.mcpService.getConnectionDiagnostics(
        userId,
        channelId,
      );

      const embed = new EmbedBuilder()
        .setTitle('🔍 Connection Diagnostics')
        .setColor(0x00ffff)
        .addFields(
          {
            name: '💾 Database Connections',
            value:
              diagnostics.databaseConnections.length > 0
                ? diagnostics.databaseConnections
                    .map(
                      (conn) =>
                        `• ${conn.server_name || conn.server_id}: ${conn.status}`,
                    )
                    .join('\n')
                : 'No connections found in database',
            inline: false,
          },
          {
            name: '🔗 Active Connections Pool',
            value:
              diagnostics.activeConnections.activeConnectionCount > 0
                ? `Count: ${diagnostics.activeConnections.activeConnectionCount}\n` +
                  diagnostics.activeConnections.connectionDetails
                    .map(
                      (conn: any) =>
                        `• ${conn.poolKey}: ${conn.isActiveAttempted ? '✅ Active' : '❌ Inactive'} (${conn.currentTransportType || 'no transport'})`,
                    )
                    .join('\n')
                : 'No active connections in pool',
            inline: false,
          },
          {
            name: '⚠️ Mismatched Connections',
            value:
              diagnostics.mismatchedConnections.length > 0
                ? diagnostics.mismatchedConnections
                    .map((id) => `• ${id}`)
                    .join('\n')
                : '✅ All connections synchronized',
            inline: false,
          },
        )
        .setFooter({
          text: `Diagnostic run for user ${userId}`,
        });

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('Error getting connection diagnostics:', error);
      return {
        content: '❌ Failed to get connection diagnostics. Please try again.',
      };
    }
  }

  private async handleCleanup(
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      const result = await this.mcpService.cleanupStaleConnections(
        userId,
        channelId,
      );

      const embed = new EmbedBuilder()
        .setTitle('🧹 Connection Cleanup')
        .setColor(result.cleanedCount > 0 ? 0x00ff00 : 0x808080)
        .addFields(
          {
            name: '🗑️ Cleaned Up',
            value:
              result.cleanedCount > 0
                ? `${result.cleanedCount} stale connections removed:\n${result.cleanedConnections.map((id: string) => `• ${id}`).join('\n')}`
                : 'No stale connections found',
            inline: false,
          },
          {
            name: '✅ Remaining Active',
            value:
              result.remainingConnections > 0
                ? `${result.remainingConnections} healthy connections`
                : 'No active connections',
            inline: false,
          },
        )
        .setFooter({
          text: 'Cleanup completed successfully',
        });

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('Error cleaning up connections:', error);
      return {
        content: '❌ Failed to clean up connections. Please try again.',
      };
    }
  }

  private async handleRepair(
    userId: string,
    channelId: string,
  ): Promise<CommandResponse> {
    try {
      const result = await this.mcpService.repairCorruptedConnections(
        userId,
        channelId,
      );

      const embed = new EmbedBuilder()
        .setTitle('🔧 Connection Repair')
        .setColor(result.repairedCount > 0 ? 0x00ff00 : 0x808080)
        .addFields(
          {
            name: '🔧 Repaired Connections',
            value:
              result.repairedCount > 0
                ? result.repairedConnections
                    .map(
                      (repair: any) =>
                        `• **${repair.id}**\n  Issues: ${repair.issues.join(', ')}\n  Fixes: ${repair.fixes.join(', ')}`,
                    )
                    .join('\n\n')
                : 'No corrupted connections found',
            inline: false,
          },
          {
            name: '✅ Healthy Connections',
            value:
              result.healthyConnections > 0
                ? `${result.healthyConnections} connections already healthy`
                : 'No healthy connections',
            inline: false,
          },
        )
        .setFooter({
          text:
            result.repairedCount > 0
              ? 'Restart bot to reconnect repaired connections'
              : 'All connections are healthy',
        });

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('Error repairing connections:', error);
      return {
        content: '❌ Failed to repair connections. Please try again.',
      };
    }
  }

  async handleAutocomplete(
    interaction: AutocompleteInteraction,
  ): Promise<void> {
    console.log('🔗 MCP AUTOCOMPLETE HANDLER CALLED');
    const focusedOption = interaction.options.getFocused(true);
    console.log('🔗 FOCUSED OPTION:', focusedOption);

    try {
      if (focusedOption.name === 'server-name') {
        console.log('🔗 FETCHING MCP CONNECTIONS FOR AUTOCOMPLETE...');

        const subcommand = interaction.options.getSubcommand();
        console.log('🔗 SUBCOMMAND FOR FILTERING:', subcommand);

        // Get the correct channel ID - use 'dm' for DMs so they share tool context
        const channelId = !interaction.inGuild()
          ? 'dm'
          : interaction.channel?.isThread()
            ? interaction.channel.parentId || interaction.channelId
            : interaction.channelId;

        console.log('🔗 FETCHING CONNECTIONS FOR:', {
          userId: interaction.user.id,
          channelId,
          inGuild: interaction.inGuild(),
        });

        // Get user's connections for autocomplete
        let connections;
        try {
          connections = await this.mcpService.getUserConnections(
            interaction.user.id,
            channelId,
          );
        } catch (error) {
          console.error('🔗 ERROR FETCHING CONNECTIONS:', error);
          // Return empty on error
          await interaction.respond([]);
          return;
        }

        console.log('🔗 USER CONNECTIONS:', {
          connectionCount: connections.length,
          connections: connections.map((c) => ({
            name: c.server_name,
            status: c.status,
          })),
        });

        let choices: { name: string; value: string }[] = [];

        // Add a helpful suggestion if no text is entered yet
        if (focusedOption.value.length === 0) {
          choices.push({
            name: '💡 Type to search your connections',
            value: 'search-for-connections',
          });
        }

        if (connections.length > 0) {
          const connectionChoices = connections
            .filter((conn) => {
              // Basic filters
              if (!conn.server_name || conn.server_name.trim().length === 0) {
                return false;
              }

              // Text search filter
              if (
                !conn.server_name
                  .toLowerCase()
                  .includes(focusedOption.value.toLowerCase())
              ) {
                return false;
              }

              // Subcommand-specific filters
              switch (subcommand) {
                case 'reconnect':
                  // For reconnect, show all servers (will disconnect first if connected)
                  return true;

                case 'disconnect':
                  // For disconnect, only show connected servers
                  return conn.status === 'connected';

                case 'delete':
                  // For delete, show all servers regardless of status
                  return true;

                default:
                  return true;
              }
            })
            .slice(0, 24) // Leave room for the suggestion
            .map((conn) => ({
              name: `${conn.server_name} (${conn.status})`,
              value: conn.server_name,
            }));

          choices = choices.concat(connectionChoices);
        }

        console.log('🔗 AUTOCOMPLETE CHOICES:', choices);
        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('🔗 Error in MCP autocomplete:', error);
      // Fail gracefully with empty choices
      await interaction.respond([]);
    }
  }
}
