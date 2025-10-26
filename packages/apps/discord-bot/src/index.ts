import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import express, { Request, Response } from 'express';
import { ConfigManager } from './config/index.js';
import { CommandRegistryImpl } from './commands/registry.js';
import { ChatCommand } from './commands/chat/chat.js';
import { ClearChatCommand } from './commands/chat/clear.js';
import { MCPCommand } from './commands/mcp/mcp.js';
import { TasksCommand } from './commands/tasks/tasks.js';
import { LLMService } from './services/llm.js';
import { SupabaseService } from './services/database.js';
import { AlertScheduler } from './services/scheduler.js';
import { TaskManagementFunctions } from './ai-functions/task-management.js';
import { MCPService } from './services/mcp/index.js';
import { DiscordNotificationService } from './services/discord-notification.service.js';
import { MCPEventService } from './services/event-emitter.service.js';
import { ConnectionPoolService } from './services/connections.js';
import { MCPCoordinatorService } from './services/mcp-coordinator.service.js';
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
  private webApp = express();
  private webServer?: any;

  constructor() {
    this.config = new ConfigManager();

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.DirectMessages, // Enable DM listening
        GatewayIntentBits.MessageContent, // Needed for reading message content
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

    // Initialize MCP service with all required dependencies
    this.mcpService = new MCPService(
      this.database,
      this.mcpEventService,
      this.connectionPool,
      this.mcpCoordinator,
      undefined, // No registry service needed
      this.discordNotification,
    );

    // Initialize the MCP service after all dependencies are set up
    this.mcpService.initialize();

    // Create scheduler and task functions first (LLM service needs task functions)
    this.scheduler = new AlertScheduler(
      this.client,
      this.database,
      this.config,
      null as any, // Will be set after LLM service is created
    );
    this.taskFunctions = new TaskManagementFunctions(
      this.scheduler,
      this.database,
    );

    // Now create LLM service with both MCP and task functions
    this.llmService = new LLMService(
      this.config,
      this.mcpService,
      this.taskFunctions,
    );

    // Set the LLM service in scheduler now that it's created
    (this.scheduler as any).llmService = this.llmService;

    this.setupEventHandlers();
    this.registerCommands();
    this.setupWebServer();
  }

  private setupEventHandlers(): void {
    // Add comprehensive event logging
    this.client.on('debug', (info) => {
      if (info.includes('interaction') || info.includes('command')) {
        console.log('🐛 DEBUG:', info);
      }
    });

    this.client.on('warn', console.warn);
    this.client.on('error', console.error);

    this.client.on(Events.ClientReady, async () => {
      if (this.client.user) {
        console.log(`✅ Bot logged in as ${this.client.user.tag}!`);
        console.log(`🤖 Bot ID: ${this.client.user.id}`);
        console.log(
          `🔗 Invite URL: https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=2147483648&scope=bot%20applications.commands`,
        );

        // Log gateway connection info
        console.log(`🌐 Gateway URL: ${this.client.ws.gateway}`);
        console.log(`🔗 Connected to ${this.client.guilds.cache.size} guilds`);

        // List guilds for debugging
        this.client.guilds.cache.forEach((guild) => {
          console.log(`📍 Guild: ${guild.name} (${guild.id})`);
        });

        // Get current MCP tools available for chat
        const mcpTools = await this.mcpService.getAvailableTools('system', 'default');
        console.log(`🤖 AI Chat available with ${mcpTools.length} MCP tools`);
        console.log(`⚡ Task management available via /tasks command`);

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

    this.client.on(Events.InteractionCreate, async (interaction) => {
      console.log('🔔 INTERACTION RECEIVED:', {
        type: interaction.type,
        isSlash: interaction.isChatInputCommand(),
        isAutocomplete: interaction.isAutocomplete(),
        commandName:
          interaction.isChatInputCommand() || interaction.isAutocomplete()
            ? interaction.commandName
            : 'N/A',
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        isDM: !interaction.guildId, // Flag DM interactions
      });

      // Handle autocomplete interactions
      if (interaction.isAutocomplete()) {
        console.log('🔍 AUTOCOMPLETE DEBUG:', {
          commandName: interaction.commandName,
          focusedOption: interaction.options.getFocused(true),
        });

        const command = this.commandRegistry.getCommand(
          interaction.commandName,
        );
        console.log('🔍 COMMAND LOOKUP:', {
          commandFound: !!command,
          commandName: command?.name,
          hasAutocompleteMethod: command && 'handleAutocomplete' in command,
          methodType: command && typeof (command as any).handleAutocomplete,
          allCommandNames: this.commandRegistry
            .getAllCommands()
            .map((c) => c.name),
        });

        if (
          command &&
          'handleAutocomplete' in command &&
          typeof command.handleAutocomplete === 'function'
        ) {
          try {
            console.log('🔍 CALLING AUTOCOMPLETE HANDLER...');
            await (command as any).handleAutocomplete(interaction);
            console.log('🔍 AUTOCOMPLETE HANDLER COMPLETED');
          } catch (error) {
            console.error(
              `Error handling autocomplete for ${interaction.commandName}:`,
              error,
            );
            // Respond with empty choices on error
            await interaction.respond([]);
          }
        } else {
          console.log(
            '🔍 NO AUTOCOMPLETE HANDLER FOUND - RESPONDING WITH EMPTY',
          );
          // No autocomplete handler found
          await interaction.respond([]);
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = this.commandRegistry.getCommand(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`,
        );
        try {
          await interaction.reply({
            content: 'Command not found!',
            ephemeral: true,
          });
        } catch (error) {
          console.error('Failed to reply to unknown command:', error);
        }
        return;
      }

      try {
        // Execute the slash command
        await command.executeSlash(interaction);
      } catch (error) {
        console.error(
          `Error during interaction for command ${interaction.commandName}:`,
          error,
        );
        // Safely reply or follow up if an error occurs
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
              content: 'There was an error while executing this command!',
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: 'There was an error while executing this command!',
              ephemeral: true,
            });
          }
        } catch (replyError) {
          console.error('Failed to send error message:', replyError);
        }
      }
    });
  }

  private registerCommands(): void {
    // Register AI-powered chat command (now without task management)
    this.commandRegistry.register(
      new ChatCommand(this.llmService, this.database),
    );

    // Register clear chat memory command
    this.commandRegistry.register(new ClearChatCommand(this.database));

    // Register MCP management command (no registry service needed)
    this.commandRegistry.register(new MCPCommand(this.mcpService));

    // Register dedicated tasks management command
    this.commandRegistry.register(
      new TasksCommand(this.taskFunctions, this.database),
    );

    console.log(
      `📝 Registered ${this.commandRegistry.getAllCommands().length} commands`,
    );
  }

  private async handleAutoReconnectAfterOAuth(
    serverId: string,
    userId: string,
  ): Promise<void> {
    console.log(
      `🔄 [AutoReconnect] Starting auto-reconnect for server=${serverId}, user=${userId}`,
    );

    // Attempt auto-reconnect
    await this.mcpService.autoReconnectAfterOAuth(serverId, userId);
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
          // TODO: Get actual channel_id from oauth_pending table
          const channelId = (pending as any).channel_id || 'default';
          const connection = await this.database.getUserMCPConnection(
            pending.user_id,
            channelId,
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
