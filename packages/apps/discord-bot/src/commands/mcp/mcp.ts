import {
  BaseCommand,
  CommandContext,
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
} from 'discord.js';

export class MCPCommand extends BaseCommand {
  name = 'mcp';
  description = 'Manage Model Context Protocol (MCP) server connections';
  category = CommandCategory.UTILITY;
  aliases = ['mcp'];

  usage = [
    '`!mcp search <query>` - Search for MCP servers',
    '`!mcp list` - List your connected servers',
    '`!mcp connect <server-id>` - Connect to an MCP server',
    '`!mcp disconnect <server-id>` - Disconnect from an MCP server',
    '`!mcp tools` - List available tools from connected servers',
    '`!mcp status` - Show MCP system status',
    '`!mcp authlink <server-id>` - Show full pending OAuth authorization URL',
  ];

  constructor(private mcpService: MCPService) {
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
              .setName('server-id')
              .setDescription('Server ID to connect to')
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('disconnect')
          .setDescription('Disconnect from an MCP server')
          .addStringOption((option) =>
            option
              .setName('server-id')
              .setDescription('Server ID to disconnect from')
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('tools')
          .setDescription('List available tools from connected servers'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('status').setDescription('Show MCP system status'),
      );
  }

  async execute(context: CommandContext): Promise<CommandResponse | void> {
    const { args, userId } = context;
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'search':
        return this.handleSearch(args.slice(1), context);
      case 'search-page':
        return this.handleSearchPage(args.slice(1), context);
      case 'list':
        return this.handleList(userId);
      case 'connect':
        return this.handleConnect(args[1], userId);
      case 'disconnect':
        return this.handleDisconnect(args[1], userId);
      case 'tools':
        return this.handleTools(userId);
      case 'status':
        return this.handleStatus();
      case 'authlink':
        return this.handleAuthLink(args[1], userId);
      case 'reset':
        return this.handleReset(args[1], userId);
      default:
        return this.handleHelp();
    }
  }

  async executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    console.log('🔍 MCP executeSlash called:', {
      interactionId: interaction.id,
      isDeferred: interaction.deferred,
      isReplied: interaction.replied,
      userId: interaction.user.id,
      subcommand,
    });

    // Acknowledge the interaction immediately - same pattern as chat command
    try {
      await interaction.deferReply();
      console.log(
        '✅ Successfully deferred reply for interaction:',
        interaction.id,
      );
    } catch (error) {
      console.error('❌ Failed to defer reply:', error);
      console.log('🔍 Interaction state when defer failed:', {
        interactionId: interaction.id,
        isDeferred: interaction.deferred,
        isReplied: interaction.replied,
        createdTimestamp: interaction.createdTimestamp,
        age: Date.now() - interaction.createdTimestamp,
      });
      return;
    }

    let response: CommandResponse | void;

    try {
      // Route to existing handlers
      switch (subcommand) {
        case 'search': {
          const query = interaction.options.getString('query') || '';
          const fakeContext = {
            userId: interaction.user.id,
            args: query.split(' '),
          } as CommandContext;
          response = await this.handleSearch(query.split(' '), fakeContext);
          break;
        }
        case 'list':
          response = await this.handleList(interaction.user.id);
          break;
        case 'connect': {
          const serverId = interaction.options.getString('server-id', true);
          response = await this.handleConnect(serverId, interaction.user.id);
          break;
        }
        case 'disconnect': {
          const serverId = interaction.options.getString('server-id', true);
          response = await this.handleDisconnect(serverId, interaction.user.id);
          break;
        }
        case 'tools':
          response = await this.handleTools(interaction.user.id);
          break;
        case 'status':
          response = await this.handleStatus();
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

  private async handleAuthLink(
    serverId: string,
    userId: string,
  ): Promise<CommandResponse> {
    if (!serverId) {
      return { content: '❌ Usage: `!mcp authlink <server-id>`' };
    }
    try {
      const pending = (this.mcpService as any).getPendingAuthorization?.(
        serverId,
        userId,
      );
      if (!pending) {
        return {
          content:
            'ℹ️ No pending authorization found for that server (maybe already authorized or never started).',
        };
      }
      return {
        content:
          '🔐 Full Authorization URL (copy & open in browser):\n' +
          pending.authUrl,
      };
    } catch (e) {
      return { content: '❌ Could not retrieve authorization URL.' };
    }
  }

  private async handleSearch(
    queryArgs: string[],
    context: CommandContext,
  ): Promise<CommandResponse> {
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
            `**Description:** ${server.description?.substring(0, 100)}${server.description?.length > 100 ? '...' : ''}`,
            `**Author:** ${server.author || 'Unknown'}`,
            `**Tags:** ${server.tags?.slice(0, 3).join(', ') || 'None'}${(server.tags?.length || 0) > 3 ? '...' : ''}`,
            `**Auth:** ${server.auth_type}`,
            `**Type:** ${server.hosted_on === 'icp' ? 'ICP Hosted' : 'External'}`,
          ].join('\n'),
          inline: false,
        });
      });

      if (servers.length > 5) {
        embed.setFooter({
          text: `Showing 5 of ${servers.length} results. Use !mcp connect <server-id> to connect.`,
        });
      }

      if (pagination?.hasNextPage) {
        embed.addFields({
          name: '📄 Pagination',
          value: `Use \`!mcp search-page ${query} ${pagination.currentPage + 1}\` for next page`,
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

  private async handleSearchPage(
    queryArgs: string[],
    context: CommandContext,
  ): Promise<CommandResponse> {
    if (queryArgs.length < 2) {
      return {
        content: '❌ Usage: !mcp search-page <query> <page-number>',
      };
    }

    const pageNumber = parseInt(queryArgs.pop() || '1', 10);
    const query = queryArgs.join(' ');

    if (isNaN(pageNumber) || pageNumber < 1) {
      return {
        content: '❌ Page number must be a positive integer.',
      };
    }

    try {
      const result = await this.mcpService.searchServers({
        query,
        limit: 10,
        page: pageNumber,
      });

      const { servers, pagination } = result;

      if (servers.length === 0) {
        return {
          content: '🔍 No MCP servers found on this page.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🌐 MCP Server Search Results')
        .setDescription(
          `Found ${pagination?.totalItems || servers.length} servers${query ? ` for: "${query}"` : ''}\n` +
            `Showing page ${pagination?.currentPage || pageNumber} of ${pagination?.totalPages || 1}`,
        )
        .setColor(0x00ae86);

      servers.slice(0, 5).forEach((server) => {
        embed.addFields({
          name: `🔌 ${server.name}`,
          value: [
            `**ID:** ${server.id}`,
            `**Description:** ${server.description?.substring(0, 100)}${server.description?.length > 100 ? '...' : ''}`,
            `**Author:** ${server.author || 'Unknown'}`,
            `**Tags:** ${server.tags?.slice(0, 3).join(', ') || 'None'}${(server.tags?.length || 0) > 3 ? '...' : ''}`,
            `**Auth:** ${server.auth_type}`,
            `**Type:** ${server.hosted_on === 'icp' ? 'ICP Hosted' : 'External'}`,
          ].join('\n'),
          inline: false,
        });
      });

      // Navigation controls
      const navigationFields = [];

      if (pagination?.hasPreviousPage) {
        navigationFields.push(
          `◀️ Previous: \`!mcp search-page ${query} ${pagination.currentPage - 1}\``,
        );
      }

      if (pagination?.hasNextPage) {
        navigationFields.push(
          `▶️ Next: \`!mcp search-page ${query} ${pagination.currentPage + 1}\``,
        );
      }

      if (navigationFields.length > 0) {
        embed.addFields({
          name: '📄 Navigation',
          value: navigationFields.join('\n'),
          inline: false,
        });
      }

      return { content: '', embeds: [embed] };
    } catch (error) {
      console.error('MCP search page error:', error);
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
            '📋 You have no MCP server connections. Use `!mcp search` to find servers to connect to.',
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Your MCP Connections')
        .setColor(0x00ae86);

      connections.forEach((conn) => {
        const statusEmoji =
          conn.status === 'connected'
            ? '🟢'
            : conn.status === 'error'
              ? '🔴'
              : '🟡';

        embed.addFields({
          name: `${statusEmoji} ${conn.server_name}`,
          value: [
            `**ID:** ${conn.server_id}`,
            `**Status:** ${conn.status}`,
            `**Tools:** ${conn.tools.length}`,
            conn.error_message ? `**Error:** ${conn.error_message}` : '',
            conn.last_connected
              ? `**Connected:** ${conn.last_connected.toDateString()}`
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
          inline: true,
        });
      });

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
    serverId: string,
    userId: string,
  ): Promise<CommandResponse> {
    if (!serverId) {
      return {
        content:
          '❌ Please provide a server ID. Use `!mcp search` to find servers.',
      };
    }

    try {
      const connection = await this.mcpService.connectToServer(
        serverId,
        userId,
      );

      if (connection.status === 'connected') {
        return {
          content:
            `✅ Successfully connected to **${connection.server_name}**!\n` +
            `� Tools are being discovered... Just a moment!\n` +
            `Use \`!mcp tools\` to see what you can do.`,
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
                    `• Then run \`!mcp connect ${serverId}\` again.\n\n`,
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
            content: `🔐 Authorization required for **${connection.server_name}**. Awaiting authorization URL (try again shortly) then rerun \`!mcp connect ${serverId}\`.`,
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
                  `• Return here and run \`!mcp connect ${serverId}\` again.\n\n` +
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
            `• Use \`!mcp search <query>\` to find available servers\n` +
            `• Copy the exact ID from search results\n` +
            `• Try \`!mcp search github\` for GitHub-related servers`,
        };
      }

      return {
        content: `❌ Error connecting to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleDisconnect(
    serverId: string,
    userId: string,
  ): Promise<CommandResponse> {
    if (!serverId) {
      return {
        content:
          '❌ Please provide a server ID. Use `!mcp list` to see your connections.',
      };
    }

    try {
      await this.mcpService.disconnectFromServer(serverId, userId);
      return {
        content: `✅ Disconnected from server: ${serverId}`,
      };
    } catch (error) {
      console.error('MCP disconnect error:', error);
      return {
        content: `❌ Error disconnecting from server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleTools(userId: string): Promise<CommandResponse> {
    try {
      const tools = await this.mcpService.getAvailableTools(userId);

      if (tools.length === 0) {
        return {
          content:
            '🔧 No tools available. Connect to MCP servers using `!mcp connect <server-id>` first.',
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

  private async handleReset(
    serverId: string,
    userId: string,
  ): Promise<CommandResponse> {
    if (!serverId) {
      return {
        content:
          '❌ Please provide a server ID to reset. Use `/mcp reset <server-id>`',
      };
    }

    try {
      console.log(
        `🔄 [MCP] Resetting OAuth data for server ${serverId} and user ${userId}`,
      );

      // Use MCP service to reset all data
      await this.mcpService.resetServerData(serverId, userId);
      console.log(`🔄 [MCP] Reset complete via MCP service`);

      return {
        content: `✅ **Reset Complete**\n\nCleared all stored data for server \`${serverId}\`:\n- OAuth tokens\n- OAuth client info\n- Connection data\n\nYou can now connect fresh with \`/mcp connect ${serverId}\``,
      };
    } catch (error) {
      console.error(`Error resetting server ${serverId}:`, error);
      return {
        content: `❌ Failed to reset server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private handleHelp(): CommandResponse {
    const embed = new EmbedBuilder()
      .setTitle('🔌 MCP (Model Context Protocol) Commands')
      .setDescription(
        'Connect to and manage MCP servers for enhanced AI capabilities.',
      )
      .setColor(0x00ae86)
      .addFields(
        {
          name: '🔍 Discovery',
          value:
            '`!mcp search <query>` - Search for MCP servers\n`!mcp search-page <query> <page>` - Navigate search pages\n`!mcp status` - Show system status',
          inline: false,
        },
        {
          name: '🔗 Connection Management',
          value:
            '`!mcp list` - List your connections\n`!mcp connect <id>` - Connect to server\n`!mcp disconnect <id>` - Disconnect from server',
          inline: false,
        },
        {
          name: '🛠️ Tools',
          value:
            '`!mcp tools` - List available tools\n\n💡 **Tip:** Connected MCP tools are automatically available in AI chats!',
          inline: false,
        },
      );

    return { content: '', embeds: [embed] };
  }
}
