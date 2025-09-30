import { ConnectionPoolService } from '../connections.js';
import { SupabaseService } from '../database.js';
import { MCPEventService } from '../event-emitter.service.js';
import { MCPCoordinatorService } from '../mcp-coordinator.service.js';
import { DiscordNotificationService } from '../discord-notification.service.js';
import { RegistryService, MinimalMCPServer } from '../registry.service.js';
import { PendingToolInvocationsService } from '../pending-tool-invocations.service.js';
import logger from '../../utils/logger.js';
import {
  ConnectionRequestPayload,
  DisconnectRequestPayload,
  InvokeToolRequestPayload,
} from '../../dtos/pubsub.events.dto.js';
import {
  ConnectionResult,
  FunctionCallResult,
  ServerSearchOptions,
} from '../../types/mcp.js';

// Now using ServerSearchOptions from centralized types

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

// Now using centralized ConnectionResult and FunctionCallResult types from ../../types/mcp.js

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

// Removed local FunctionCallResult - now using centralized type from ../../types/mcp.js

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

      // Check registry health by attempting a simple search
      let registryConnected = false;
      try {
        const testResult = await this.registryService?.searchServers({
          limit: 1,
        });
        registryConnected = !!testResult;
      } catch (error) {
        registryConnected = false;
      }

      // Get sample of servers from registry to determine total available
      const registryServers = await this.registryService?.searchServers({
        limit: 1,
      });
      const totalServers = registryServers?.servers?.length ?? 0;

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
    query: ServerSearchOptions,
  ): Promise<PaginatedServerSearchResult> {
    try {
      logger.info('Searching servers with query', {
        service: 'MCPService',
        query: query.query,
        queryLength: query.query?.length || 0,
        category: query.category,
        limit: query.limit,
      });

      // Use the registry service to search for real servers
      logger.debug('Calling registry service with params', {
        service: 'MCPService',
        searchQuery: query.query,
        searchQueryType: typeof query.query,
        searchQueryLength: query.query?.length || 0,
        limit: query.limit || 10,
        hasRegistryService: !!this.registryService,
      });

      if (!this.registryService) {
        logger.error('Registry service is not available');
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

      // Add timeout to prevent hanging
      const registryResponse = await Promise.race([
        this.registryService.searchServers({
          search: query.query,
          limit: query.limit || 10,
        }),
        new Promise<{ servers: []; nextCursor: null }>((_, reject) =>
          setTimeout(() => reject(new Error('Registry search timeout')), 8000),
        ),
      ]);

      logger.debug('Registry service response', {
        service: 'MCPService',
        hasResponse: !!registryResponse,
        hasServers: !!registryResponse?.servers,
        serverCount: registryResponse?.servers?.length || 0,
      });

      if (!registryResponse || !registryResponse.servers) {
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

      // Convert minimal server objects to the format expected by the Discord bot
      const servers: ServerSearchResult[] = registryResponse.servers.map(
        (server) => this.convertMinimalServerToResult(server),
      );

      // Since the new registry service doesn't provide pagination info,
      // we'll simulate it based on the results
      const currentPage = query.page || 1;
      const totalItems = servers.length;
      const hasNextPage = !!registryResponse.nextCursor;

      return {
        servers,
        pagination: {
          page: currentPage,
          totalPages: hasNextPage ? currentPage + 1 : currentPage,
          totalResults: totalItems,
          currentPage: currentPage,
          totalItems: totalItems,
          hasNextPage: hasNextPage,
          hasPreviousPage: currentPage > 1,
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

      // Check if this is a custom URL server (serverId starts with 'custom-url-')
      const isCustomUrl = serverId.startsWith('custom-url-');

      let actualServerUrl = serverUrl;
      if (!actualServerUrl) {
        if (isCustomUrl) {
          // For custom URLs, first try to get the URL from existing connection
          // This handles the case where user is reconnecting via namespace
          const existingConnection =
            await this.databaseService.getUserMCPConnection(userId, serverId);

          if (existingConnection && existingConnection.server_url) {
            actualServerUrl = existingConnection.server_url;
            logger.info(
              `Found saved URL for custom server: ${actualServerUrl}`,
              {
                service: 'MCPService',
                serverId,
                serverUrl: actualServerUrl,
              },
            );
          } else {
            // If no saved URL and no serverUrl provided, this is an error
            throw new Error(
              `Custom URL server ${serverId} requires serverUrl parameter to be provided or have a saved connection with server_url`,
            );
          }
        } else {
          // For registry servers, look up the URL from the registry
          const serverInfo =
            await this.registryService?.getServerById(serverId);
          if (serverInfo && serverInfo.url) {
            actualServerUrl = serverInfo.url;
            logger.info(`Found server URL from registry: ${actualServerUrl}`, {
              service: 'MCPService',
              serverId,
              serverUrl: actualServerUrl,
            });
          } else if (serverInfo) {
            throw new Error(
              `Server ${serverId} found in registry but has no url property`,
            );
          } else {
            throw new Error(`Server ${serverId} not found in registry`);
          }
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

      // Start the connection process
      await this.connectionPool.handleConnectionRequest(connectionPayload);

      // Wait for the connection to complete (or fail) by polling the database
      const maxWaitTime = 120000; // 2 minutes
      const pollInterval = 1000; // 1 second
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));

        try {
          const connection = await this.databaseService.getUserMCPConnection(
            userId,
            serverId,
          );
          logger.info(
            `Polling connection status: ${connection ? `status=${connection.status}` : 'not found'} (userId: ${userId}, serverId: ${serverId})`,
          );
          if (connection) {
            if (connection.status === 'connected') {
              return {
                success: true,
                message: 'Successfully connected to MCP server!',
                connectionId: serverId,
                status: 'connected',
                server_name: connection.server_name || serverId,
                tools: connection.tools ? JSON.parse(connection.tools) : [],
                connection: {
                  server_name: connection.server_name || serverId,
                  tools: connection.tools ? JSON.parse(connection.tools) : [],
                },
              };
            } else if (
              connection.status === 'error' ||
              connection.status === 'disconnected'
            ) {
              throw new Error(connection.error_message || 'Connection failed');
            } else if (connection.status === 'auth-required') {
              return {
                success: false,
                message: 'Authentication required',
                authRequired: true,
                status: 'auth-required',
                connectionId: serverId,
                server_name: connection.server_name || serverId,
                // TODO: Include auth URL if available
              };
            }
            // If status is 'reconnecting' or other intermediate state, continue polling
          }
        } catch (dbError) {
          // If this is a connection error (not a database error), re-throw it to exit the polling loop
          if (
            dbError instanceof Error &&
            !dbError.message.includes('DATABASE') &&
            !dbError.message.includes('timeout')
          ) {
            throw dbError;
          }
          logger.warn(
            `Error checking connection status: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
          );
        }
      }

      // Timeout - check final status
      try {
        const finalConnection = await this.databaseService.getUserMCPConnection(
          userId,
          serverId,
        );
        if (finalConnection) {
          throw new Error(
            `Connection timeout. Final status: ${finalConnection.status}. ${finalConnection.error_message || ''}`,
          );
        }
      } catch (dbError) {
        // Ignore database errors at this point
      }

      throw new Error(
        'Connection timeout - the server may be unreachable or taking too long to respond',
      );
    } catch (error: any) {
      logger.error(
        `Error connecting to server ${serverId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );

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

      // Check if this is a custom URL server (serverId starts with 'custom-url-')
      const isCustomUrl = serverId.startsWith('custom-url-');

      // Get the connection to find the server URL
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        serverId,
      );
      let serverUrl = connection?.server_url;

      // If no saved server URL, handle based on server type
      if (!serverUrl) {
        if (isCustomUrl) {
          // For custom URLs, we need the saved URL from the connection
          // If it's missing, use a fallback that won't cause registry lookups
          logger.warn(
            `Custom URL server ${serverId} missing server_url, using fallback`,
          );
          serverUrl = `https://custom-server/${serverId}`;
        } else {
          // For registry servers, try to get it from registry
          const serverInfo =
            await this.registryService?.getServerById(serverId);
          if (serverInfo) {
            serverUrl = serverInfo.url;
          } else {
            logger.warn(
              `Could not find server URL for ${serverId}, using fallback`,
            );
            serverUrl = `https://unknown-server/${serverId}`;
          }
        }
      }

      const disconnectPayload: DisconnectRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId,
        mcpServerConfigId: serverId,
        mcpServerUrl: serverUrl || `https://unknown-server/${serverId}`,
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
   * Sanitizes a server name to be used in function names
   * Removes spaces, special characters, and limits length
   */
  private sanitizeServerName(serverName: string): string {
    return serverName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/__+/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 20); // Limit to 20 characters
  }

  /**
   * Resolve a server name to a server ID for a given user
   */
  async resolveServerNameToId(
    userId: string,
    serverName: string,
  ): Promise<string | null> {
    try {
      const connections = await this.getUserConnections(userId);

      // Try exact match first
      const exactMatch = connections.find(
        (conn) => conn.server_name === serverName,
      );
      if (exactMatch) {
        return exactMatch.server_id;
      }

      // Try case-insensitive match
      const caseInsensitiveMatch = connections.find(
        (conn) => conn.server_name.toLowerCase() === serverName.toLowerCase(),
      );
      if (caseInsensitiveMatch) {
        return caseInsensitiveMatch.server_id;
      }

      // Try sanitized name match (for backward compatibility)
      const sanitizedInputName = this.sanitizeServerName(serverName);
      const sanitizedMatch = connections.find(
        (conn) =>
          this.sanitizeServerName(conn.server_name) === sanitizedInputName,
      );
      if (sanitizedMatch) {
        return sanitizedMatch.server_id;
      }

      logger.warn(
        `Could not resolve server name "${serverName}" to ID for user ${userId}`,
      );
      return null;
    } catch (error) {
      logger.error(`Error resolving server name to ID: ${error}`);
      return null;
    }
  }

  /**
   * Converts a MinimalMCPServer to ServerSearchResult format
   */
  private convertMinimalServerToResult(
    server: MinimalMCPServer,
  ): ServerSearchResult {
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      url: server.url,
      // Optional properties can be undefined since they're not available in minimal type
      category: undefined,
      author: undefined,
      isOAuthEnabled: undefined,
      tags: undefined,
      auth_type: undefined,
      hosted_on: undefined,
    };
  }

  /**
   * Finds a connection by sanitized server name
   */
  private async findConnectionBySanitizedName(
    userId: string,
    sanitizedName: string,
  ): Promise<any | null> {
    try {
      const connections = await this.getUserConnections(userId);

      // Find connection where sanitized server name matches
      for (const connection of connections) {
        if (this.sanitizeServerName(connection.server_name) === sanitizedName) {
          return connection;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error finding connection by sanitized name: ${error}`);
      return null;
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

        // Use sanitized server name instead of UUID for AI-friendly function names
        const sanitizedServerName = this.sanitizeServerName(tool.serverName);

        return {
          name: `mcp__${sanitizedServerName}__${tool.name}`,
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

      const sanitizedServerName = parts[1];
      const toolName = parts.slice(2).join('__');

      // Find the connection by sanitized server name
      const connection = await this.findConnectionBySanitizedName(
        userId,
        sanitizedServerName,
      );

      if (!connection) {
        throw new Error(
          `No connection found for server with name: ${sanitizedServerName}`,
        );
      }

      const serverId = connection.server_id;
      const isCustomUrl = serverId.startsWith('custom-url-');
      let serverUrl = connection?.server_url;

      if (!serverUrl) {
        if (isCustomUrl) {
          throw new Error(
            `Custom URL server ${serverId} is missing server_url in database`,
          );
        } else {
          const serverInfo =
            await this.registryService?.getServerById(serverId);
          if (serverInfo) {
            serverUrl = serverInfo.url;
          } else {
            throw new Error(`Server ${serverId} not found`);
          }
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
   * Completely delete/remove a server connection (disconnect + delete database records)
   */
  async deleteServerConnection(
    serverId: string,
    userId: string,
  ): Promise<void> {
    try {
      logger.info(`Deleting server connection ${serverId} for user ${userId}`);

      // First disconnect from the server if connected
      try {
        await this.disconnectFromServer(serverId, userId);
      } catch (error) {
        // Ignore disconnect errors - might already be disconnected
        logger.warn(
          `Disconnect during delete failed (ignoring): ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Then delete all database records and OAuth tokens
      await this.resetServerData(serverId, userId);

      logger.info(
        `Successfully deleted server connection ${serverId} for user ${userId}`,
      );
    } catch (error) {
      logger.error(
        `Error deleting server connection ${serverId}:`,
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
   * Get diagnostic information about connection states
   */
  async getConnectionDiagnostics(userId: string): Promise<{
    databaseConnections: any[];
    activeConnections: any;
    mismatchedConnections: string[];
  }> {
    // Get connections from database
    const dbConnections =
      await this.databaseService.getUserMCPConnections(userId);

    // Get active connections from pool
    const activeConnectionsInfo = this.connectionPool.getDiagnosticInfo();

    // Find mismatched connections (in DB but not active, or vice versa)
    const dbConnectionIds = dbConnections.map(
      (conn) => `${conn.user_id}::${conn.server_id}`,
    );
    const activeConnectionIds = activeConnectionsInfo.activeConnectionKeys;

    const mismatchedConnections = [
      ...dbConnectionIds.filter((id) => !activeConnectionIds.includes(id)),
      ...activeConnectionIds.filter((id) => !dbConnectionIds.includes(id)),
    ];

    return {
      databaseConnections: dbConnections,
      activeConnections: activeConnectionsInfo,
      mismatchedConnections,
    };
  }

  /**
   * Clean up stale connections that exist in database but not in active pool
   */
  async cleanupStaleConnections(userId: string): Promise<{
    cleanedCount: number;
    cleanedConnections: string[];
    remainingConnections: number;
  }> {
    const diagnostics = await this.getConnectionDiagnostics(userId);
    const cleanedConnections: string[] = [];

    // Find connections that are marked as connected in DB but not active in pool
    for (const dbConn of diagnostics.databaseConnections) {
      const poolKey = `${dbConn.user_id}::${dbConn.server_id}`;

      // If connection shows as connected in DB but is not in active pool, mark as disconnected
      if (
        dbConn.status === 'connected' &&
        !diagnostics.activeConnections.activeConnectionKeys.includes(poolKey)
      ) {
        logger.info(`[MCPService] Cleaning up stale connection: ${poolKey}`);

        // Update the connection status in database to disconnected
        await this.databaseService.updateUserMCPConnection(
          dbConn.user_id,
          dbConn.server_id,
          {
            status: 'disconnected',
            error_message: 'Cleaned up stale connection',
          },
        );

        cleanedConnections.push(poolKey);
      }
    }

    // Get remaining active connections count
    const remainingConnections =
      diagnostics.activeConnections.activeConnectionCount;

    return {
      cleanedCount: cleanedConnections.length,
      cleanedConnections,
      remainingConnections,
    };
  }

  /**
   * Repair corrupted database records by fixing missing required fields
   */
  async repairCorruptedConnections(userId: string): Promise<{
    repairedCount: number;
    repairedConnections: Array<{
      id: string;
      issues: string[];
      fixes: string[];
    }>;
    healthyConnections: number;
  }> {
    const dbConnections =
      await this.databaseService.getUserMCPConnections(userId);
    const repairedConnections: Array<{
      id: string;
      issues: string[];
      fixes: string[];
    }> = [];

    for (const dbConn of dbConnections) {
      const issues: string[] = [];
      const fixes: string[] = [];
      const poolKey = `${dbConn.user_id}::${dbConn.server_id}`;

      // Check if this is a custom URL server
      const isCustomUrl = dbConn.server_id.startsWith('custom-url-');

      // Check for missing or empty server_url
      if (!dbConn.server_url || dbConn.server_url.trim() === '') {
        issues.push('Missing server_url');

        if (isCustomUrl) {
          // For custom URLs, we can't repair missing URLs from registry
          // Mark as disconnected and require manual reconnection
          fixes.push(
            'Custom URL server missing URL - marked as disconnected (requires manual reconnection)',
          );

          await this.databaseService.updateUserMCPConnection(
            dbConn.user_id,
            dbConn.server_id,
            {
              status: 'disconnected',
              error_message: 'Custom URL missing - please reconnect manually',
            },
          );
        } else {
          // Try to get the server_url from the registry based on server_id (registry servers only)
          try {
            console.log('REGISTRY SERVICE:', this.registryService);
            const serverInfo = await this.registryService?.getServerById(
              dbConn.server_id,
            );
            console.log('SERVER INFO:', serverInfo);
            if (serverInfo && serverInfo.url) {
              fixes.push(`Set server_url to: ${serverInfo.url}`);

              // Update the database record
              await this.databaseService.updateUserMCPConnection(
                dbConn.user_id,
                dbConn.server_id,
                {
                  server_url: serverInfo.url,
                  error_message: null, // Clear any previous error
                },
              );
            } else {
              fixes.push(
                'Could not find server URL in registry - marked as disconnected',
              );

              // If we can't find the server, mark it as disconnected
              await this.databaseService.updateUserMCPConnection(
                dbConn.user_id,
                dbConn.server_id,
                {
                  status: 'disconnected',
                  error_message: 'Server not found in registry - URL missing',
                },
              );
            }
          } catch (error) {
            logger.error(
              `[MCPService] Error repairing connection ${poolKey}:`,
              error instanceof Error ? error : new Error(String(error)),
            );
            fixes.push('Error occurred during repair - marked as disconnected');

            await this.databaseService.updateUserMCPConnection(
              dbConn.user_id,
              dbConn.server_id,
              {
                status: 'disconnected',
                error_message: 'Repair failed - please reconnect manually',
              },
            );
          }
        }
      }

      // Check for missing server_name
      if (!dbConn.server_name || dbConn.server_name.trim() === '') {
        issues.push('Missing server_name');

        if (isCustomUrl) {
          // For custom URLs, generate a name from the server_id
          const serverName = `Custom Server ${dbConn.server_id.replace('custom-url-', '').substring(0, 20)}`;
          fixes.push(`Set server_name to: ${serverName}`);

          await this.databaseService.updateUserMCPConnection(
            dbConn.user_id,
            dbConn.server_id,
            { server_name: serverName },
          );
        } else {
          // For registry servers, try to get name from registry
          try {
            const serverInfo = await this.registryService?.getServerById(
              dbConn.server_id,
            );
            if (serverInfo && serverInfo.name) {
              fixes.push(`Set server_name to: ${serverInfo.name}`);

              await this.databaseService.updateUserMCPConnection(
                dbConn.user_id,
                dbConn.server_id,
                { server_name: serverInfo.name },
              );
            }
          } catch (error) {
            fixes.push('Could not repair server_name');
          }
        }
      }

      if (issues.length > 0) {
        repairedConnections.push({
          id: poolKey,
          issues,
          fixes,
        });

        logger.info(
          `[MCPService] Repaired connection ${poolKey}: ${issues.join(', ')}`,
        );
      }
    }

    return {
      repairedCount: repairedConnections.length,
      repairedConnections,
      healthyConnections: dbConnections.length - repairedConnections.length,
    };
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
