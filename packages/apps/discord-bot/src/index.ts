import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import express, { Request, Response } from 'express';
import { ConfigManager } from './config/index.js';
import { CommandRegistryImpl } from './commands/registry.js';
import { ChatCommand } from './commands/chat/chat.js';
import { MCPCommand } from './commands/mcp/mcp.js';
import { LLMService } from './services/llm.js';
import { SupabaseService } from './services/database.js';
import { AlertScheduler } from './services/scheduler.js';
import { TaskManagementFunctions } from './ai-functions/task-management.js';
import { MCPService } from './services/mcp/index.js';
import { DiscordNotificationService } from './services/discord-notification.service.js';
import { MCPEventService } from './services/event-emitter.service.js';
import { ConnectionPoolService } from './services/connections.js';
import { MCPCoordinatorService } from './services/mcp-coordinator.service.js';
import { RegistryService } from './services/registry.service.js';
import { CommandContext } from './types/index.js';
import { auth } from './mcp/oauth.js';
import { ConnectionManagerOAuthProvider } from './mcp/oauth-provider.js';

class DiscordBot {
  private client: Client;
  private config: ConfigManager;
  private commandRegistry: CommandRegistryImpl;
  private llmService: LLMService;
  private database: SupabaseService;
  private scheduler: AlertScheduler;
  private taskFunctions: TaskManagementFunctions;
  private mcpService: MCPService;
  private discordNotification: DiscordNotificationService;
  private mcpEventService: MCPEventService;
  private connectionPool: ConnectionPoolService;
  private mcpCoordinator: MCPCoordinatorService;
  private registryService: RegistryService;
  private webApp = express();
  private webServer?: any;

  constructor() {
    this.config = new ConfigManager();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.commandRegistry = new CommandRegistryImpl();
    this.database = new SupabaseService(this.config);

    // Initialize Discord notification service
    this.discordNotification = new DiscordNotificationService(this.client);

    // Initialize MCP services in dependency order
    this.mcpEventService = new MCPEventService();
    this.connectionPool = new ConnectionPoolService(
      this.database,
      this.mcpEventService,
    );
    this.mcpCoordinator = new MCPCoordinatorService(
      this.mcpEventService,
      this.database,
      this.discordNotification,
    );
    this.registryService = new RegistryService();

    // Initialize MCP service with all required dependencies
    this.mcpService = new MCPService(
      this.database,
      this.mcpEventService,
      this.connectionPool,
      this.mcpCoordinator,
      this.registryService,
      this.discordNotification,
    );

    // Initialize the MCP service after all dependencies are set up
    this.mcpService.initialize();

    this.llmService = new LLMService(this.config, this.mcpService);
    this.scheduler = new AlertScheduler(
      this.client,
      this.database,
      this.config,
      this.llmService,
    );
    this.taskFunctions = new TaskManagementFunctions(
      this.scheduler,
      this.database,
    );

    this.setupEventHandlers();
    this.registerCommands();
    this.setupWebServer();
  }

  private setupEventHandlers(): void {
    this.client.on(Events.ClientReady, async () => {
      if (this.client.user) {
        console.log(`✅ Bot logged in as ${this.client.user.tag}!`);
        console.log(
          `🤖 AI Function Calling enabled with ${this.taskFunctions.getFunctions().length} functions`,
        );
        console.log(
          `� Task management system ready with prompt-based monitoring`,
        );

        // Check MCP system status
        try {
          const mcpStatus = await this.mcpService.getSystemStatus();
          console.log(
            `🔌 MCP Registry: ${mcpStatus.registryConnected ? 'Connected' : 'Disconnected'}`,
          );
          console.log(`🌐 Available MCP Servers: ${mcpStatus.totalServers}`);
        } catch (error) {
          console.error('⚠️ MCP system initialization error:', error);
        }

        // Start scheduler with alert loading
        try {
          await this.scheduler.start();
        } catch (error) {
          console.error('⚠️ Scheduler initialization error:', error);
        }

        // Reestablish persistent MCP connections
        try {
          await this.mcpService.reestablishPersistentConnections();
        } catch (error) {
          console.error('⚠️ MCP connection reestablishment error:', error);
        }
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      // Handle text commands (starting with !)
      if (message.content.startsWith('!')) {
        const args = message.content.slice(1).split(' ');
        const commandName = args.shift()?.toLowerCase();

        if (commandName) {
          const command = this.commandRegistry.getCommand(commandName);
          if (command) {
            const context: CommandContext = {
              message,
              args,
              userId: message.author.id,
              channelId: message.channel.id,
              guildId: message.guild?.id,
            };

            try {
              const response = await command.execute(context);
              if (response) {
                await message.reply({
                  content: response.content || undefined,
                  embeds: response.embeds || undefined,
                  files: response.files || undefined,
                  components: response.components || undefined,
                });
              }
            } catch (error) {
              console.error('Error executing command:', error);
              await message.reply(
                'Sorry, an error occurred while executing that command.',
              );
            }
          }
        }
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commandRegistry.getCommand(interaction.commandName);
      if (!command) {
        await interaction.reply({
          content: 'Command not found!',
          ephemeral: true,
        });
        return;
      }

      const context: CommandContext = {
        interaction,
        args: [],
        userId: interaction.user.id,
        channelId: interaction.channel?.id || '',
        guildId: interaction.guild?.id,
      };

      try {
        const response = await command.execute(context);
        if (response) {
          if (interaction.deferred) {
            await interaction.editReply({
              content: response.content || undefined,
              embeds: response.embeds || undefined,
              files: response.files || undefined,
              components: response.components || undefined,
            });
          } else {
            await interaction.reply({
              content: response.content || undefined,
              embeds: response.embeds || undefined,
              files: response.files || undefined,
              ephemeral: response.ephemeral,
              components: response.components || undefined,
            });
          }
        }
      } catch (error) {
        console.error('Error executing slash command:', error);
        const errorMessage =
          'Sorry, an error occurred while executing that command.';

        if (interaction.deferred) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
    });
  }

  private registerCommands(): void {
    // Register AI-powered chat command with task management capabilities
    this.commandRegistry.register(
      new ChatCommand(this.llmService, this.taskFunctions, this.database),
    );

    // Register MCP management command
    this.commandRegistry.register(new MCPCommand(this.mcpService));

    console.log(
      `📝 Registered ${this.commandRegistry.getAllCommands().length} commands`,
    );
  }

  private async handleAutoReconnectAfterOAuth(
    serverId: string,
    userId: string,
  ): Promise<void> {
    try {
      console.log(
        `🔄 [AutoReconnect] Starting auto-reconnect for server=${serverId}, user=${userId}`,
      );

      // Attempt auto-reconnect
      const result = await this.mcpService.autoReconnectAfterOAuth(
        serverId,
        userId,
      );

      // Try to find the user and send them a direct message
      try {
        const user = await this.client.users.fetch(userId);

        if (result.success && result.connection) {
          await user.send(
            `🎉 **Auto-connection successful!**\n\n` +
              `✅ **${result.connection.server_name}** is now connected!\n` +
              `🔧 **Tools are being discovered...** Just a moment!\n\n` +
              `You'll get an update when tools are ready to use.`,
          );
          console.log(
            `✅ [AutoReconnect] Notified user ${userId} of successful reconnection`,
          );
        } else {
          await user.send(
            `⚠️ **Auto-connection issue**\n\n` +
              `While your OAuth authorization was successful, there was an issue with the automatic connection:\n\n` +
              `**Error:** ${result.error}\n\n` +
              `Please try running \`!mcp connect ${serverId}\` manually.`,
          );
          console.log(
            `⚠️ [AutoReconnect] Notified user ${userId} of connection issue`,
          );
        }
      } catch (dmError) {
        console.warn(
          `⚠️ [AutoReconnect] Could not send DM to user ${userId}:`,
          dmError,
        );
        // Could also try posting to a channel if we knew which one, but DMs are more private
      }
    } catch (error) {
      console.error(
        `💥 [AutoReconnect] Failed to handle auto-reconnect:`,
        error,
      );
    }
  }

  private setupWebServer(): void {
    const port = process.env.OAUTH_CALLBACK_PORT || 8080;

    // Simple health
    this.webApp.get('/healthz', (_req: Request, res: Response) =>
      res.json({ ok: true }),
    );

    // OAuth callback endpoint
    this.webApp.get('/oauth/callback', async (req: Request, res: Response) => {
      const { code, state, error } = req.query as Record<string, string>;
      console.log(
        `🔐 [Callback] Received: code=${code?.substring(0, 10)}..., state=${state}, error=${error}`,
      );

      if (error) {
        return res.status(400).send(`OAuth error: ${error}`);
      }
      if (!code || !state) {
        return res.status(400).send('Missing code or state');
      }
      try {
        console.log(`🔐 [Callback] Looking up pending row by state: ${state}`);
        // Lookup pending state
        const pending = await this.database.getOAuthPendingByState(state);
        console.log(
          `🔐 [Callback] Found pending:`,
          pending
            ? `server=${pending.server_id}, user=${pending.user_id}, state=${pending.state}`
            : 'null',
        );

        if (!pending) {
          console.log(
            '🔐 [Callback] State lookup failed, showing all pending rows for debugging...',
          );
          return res.status(400).send('Invalid or expired state');
        }

        console.log(
          `🔐 [Callback] Starting token exchange for ${pending.server_id}`,
        );

        // Exchange the authorization code for tokens directly
        try {
          // Get the actual MCP server URL from the saved connection
          const connection = await this.database.getUserMCPConnection(
            pending.user_id,
            pending.server_id,
          );

          if (!connection) {
            throw new Error('No saved MCP connection found');
          }

          const authProvider = new ConnectionManagerOAuthProvider(
            pending.server_id,
            pending.user_id,
            this.database,
            this.mcpService.getEventService(),
            connection.server_url,
          );

          // Call auth with the authorization code to complete token exchange
          const result = await auth(authProvider, {
            serverUrl: connection.server_url, // Use the actual MCP server URL
            authorizationCode: code,
          });

          if (result !== 'AUTHORIZED') {
            throw new Error(`Token exchange failed: ${result}`);
          }

          // Clean up the OAuth pending state after successful token exchange
          await this.database.deleteOAuthPending(
            pending.server_id,
            pending.user_id,
          );

          console.log(
            `🔐 [Callback] OAuth flow completed for ${pending.server_id}`,
          );

          // Provide success page
          res.send(`
            <html>
              <body>
                <h2>✅ Authorization Complete!</h2>
                <p>You have successfully authorized the MCP server.</p>
                <p>You can now close this window and return to Discord. The server connection should work automatically.</p>
              </body>
            </html>
          `);

          // Trigger auto-reconnect and notify user in Discord
          this.handleAutoReconnectAfterOAuth(
            pending.server_id,
            pending.user_id,
          );
        } catch (tokenError) {
          console.error(`🔐 [Callback] Token exchange failed:`, tokenError);
          res.status(500).send(`
            <html>
              <body>
                <h2>❌ Token Exchange Failed</h2>
                <p>There was an error completing the authorization. Please try connecting again.</p>
                <pre>${tokenError}</pre>
              </body>
            </html>
          `);
        }
      } catch (e: any) {
        console.error('OAuth callback handling failed', e);
      }
    });

    this.webServer = this.webApp.listen(port, () => {
      console.log(`🌐 OAuth callback server listening on ${port}`);
    });
  }

  async start(): Promise<void> {
    const token = this.config.getDiscord().token;
    if (!token) {
      throw new Error('DISCORD_TOKEN environment variable is required');
    }

    try {
      await this.client.login(token);
    } catch (error) {
      console.error('Failed to login:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    this.scheduler.stop();
    await this.client.destroy();
    if (this.webServer) {
      this.webServer.close();
    }
  }
}

// Handle graceful shutdown
const bot = new DiscordBot();

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch(console.error);
