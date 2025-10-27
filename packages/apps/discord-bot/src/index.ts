import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  Partials,
} from 'discord.js';
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
        GatewayIntentBits.GuildMessages, // Enable reading messages in guild channels/threads
        GatewayIntentBits.DirectMessages, // Enable DM listening
        GatewayIntentBits.MessageContent, // Needed for reading message content
      ],
      partials: [Partials.Channel, Partials.Message], // Enable DM events
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

        // Start scheduler with alert loading
        try {
          await this.scheduler.start();
        } catch (error) {
          console.error('⚠️ Scheduler initialization error:', error);
        }

        // NOTE: Reestablishing persistent MCP connections on startup is disabled
        // for scalability. With thousands of users, this would create too many
        // simultaneous connections. MCP connections are now lazy-loaded only when
        // users actually interact with the bot.
        // If you need to re-enable this for development/testing, uncomment below:
        /*
        try {
          await this.mcpService.reestablishPersistentConnections();
        } catch (error) {
          console.error('⚠️ MCP connection reestablishment error:', error);
        }
        */
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      const startTime = Date.now();

      // Log interaction details (keep logging brief to minimize delays)
      const isSlash = interaction.isChatInputCommand();
      const isAutocomplete = interaction.isAutocomplete();
      const commandName =
        isSlash || isAutocomplete ? interaction.commandName : 'N/A';

      console.log('🔔 INTERACTION:', {
        type: interaction.type,
        cmd: commandName,
        user: interaction.user.id,
        isDM: !interaction.guildId,
        receivedAt: startTime,
      });

      // Handle autocomplete interactions
      if (isAutocomplete) {
        const command = this.commandRegistry.getCommand(commandName);

        if (
          command &&
          'handleAutocomplete' in command &&
          typeof command.handleAutocomplete === 'function'
        ) {
          try {
            await (command as any).handleAutocomplete(interaction);
          } catch (error) {
            console.error(
              `Error handling autocomplete for ${commandName}:`,
              error,
            );
            // Respond with empty choices on error
            await interaction.respond([]);
          }
        } else {
          // No autocomplete handler found
          await interaction.respond([]);
        }
        return;
      }

      if (!isSlash) return;

      const command = this.commandRegistry.getCommand(commandName);

      if (!command) {
        console.error(`No command matching ${commandName} was found.`);
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

      const preExecuteTime = Date.now();
      console.log(
        `⏱️ Time to execute command: ${preExecuteTime - startTime}ms`,
      );

      try {
        // Execute the slash command immediately
        await command.executeSlash(interaction);
      } catch (error) {
        console.error(
          `Error during interaction for command ${commandName}:`,
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

    // Handle messages for thread and DM conversations
    this.client.on(Events.MessageCreate, async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      // Check if this is a thread message
      if (message.channel.isThread()) {
        await this.handleThreadMessage(message);
      }
      // Check if this is a DM message
      else if (!message.guildId) {
        await this.handleDMMessage(message);
      }
    });
  }

  private async handleThreadMessage(message: any): Promise<void> {
    console.log('🔵 handleThreadMessage called', {
      threadId: message.channel.id,
      userId: message.author.id,
      contentPreview: message.content.substring(0, 50),
    });

    try {
      const threadId = message.channel.id;

      // Check if this thread is tracked in our database
      const chatThread = await this.database.getChatThread(threadId);

      if (!chatThread) {
        console.log('⚠️ Thread not tracked in database, ignoring', {
          threadId,
        });
        // Not a tracked thread, ignore
        return;
      }

      // Security: Only allow the thread owner to use their tools
      if (message.author.id !== chatThread.user_id) {
        console.log('🔒 User not authorized for thread', {
          messageUserId: message.author.id,
          threadUserId: chatThread.user_id,
        });
        await message.reply(
          '🔒 This thread belongs to another user. Please start your own conversation with `/chat`.',
        );
        return;
      }

      console.log('💬 Thread message authorized and processing', {
        threadId,
        userId: message.author.id,
        contentPreview: message.content.substring(0, 50),
      });

      // Create status callback that updates a single message
      let statusMessage: any = null;
      const sendStatus = async (status: string) => {
        try {
          if (statusMessage) {
            // Edit existing status message
            await statusMessage.edit(status);
          } else {
            // Create first status message
            statusMessage = await message.reply(status);
          }
        } catch (error) {
          console.warn('Failed to update status message:', error);
        }
      };

      // Show typing indicator and keep it going
      await message.channel.sendTyping();
      const typingInterval = setInterval(() => {
        message.channel.sendTyping().catch(() => clearInterval(typingInterval));
      }, 5000); // Refresh every 5 seconds

      try {
        // Load conversation history from database
        const history = chatThread.conversation_history.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: new Date(),
        }));

        // Generate AI response
        const response = await this.llmService.generateResponse(
          message.content,
          {
            userId: message.author.id,
            channelId: chatThread.channel_id, // Use parent channel for MCP tool access
            threadId: threadId, // Pass thread ID for task alerts
            history: history,
          },
          message.author.id,
          sendStatus, // Pass status callback for tool execution updates
        );

        // Clear typing interval
        clearInterval(typingInterval);

        // Keep the status message visible for transparency
        // Don't delete it - users should see what tools were used

        // Handle function calls or text response
        if (Array.isArray(response)) {
          // Function calls are supported - this would be handled by the chat command logic
          // For now, inform the user that complex operations should use /chat
          await message.reply(
            "I received a complex request. For tool execution and tasks, please ensure you're in a thread created by the `/chat` command.",
          );
        } else {
          // Send response
          await message.reply(response);

          // Update thread history
          await this.database.updateThreadHistory(threadId, {
            role: 'user',
            content: message.content,
          });
          await this.database.updateThreadHistory(threadId, {
            role: 'assistant',
            content: response,
          });
        }
      } finally {
        // Ensure typing is cleared even if there's an error
        clearInterval(typingInterval);
      }
    } catch (error) {
      console.error('Error handling thread message:', error);
      console.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      console.error('Error details:', {
        threadId: message.channel.id,
        userId: message.author.id,
        messageContent: message.content.substring(0, 100),
      });
      try {
        await message.reply(
          'Sorry, I encountered an error processing your message. Please check the logs for details.',
        );
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  }

  private async handleDMMessage(message: any): Promise<void> {
    try {
      console.log('📩 DM message received', {
        userId: message.author.id,
        contentPreview: message.content.substring(0, 50),
      });

      // Create status callback that updates a single message
      let dmStatusMessage: any = null;
      const sendStatus = async (status: string) => {
        try {
          if (dmStatusMessage) {
            // Edit existing status message
            await dmStatusMessage.edit(status);
          } else {
            // Create first status message
            dmStatusMessage = await message.reply(status);
          }
        } catch (error) {
          console.warn('Failed to update status message:', error);
        }
      };

      // Show typing indicator and keep it going
      await message.channel.sendTyping();
      const typingInterval = setInterval(() => {
        message.channel.sendTyping().catch(() => clearInterval(typingInterval));
      }, 5000); // Refresh every 5 seconds

      try {
        // Load conversation history for this DM
        const history = await this.database.getConversationHistory(
          message.author.id,
          message.channel.id,
          50,
        );

        // Generate AI response
        const response = await this.llmService.generateResponse(
          message.content,
          {
            userId: message.author.id,
            channelId: message.channel.id,
            history: history,
          },
          message.author.id,
          sendStatus, // Pass status callback for tool execution updates
        );

        // Clear typing interval
        clearInterval(typingInterval);

        // Keep the status message visible for transparency
        // Don't delete it - users should see what tools were used

        // Handle function calls or text response
        if (Array.isArray(response)) {
          // For now, don't support function calls in DMs
          await message.reply(
            "I can't execute tools in DM conversations yet. Please use the `/chat` command in a server for tool access.",
          );
        } else {
          // Send response
          await message.reply(response);

          // Save conversation turn
          await this.database.saveConversationTurn(
            message.author.id,
            message.channel.id,
            message.content,
            response,
          );
        }
      } finally {
        // Ensure typing is cleared even if there's an error
        clearInterval(typingInterval);
      }
    } catch (error) {
      console.error('Error handling DM message:', error);
      console.error(
        'Error stack:',
        error instanceof Error ? error.stack : 'No stack trace',
      );
      console.error('Error details:', {
        userId: message.author.id,
        channelId: message.channel.id,
        messageContent: message.content.substring(0, 100),
      });
      try {
        await message.reply(
          'Sorry, I encountered an error processing your message. Please check the logs for details.',
        );
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
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
    channelId: string,
  ): Promise<void> {
    console.log(
      `🔄 [AutoReconnect] Starting auto-reconnect for server=${serverId}, user=${userId}, channel=${channelId}`,
    );

    // Attempt auto-reconnect
    await this.mcpService.autoReconnectAfterOAuth(serverId, userId, channelId);
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
          // Get the channel_id from the oauth_pending table
          const channelId = pending.channel_id || 'default';
          console.log(
            `🔐 [Callback] Using channelId: ${channelId} (from pending.channel_id: ${pending.channel_id})`,
          );
          console.log(
            `🔐 [Callback] Looking up connection with: userId=${pending.user_id}, channelId=${channelId}, serverId=${pending.server_id}`,
          );

          const connection = await this.database.getUserMCPConnection(
            pending.user_id,
            channelId,
            pending.server_id,
          );

          if (!connection) {
            // Log all connections for this user to help debug
            const allUserConnections =
              await this.database.getUserMCPConnections(
                pending.user_id,
                channelId,
              );
            console.log(
              `🔐 [Callback] No connection found. User has ${allUserConnections.length} connection(s) in this channel:`,
              allUserConnections.map((c) => ({
                server_id: c.server_id,
                server_name: c.server_name,
                channel_id: c.channel_id,
              })),
            );
            throw new Error('No saved MCP connection found');
          }
          const authProvider = new ConnectionManagerOAuthProvider(
            pending.server_id,
            pending.user_id,
            this.database,
            this.mcpService.getEventService(),
            connection.server_url,
            channelId, // Pass channelId to the provider
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
            channelId,
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
