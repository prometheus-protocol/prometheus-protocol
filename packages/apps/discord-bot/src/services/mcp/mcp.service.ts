import { ConnectionPoolService } from '../connections.js';
import { SupabaseService } from '../database.js';
import { MCPEventService } from '../event-emitter.service.js';
import { MCPCoordinatorService } from '../mcp-coordinator.service.js';
import { DiscordNotificationService } from '../discord-notification.service.js';
import { RegistryService } from '../registry.service.js';
import { PendingToolInvocationsService } from '../pending-tool-invocations.service.js';
import logger from '../../utils/logger.js';
import {
  ConnectionRequestPayload,
  DisconnectRequestPayload,
  InvokeToolRequestPayload,
} from '../../dtos/pubsub.events.dto.js';

interface ServerSearchQuery {
  query?: string;
  category?: string;
  limit?: number;
  page?: number;
}

interface PaginatedServerSearchResult {
  servers: ServerSearchResult[];
  pagination: {
    page: number;
    totalPages: number;
    totalResults: number;
    currentPage: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface ServerSearchResult {
  id: string;
  name: string;
  description: string;
  url: string;
  category?: string;
  author?: string;
  isOAuthEnabled?: boolean;
  tags?: string[];
  auth_type?: string;
  hosted_on?: string;
}

interface ConnectionResult {
  success: boolean;
  message: string;
  connectionId?: string;
  authRequired?: boolean;
  authUrl?: string;
  // Properties expected by Discord bot
  status?: 'connected' | 'auth-required' | 'error';
  server_name?: string;
  tools?: any[];
  error_message?: string;
  connection?: {
    server_name: string;
    tools: any[];
  };
  error?: string;
}

interface SystemStatus {
  activeConnections: number;
  totalServers: number;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  uptime: number;
  // Properties expected by Discord bot
  registryConnected: boolean;
  userConnections: number;
  availableTools: number;
}

interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, any>;
  serverId: string;
  serverName: string;
  server_name: string; // Also include snake_case version for compatibility
}

interface MCPFunctionCall {
  name: string;
  arguments: Record<string, any>;
}

interface FunctionCallResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * MCPService provides a high-level interface for MCP server management,
 * wrapping ConnectionPoolService and database operations for Discord bot usage.
 */
export class MCPService {
  private pendingInvocations: PendingToolInvocationsService;

  constructor(
    private databaseService: SupabaseService,
    private eventService: MCPEventService,
    private connectionPool: ConnectionPoolService,
    private coordinator: MCPCoordinatorService,
    private registryService?: RegistryService,
    private discordNotification?: DiscordNotificationService,
  ) {
    this.pendingInvocations = new PendingToolInvocationsService();
  }

  /**
   * Initialize the service after all dependencies are created
   */
  initialize(): void {
    // Set up bidirectional reference with coordinator for tool result handling
    this.coordinator.setMCPService(this);
  }

  /**
   * Handle tool result event and resolve any pending invocations
   */
  handleToolResult(payload: any): void {
    const { invocationId, status, result, error } = payload;

    logger.info(
      `[MCPService] Handling tool result for invocation ${invocationId}: ${status}`,
    );

    if (status === 'success' && result) {
      const resolved = this.pendingInvocations.resolveInvocation(
        invocationId,
        result,
      );
      logger.info(
        `[MCPService] ${resolved ? 'Successfully resolved' : 'No pending invocation found for'} invocation ${invocationId}`,
      );
    } else if (status === 'error' && error) {
      const errorObj = new Error(error.message || 'Tool invocation failed');
      const resolved = this.pendingInvocations.rejectInvocation(
        invocationId,
        errorObj,
      );
      logger.info(
        `[MCPService] ${resolved ? 'Successfully rejected' : 'No pending invocation found for'} invocation ${invocationId}`,
      );
    } else {
      // Fallback for unexpected statuses
      const errorObj = new Error(`Unexpected tool result status: ${status}`);
      const resolved = this.pendingInvocations.rejectInvocation(
        invocationId,
        errorObj,
      );
      logger.warn(
        `[MCPService] Unexpected status ${status} for invocation ${invocationId}, ${resolved ? 'rejected' : 'no pending invocation found'}`,
      );
    }
  }

  /**
   * Get statistics about pending tool invocations
   */
  getPendingInvocationStats(): any {
    return this.pendingInvocations.getStats();
  }

  /**
   * Get the event service instance
   */
  getEventService(): MCPEventService {
    return this.eventService;
  }

  /**
   * Get system status including active connections and health
   */
  async getSystemStatus(): Promise<SystemStatus> {
    try {
      // Get active connections from database
      const connections =
        await this.databaseService.getUserMCPConnections('system'); // Use system user for overall stats
      const activeConnections = connections.filter(
        (conn) => conn.status === 'connected',
      ).length;

      // Check registry health
      const registryConnected =
        (await this.registryService?.healthCheck()) ?? false;

      // Get sample of servers from registry to determine total available
      const registryServers = await this.registryService?.searchServers({
        limit: 1,
      });
      const totalServers = registryServers?.pagination.totalItems ?? 0;

      // Calculate total available tools across all connected users
      let totalAvailableTools = 0;
      try {
        // Get tools for system user (overall stats)
        const systemTools = await this.getAvailableTools('system');
        totalAvailableTools = systemTools.length;
      } catch (toolsError) {
        logger.warn(
          'Failed to calculate available tools count for system status',
        );
      }

      const status: SystemStatus = {
        activeConnections,
        totalServers,
        healthStatus:
          registryConnected && activeConnections >= 0
            ? 'healthy'
            : registryConnected
              ? 'degraded'
              : 'offline',
        uptime: process.uptime(),
        registryConnected,
        userConnections: activeConnections,
        availableTools: totalAvailableTools,
      };

      logger.info('System status retrieved', {
        service: 'MCPService',
        activeConnections: status.activeConnections,
        totalServers: status.totalServers,
        healthStatus: status.healthStatus,
        registryConnected: status.registryConnected,
      });
      return status;
    } catch (error) {
      logger.error(
        'Error getting system status:',
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        activeConnections: 0,
        totalServers: 0,
        healthStatus: 'offline',
        uptime: process.uptime(),
        registryConnected: false,
        userConnections: 0,
        availableTools: 0,
      };
    }
  }

  /**
   * Get user's MCP connections
   */
  async getUserConnections(userId: string): Promise<any[]> {
    try {
      const connections =
        await this.databaseService.getUserMCPConnections(userId);
      logger.info(
        `Retrieved ${connections.length} connections for user ${userId}`,
      );
      return connections;
    } catch (error) {
      logger.error(
        `Error getting connections for user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * Search for available MCP servers using the external registry
   */
  async searchServers(
    query: ServerSearchQuery,
  ): Promise<PaginatedServerSearchResult> {
    try {
      logger.info('Searching servers with query', {
        service: 'MCPService',
        query: query.query,
        category: query.category,
        limit: query.limit,
      });

      // Use the registry service to search for real servers
      const registryResponse = await this.registryService?.searchServers({
        q: query.query,
        categories: query.category,
        page: query.page || 1,
        limit: query.limit || 10,
      });

      if (!registryResponse) {
        return {
          servers: [],
          pagination: {
            page: 1,
            totalPages: 0,
            totalResults: 0,
            currentPage: 1,
            totalItems: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      // Convert registry server objects to the format expected by the Discord bot
      const servers: ServerSearchResult[] = registryResponse.data.map(
        (server) => RegistryService.convertToMCPServerResult(server),
      );

      return {
        servers,
        pagination: {
          page: registryResponse.pagination.currentPage,
          totalPages: registryResponse.pagination.totalPages,
          totalResults: registryResponse.pagination.totalItems,
          currentPage: registryResponse.pagination.currentPage,
          totalItems: registryResponse.pagination.totalItems,
          hasNextPage: registryResponse.pagination.hasNextPage,
          hasPreviousPage: registryResponse.pagination.hasPreviousPage,
        },
      };
    } catch (error) {
      logger.error(
        'Error searching servers:',
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        servers: [],
        pagination: {
          page: 1,
          totalPages: 0,
          totalResults: 0,
          currentPage: 1,
          totalItems: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }
  }

  /**
   * Connect to an MCP server
   */
  async connectToServer(
    serverId: string,
    userId: string,
    serverUrl?: string,
  ): Promise<ConnectionResult> {
    try {
      logger.info(`Connecting user ${userId} to server ${serverId}`);

      // If no serverUrl provided, try to get it from the registry
      let actualServerUrl = serverUrl;
      if (!actualServerUrl) {
        const serverInfo = await this.registryService?.getServerById(serverId);
        if (serverInfo && serverInfo.mcp_url) {
          actualServerUrl = serverInfo.mcp_url;
          logger.info(`Found server URL from registry: ${actualServerUrl}`, {
            service: 'MCPService',
            serverId,
            serverUrl: actualServerUrl,
          });
        } else if (serverInfo) {
          throw new Error(
            `Server ${serverId} found in registry but has no mcp_url property`,
          );
        } else {
          throw new Error(`Server ${serverId} not found in registry`);
        }
      }

      // Validate that we have a proper HTTP/HTTPS URL
      if (
        !actualServerUrl ||
        (!actualServerUrl.startsWith('http://') &&
          !actualServerUrl.startsWith('https://'))
      ) {
        throw new Error(
          `Invalid server URL: ${actualServerUrl}. Must be HTTP or HTTPS.`,
        );
      }

      const connectionPayload: ConnectionRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId, // Using userId as userId for Discord bot
        mcpServerConfigId: serverId,
        mcpServerUrl: actualServerUrl,
      };

      await this.connectionPool.handleConnectionRequest(connectionPayload);

      return {
        success: true,
        message:
          'Connection established successfully, tools are being fetched...',
        connectionId: serverId,
        status: 'connected',
        server_name: serverId,
        tools: [], // Tools will be updated via Discord message when synced
        connection: {
          server_name: serverId,
          tools: [],
        },
      };
    } catch (error: any) {
      logger.error(
        `Error connecting to server ${serverId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );

      // Check if it's an auth error
      if (error.message?.includes('auth') || error.message?.includes('oauth')) {
        return {
          success: false,
          message: 'Authentication required',
          authRequired: true,
          authUrl: `/auth/oauth/${serverId}`, // Mock auth URL
          status: 'auth-required',
          server_name: serverId,
        };
      }

      return {
        success: false,
        message: error.message || 'Failed to connect to server',
        status: 'error',
        error_message: error.message || 'Failed to connect to server',
        error: error.message || 'Failed to connect to server',
      };
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectFromServer(serverId: string, userId: string): Promise<void> {
    try {
      logger.info(`Disconnecting user ${userId} from server ${serverId}`);

      // Get the connection to find the server URL
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        serverId,
      );
      let serverUrl = connection?.server_url;

      // If no saved server URL, try to get it from registry
      if (!serverUrl) {
        const serverInfo = await this.registryService?.getServerById(serverId);
        if (serverInfo) {
          serverUrl = serverInfo.mcp_url;
        } else {
          logger.warn(
            `Could not find server URL for ${serverId}, using fallback`,
          );
          serverUrl = `https://unknown-server/${serverId}`;
        }
      }

      const disconnectPayload: DisconnectRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId,
        mcpServerConfigId: serverId,
        mcpServerUrl: serverUrl,
      };

      await this.connectionPool.handleDisconnectRequest(disconnectPayload);
      logger.info(`Successfully disconnected from server ${serverId}`);
    } catch (error) {
      logger.error(
        `Error disconnecting from server ${serverId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get available tools for a user across all their connections
   */
  async getAvailableTools(userId: string): Promise<ToolInfo[]> {
    try {
      const connections = await this.getUserConnections(userId);
      const tools: ToolInfo[] = [];

      // Fetch available tools from each connected MCP server
      for (const connection of connections) {
        if (connection.status === 'connected' && connection.tools) {
          try {
            // Parse the tools JSON from the database
            const serverTools = JSON.parse(connection.tools);

            // Convert MCP SDK Tool objects to ToolInfo format
            for (const tool of serverTools) {
              const toolInfo: ToolInfo = {
                name: tool.name,
                description:
                  tool.description || `Tool from ${connection.server_name}`,
                parameters: tool.inputSchema || {},
                serverId: connection.server_id,
                serverName: connection.server_name,
                server_name: connection.server_name,
              };
              tools.push(toolInfo);
            }
          } catch (parseError) {
            logger.warn(
              `Failed to parse tools JSON for connection ${connection.server_id}: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            );
          }
        }
      }

      logger.info(`Retrieved ${tools.length} tools for user ${userId}`);
      return tools;
    } catch (error) {
      logger.error(
        `Error getting available tools for user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * Convert available tools to OpenAI function format for LLM integration
   */
  async convertToolsToOpenAIFunctions(userId: string): Promise<any[]> {
    try {
      const tools = await this.getAvailableTools(userId);

      const openAIFunctions = tools.map((tool) => {
        // tool.parameters contains the inputSchema from MCP
        // If it's already a proper schema, use it directly, otherwise wrap it
        let parameters = tool.parameters;

        // If parameters is empty or not a proper schema, create a default schema
        if (!parameters || typeof parameters !== 'object' || !parameters.type) {
          parameters = {
            type: 'object',
            properties: {},
            required: [],
          };
        }

        return {
          name: `mcp__${tool.serverId}__${tool.name}`,
          description: tool.description,
          parameters: parameters,
        };
      });

      logger.info(
        `Converted ${openAIFunctions.length} tools to OpenAI functions for user ${userId}`,
      );
      return openAIFunctions;
    } catch (error) {
      logger.error(
        `Error converting tools to OpenAI functions for user ${userId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  /**
   * Handle MCP function calls from LLM
   */
  async handleMCPFunctionCall(
    functionName: string,
    functionArguments: Record<string, any>,
    userId: string,
  ): Promise<FunctionCallResult> {
    try {
      logger.info(
        `Handling MCP function call: ${functionName} for user ${userId}`,
      );

      // Parse the function name to extract server and tool info
      const parts = functionName.split('__');
      if (parts.length < 3 || parts[0] !== 'mcp') {
        throw new Error('Invalid MCP function call format');
      }

      const serverId = parts[1];
      const toolName = parts.slice(2).join('__');

      // Get the proper server URL from registry or database
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        serverId,
      );
      let serverUrl = connection?.server_url;

      if (!serverUrl) {
        const serverInfo = await this.registryService?.getServerById(serverId);
        if (serverInfo) {
          serverUrl = serverInfo.mcp_url;
        } else {
          throw new Error(`Server ${serverId} not found`);
        }
      }

      const toolPayload: InvokeToolRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId,
        mcpServerConfigId: serverId,
        mcpServerUrl: serverUrl,
        toolName,
        toolInput: functionArguments,
        invocationId: `${userId}-${serverId}-${Date.now()}`,
      };

      // Create the pending invocation BEFORE starting the tool invocation
      // This ensures the promise exists when the tool result arrives
      const pendingPromise = this.pendingInvocations.createPendingInvocation(
        toolPayload.invocationId,
        userId,
        toolName,
      );

      // Start the tool invocation (this may complete very quickly)
      await this.connectionPool.handleInvokeToolRequest(toolPayload);

      logger.debug(
        `[MCPService] Waiting for tool result for invocation ${toolPayload.invocationId}`,
      );

      const toolResult = await pendingPromise;

      return {
        success: true,
        result: toolResult,
      };
    } catch (error: any) {
      logger.error(`Error handling MCP function call:`, error);
      return {
        success: false,
        error: error.message || 'Failed to execute MCP function',
      };
    }
  }

  /**
   * Handle OAuth callback and reconnect to servers
   */
  async autoReconnectAfterOAuth(
    serverId: string,
    userId: string,
  ): Promise<ConnectionResult> {
    try {
      logger.info(
        `Auto-reconnecting after OAuth for user ${userId}, server ${serverId}`,
      );

      // Get the saved connection info
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        serverId,
      );
      if (!connection) {
        throw new Error('No saved connection found');
      }

      // Attempt to reconnect
      return await this.connectToServer(
        serverId,
        userId,
        connection.server_url,
      );
    } catch (error: any) {
      logger.error(`Error in auto-reconnect after OAuth:`, error);
      return {
        success: false,
        message: error.message || 'Failed to reconnect after OAuth',
      };
    }
  }

  /**
   * Reset server data for a user
   */
  async resetServerData(serverId: string, userId: string): Promise<void> {
    try {
      logger.info(`Resetting server data for ${serverId}, user ${userId}`);

      // Disconnect if connected
      try {
        await this.disconnectFromServer(serverId, userId);
      } catch (error) {
        // Ignore disconnect errors during reset
        logger.warn('Error during disconnect in reset', {
          service: 'MCPService',
          serverId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Delete saved connection data
      await this.databaseService.deleteUserMCPConnection(userId, serverId);

      // Delete OAuth tokens if they exist
      await this.databaseService.deleteOAuthTokens(serverId, userId);

      logger.info(`Successfully reset server data for ${serverId}`);
    } catch (error) {
      logger.error(
        `Error resetting server data for ${serverId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get pending authorization for a server (optional method used with 'as any' casting)
   */
  getPendingAuthorization?(serverId: string, userId: string): Promise<any> {
    return this.databaseService.getOAuthPending(serverId, userId);
  }

  /**
   * Reestablish persistent connections from database
   */
  async reestablishPersistentConnections(): Promise<void> {
    try {
      logger.info('Reestablishing persistent MCP connections...');
      await this.connectionPool.reestablishPersistentConnections();
      logger.info('Persistent MCP connections reestablished successfully');
    } catch (error) {
      logger.error(
        'Error reestablishing persistent connections:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Cleanup method
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down MCPService...');
      await this.connectionPool.shutdownAllConnections();
      this.coordinator.destroy();
      logger.info('MCPService shutdown complete');
    } catch (error) {
      logger.error(
        'Error during MCPService shutdown:',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
