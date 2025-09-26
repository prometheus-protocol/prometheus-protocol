import {
  BaseCommand,
  CommandResponse,
  CommandCategory,
} from '../../types/index.js';
import { MCPService } from '../../services/mcp/index.js';
import { RegistryService } from '../../services/registry.service.js';
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
} from 'discord.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export class MCPCommand extends BaseCommand {
  name = 'mcp';
  description = 'Manage Model Context Protocol (MCP) server connections';
  category = CommandCategory.UTILITY;

  constructor(
    private mcpService: MCPService,
    private registryService: RegistryService,
  ) {
    super();
  }

  getSlashCommand(): SlashCommandSubcommandsOnlyBuilder {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('search')
          .setDescription('Search for MCP servers')
          .addStringOption((option) =>
            option
              .setName('query')
              .setDescription('Search query')
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List your connected servers'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('connect')
          .setDescription('Connect to an MCP server')
          .addStringOption((option) =>
            option
              .setName('server-name')
              .setDescription('Name of the server to connect to')
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

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    // IMMEDIATELY acknowledge the interaction - before any other processing
    try {
      await interaction.deferReply();
    } catch (error) {
      console.error('❌ Failed to defer reply immediately:', error);
      // Try immediate reply as fallback
      try {
        await interaction.reply({
          content: '❌ Command processing failed. Please try again.',
          ephemeral: true,
        });
      } catch (replyError) {
        console.error('❌ Failed to send any response:', replyError);
      }
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    console.log('🔍 MCP executeSlash called:', {
      interactionId: interaction.id,
      isDeferred: interaction.deferred,
      isReplied: interaction.replied,
      userId: interaction.user.id,
      subcommand,
    });

    let response: CommandResponse | void;

    try {
      // Route to existing handlers
      switch (subcommand) {
        case 'search': {
          const query = interaction.options.getString('query') || '';
          response = await this.handleSearch(query.split(' '));
          break;
        }
        case 'list':
          response = await this.handleList(interaction.user.id);
          break;
        case 'connect': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleConnect(serverName, interaction.user.id);
          break;
        }
        case 'disconnect': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleDisconnect(
            serverName,
            interaction.user.id,
          );
          break;
        }
        case 'delete': {
          const serverName = interaction.options.getString('server-name', true);
          response = await this.handleDelete(serverName, interaction.user.id);
          break;
        }
        case 'tools':
          response = await this.handleTools(interaction.user.id);
          break;
        case 'status':
          response = await this.handleStatus();
          break;
        case 'debug':
          response = await this.handleDebug(interaction.user.id);
          break;
        case 'cleanup':
          response = await this.handleCleanup(interaction.user.id);
          break;
        case 'repair':
          response = await this.handleRepair(interaction.user.id);
          break;
        default:
          response = {
            content: `❌ Subcommand "${subcommand}" is not implemented.`,
          };
          break;
      }

      // Send the response using editReply since we deferred
      if (response) {
        await interaction.editReply({
          content: response.content || undefined,
          embeds: response.embeds || undefined,
          files: response.files || undefined,
          components: response.components || undefined,
        });
      } else {
        await interaction.editReply({ content: '✅ Done.' });
      }
    } catch (error) {
      console.error(`Error executing /mcp ${subcommand}:`, error);

      await interaction.editReply({
        content: '❌ An unexpected error occurred while running this command.',
      });
    }
  }

  private async handleSearch(queryArgs: string[]): Promise<CommandResponse> {
    const query = queryArgs.join(' ');

    try {
      // Use the new search API with pagination
      const result = await this.mcpService.searchServers({
        query,
        limit: 10,
        page: 1,
      });

      const { servers, pagination } = result;

      if (servers.length === 0) {
        return {
          content: '🔍 No MCP servers found matching your query.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🌐 MCP Server Search Results')
        .setDescription(
          `Found ${pagination?.totalItems || servers.length} servers${query ? ` for: "${query}"` : ''}\n` +
            `Showing page ${pagination?.currentPage || 1} of ${pagination?.totalPages || 1}`,
        )
        .setColor(0x00ae86);

      servers.slice(0, 5).forEach((server) => {
        embed.addFields({
          name: `🔌 ${server.name}`,
          value: [
            `**ID:** ${server.id}`,
            `**Description:** ${server.description?.substring(0, 150)}${server.description?.length > 150 ? '...' : ''}`,
            `**URL:** ${server.url}`,
          ].join('\n'),
          inline: false,
        });
      });

      if (servers.length > 5) {
        embed.setFooter({
          text: `Showing 5 of ${servers.length} results. Use /mcp connect <server-name> to connect.`,
        });
      }

      if (pagination?.hasNextPage) {
        embed.addFields({
          name: '📄 More Results',
          value: `There are ${pagination.totalItems - pagination.currentPage * 10} more servers. Try refining your search query.`,
          inline: false,
        });
      }

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('MCP search error:', error);
      return {
        content: '❌ Error searching MCP servers. Please try again later.',
      };
    }
  }

  private async handleList(userId: string): Promise<CommandResponse> {
    try {
      const connections = await this.mcpService.getUserConnections(userId);

      if (connections.length === 0) {
        return {
          content:
            '📋 You have no MCP server connections. Use `/mcp search` to find servers to connect to.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Your MCP Connections')
        .setDescription(
          `You have ${connections.length} MCP server connection${connections.length !== 1 ? 's' : ''}`,
        )
        .setColor(0x00ae86);

      // Enrich connections with registry data for better display names and descriptions
      for (const conn of connections) {
        const statusEmoji =
          conn.status === 'connected'
            ? '🟢'
            : conn.status === 'error'
              ? '🔴'
              : '🟡';
        const parsedTools = JSON.parse(conn.tools || '[]') as Tool[];

        // Try to get server info from registry for better name and description
        let displayName = conn.server_name || 'Unknown Server';
        let description = conn.description || '';

        try {
          // First try to get server info from registry using server_id
          const registryResult = await this.registryService.searchServers({
            limit: 100,
          });
          const registryServer = registryResult.servers.find(
            (s: any) => s.id === conn.server_id,
          );

          if (registryServer) {
            // Use registry data for better display
            displayName = registryServer.name || displayName;
            description = registryServer.description || description;
          }
        } catch (error) {
          // If registry lookup fails, use the stored data
          console.warn(
            'Could not fetch registry data for server:',
            conn.server_id,
          );
        }

        // Build value array with description and other details
        const valueLines = [
          `**ID:** ${conn.server_id}`,
          description
            ? `**Description:** ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}`
            : '',
          `**Status:** ${conn.status} | **Tools:** ${parsedTools.length}`,
          conn.server_url ? `**URL:** ${conn.server_url}` : '',
          conn.error_message ? `**Error:** ${conn.error_message}` : '',
          conn.last_connected
            ? `**Last Connected:** ${conn.last_connected.toDateString()}`
            : '',
        ].filter(Boolean);

        embed.addFields({
          name: `${statusEmoji} ${displayName}`,
          value: valueLines.join('\n'),
          inline: false,
        });
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
    serverName: string,
    userId: string,
  ): Promise<CommandResponse> {
    if (!serverName) {
      return {
        content:
          '❌ Please provide a server name. Use `/mcp search` to find servers.',
      };
    }

    try {
      // First, try to resolve the server name to an ID for existing connections
      let serverId = await this.mcpService.resolveServerNameToId(
        userId,
        serverName,
      );

      // If not found in user's connections, it might be a server they want to connect to from search results
      // In this case, we need to handle it differently - the serverName might be a search result
      if (!serverId) {
        // For new connections from search results, the serverName might actually be the server ID
        // This maintains backward compatibility with search results
        serverId = serverName;
      }

      const connection = await this.mcpService.connectToServer(
        serverId,
        userId,
      );

      if (connection.status === 'connected') {
        return {
          content:
            `✅ Successfully connected to **${connection.server_name}**!\n` +
            `Use \`/mcp tools\` to see what you can do.`,
        };
      } else if (connection.status === 'auth-required') {
        const authUrl = (connection as any).auth_url;
        if (authUrl) {
          return {
            content: '',
            embeds: [
              new EmbedBuilder()
                .setTitle('🔐 Authorization Needed')
                .setDescription(
                  `You still need to authorize **${connection.server_name}** before tools can be used.\n\n` +
                    `**Next Steps:**\n` +
                    `• Click the button below to authorize access.\n` +
                    `• Complete the sign-in / consent flow.\n` +
                    `• Then run \`/mcp connect ${serverId}\` again.\n\n`,
                )
                .setColor(0xff9500)
                .setFooter({
                  text: 'OAuth flow in progress – callback & token persistence coming soon.',
                }),
            ],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Link)
                  .setLabel('Authorize Access')
                  .setURL(authUrl),
              ),
            ],
          };
        } else {
          return {
            content: `🔐 Authorization required for **${connection.server_name}**. Awaiting authorization URL (try again shortly) then rerun \`/mcp connect ${serverId}\`.`,
          };
        }
      } else {
        return {
          content: `❌ Failed to connect to server: ${connection.error_message || 'Unknown error'}`,
        };
      }
    } catch (error) {
      console.error('MCP connect error:', error);

      if (error instanceof OAuthAuthorizationRequiredError) {
        const authUrl = error.authUrl;
        const prettyUrl = (() => {
          if (!authUrl) return 'Unknown URL';
          try {
            const u = new URL(authUrl);
            return `${u.origin}${u.pathname}`;
          } catch {
            return authUrl.split('?')[0];
          }
        })();
        return {
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('🔐 Authorization Needed')
              .setDescription(
                `The server requires you to authorize access before tools can be used.\n\n` +
                  `**Next Steps:**\n` +
                  `• Click the button below to open the authorization page.\n` +
                  `• Complete the sign-in / consent flow.\n` +
                  `• Return here and run \`/mcp connect ${serverName}\` again.\n\n` +
                  `URL: ${prettyUrl}`,
              )
              .setColor(0xff9500)
              .setFooter({
                text: 'OAuth flow in progress – callback & token persistence coming soon.',
              }),
          ],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Authorize Access')
                .setURL(authUrl || 'https://example.com'),
            ),
          ],
        };
      }

      // If it's a "server not found" error, provide helpful suggestions
      if (
        error instanceof Error &&
        error.message.includes('Server not found')
      ) {
        return {
          content:
            `❌ ${error.message}\n\n` +
            `💡 **Tips:**\n` +
            `• Use \`/mcp search <query>\` to find available servers\n` +
            `• Copy the exact ID from search results\n` +
            `• Try \`/mcp search github\` for GitHub-related servers`,
        };
      }

      return {
        content: `❌ Error connecting to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleDisconnect(
    serverName: string,
    userId: string,
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
      );
      if (!serverId) {
        return {
          content: `❌ Could not find a connection with the name "${serverName}". Use \`/mcp list\` to see your connections.`,
        };
      }

      await this.mcpService.disconnectFromServer(serverId, userId);
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
      );
      if (!serverId) {
        return {
          content: `❌ Could not find a connection with the name "${serverName}". Use \`/mcp list\` to see your connections.`,
        };
      }

      await this.mcpService.deleteServerConnection(serverId, userId);
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

  private async handleTools(userId: string): Promise<CommandResponse> {
    try {
      const tools = await this.mcpService.getAvailableTools(userId);

      if (tools.length === 0) {
        return {
          content:
            '🔧 No tools available. Connect to MCP servers using `/mcp connect <server-id>` first.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🛠️ Available MCP Tools')
        .setDescription(
          `You have access to ${tools.length} tools from your connected servers.`,
        )
        .setColor(0x00ae86);

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

      Object.entries(toolsByServer).forEach(([serverName, serverTools]) => {
        const toolList = serverTools
          .map((tool) => `• **${tool.name}**: ${tool.description}`)
          .join('\n');
        embed.addFields({
          name: `🔌 ${serverName}`,
          value:
            toolList.length > 1024
              ? toolList.substring(0, 1021) + '...'
              : toolList,
          inline: false,
        });
      });

      return { content: '', embeds: [embed] };
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
        .setColor(status.registryConnected ? 0x00ff00 : 0xff0000)
        .addFields(
          {
            name: '🌐 Registry Connection',
            value: status.registryConnected
              ? '🟢 Connected'
              : '🔴 Disconnected',
            inline: true,
          },
          {
            name: '🔌 Available Servers',
            value: status.totalServers.toString(),
            inline: true,
          },
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

  private async handleDebug(userId: string): Promise<CommandResponse> {
    try {
      const diagnostics =
        await this.mcpService.getConnectionDiagnostics(userId);

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

  private async handleCleanup(userId: string): Promise<CommandResponse> {
    try {
      const result = await this.mcpService.cleanupStaleConnections(userId);

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

  private async handleRepair(userId: string): Promise<CommandResponse> {
    try {
      const result = await this.mcpService.repairCorruptedConnections(userId);

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

        // Get user's connections for autocomplete
        const connections = await this.mcpService.getUserConnections(
          interaction.user.id,
        );
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
            name: '💡 Type to search your connections, or paste server ID from /mcp search',
            value: 'search-for-servers',
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
                case 'connect':
                  // For connect, only show servers that are not connected
                  return conn.status !== 'connected';

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
