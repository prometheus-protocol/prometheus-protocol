import { MCPEventService } from './event-emitter.service.js';
import { MCPEventHandlerService } from './mcp-event-handler.service.js';
import { DiscordNotificationService } from './discord-notification.service.js';
import { SupabaseService } from './database.js';
import logger from '../utils/logger.js';

// Forward declaration to avoid circular dependency
interface MCPServiceInterface {
  handleToolResult(payload: any): void;
}

/**
 * Service that coordinates MCP events between the EventEmitter and database handlers.
 * This replaces the pubsub system with direct in-process event handling.
 */
export class MCPCoordinatorService {
  private eventHandlerService: MCPEventHandlerService;
  private mcpService?: MCPServiceInterface;

  constructor(
    private eventService: MCPEventService,
    private databaseService: SupabaseService,
    private discordNotification?: DiscordNotificationService,
  ) {
    this.eventHandlerService = new MCPEventHandlerService(
      databaseService,
      discordNotification,
    );
    this.setupEventListeners();
  }

  /**
   * Set the MCP service reference for tool result handling
   */
  setMCPService(mcpService: MCPServiceInterface): void {
    this.mcpService = mcpService;
  }

  /**
   * Set up event listeners to connect the EventEmitter with database handlers
   */
  private setupEventListeners(): void {
    // Authentication events
    this.eventService.on('mcp:auth-required', async (payload) => {
      try {
        await this.eventHandlerService.handleAuthRequired(payload);
      } catch (error) {
        logger.error(
          'Error handling auth required event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Tools events
    this.eventService.on('mcp:tools-fetched', async (payload) => {
      try {
        await this.eventHandlerService.handleToolsFetched(payload);
      } catch (error) {
        logger.error(
          'Error handling tools fetched event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Resources events
    this.eventService.on('mcp:resources-fetched', async (payload) => {
      try {
        await this.eventHandlerService.handleResourcesFetched(payload);
      } catch (error) {
        logger.error(
          'Error handling resources fetched event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    this.eventService.on('mcp:resource-data-fetched', async (payload) => {
      try {
        await this.eventHandlerService.handleResourceDataFetched(payload);
      } catch (error) {
        logger.error(
          'Error handling resource data fetched event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Connection events
    this.eventService.on('mcp:connection-status-update', async (payload) => {
      try {
        await this.eventHandlerService.handleConnectionStatusUpdate(payload);
      } catch (error) {
        logger.error(
          'Error handling connection status update:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Server events
    this.eventService.on('mcp:server-capabilities', async (payload) => {
      try {
        await this.eventHandlerService.handleServerCapabilities(payload);
      } catch (error) {
        logger.error(
          'Error handling server capabilities event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Tool execution events
    this.eventService.on('mcp:tool-result', async (payload) => {
      try {
        await this.eventHandlerService.handleToolResult(payload);

        // Also notify MCPService to resolve pending invocations
        if (this.mcpService) {
          this.mcpService.handleToolResult(payload);
        }
      } catch (error) {
        logger.error(
          'Error handling tool result event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    this.eventService.on('mcp:tool-invocation-progress', async (payload) => {
      try {
        await this.eventHandlerService.handleToolInvocationProgress(payload);
      } catch (error) {
        logger.error(
          'Error handling tool invocation progress:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Notification events
    this.eventService.on('mcp:notification-received', async (payload) => {
      try {
        await this.eventHandlerService.handleNotificationReceived(payload);
      } catch (error) {
        logger.error(
          'Error handling notification received event:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    // Advanced events (currently just logged)
    this.eventService.on('mcp:sampling-request-received', async (payload) => {
      try {
        await this.eventHandlerService.handleSamplingRequestReceived(payload);
      } catch (error) {
        logger.error(
          'Error handling sampling request:',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    });

    this.eventService.on(
      'mcp:elicitation-request-received',
      async (payload) => {
        try {
          await this.eventHandlerService.handleElicitationRequestReceived(
            payload,
          );
        } catch (error) {
          logger.error(
            'Error handling elicitation request:',
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      },
    );

    logger.info('[MCPCoordinator] Event listeners set up successfully');
  }

  /**
   * Get the event service for publishing events
   */
  getEventService(): MCPEventService {
    return this.eventService;
  }

  /**
   * Get the event handler service for direct method calls
   */
  getEventHandlerService(): MCPEventHandlerService {
    return this.eventHandlerService;
  }

  /**
   * Cleanup method to remove all listeners
   */
  destroy(): void {
    this.eventService.removeAllListeners();
    logger.info('[MCPCoordinator] Event listeners cleaned up');
  }
}
