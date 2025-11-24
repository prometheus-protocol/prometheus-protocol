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
  title?: string; // Human-readable display name from MCP tool metadata
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
  private userConnectionsCache: Map<
    string,
    { connections: any[]; timestamp: number }
  > = new Map();
  private userToolsCache: Map<
    string,
    { tools: ToolInfo[]; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL_MS = 5000; // 5 second cache

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
      // TODO: Update to query across all channels for system-level stats
      const connections = await this.databaseService.getUserMCPConnections(
        'system',
        'default',
      ); // Use system user for overall stats
      const activeConnections = connections.filter(
        (conn) => conn.status === 'connected',
      ).length;

      // Calculate total available tools across all connected users
      let totalAvailableTools = 0;
      try {
        // Get tools for system user (overall stats)
        // TODO: Update to aggregate across all channels
        const systemTools = await this.getAvailableTools('system', 'default');
        totalAvailableTools = systemTools.length;
      } catch (toolsError) {
        logger.warn(
          'Failed to calculate available tools count for system status',
        );
      }

      const status: SystemStatus = {
        activeConnections,
        totalServers: 0, // No longer using registry
        healthStatus: activeConnections >= 0 ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        registryConnected: false, // No longer using registry
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
   * Get user's MCP connections (with caching to avoid redundant DB calls)
   */
  async getUserConnections(userId: string, channelId: string): Promise<any[]> {
    try {
      const cacheKey = `${userId}:${channelId}`;
      const now = Date.now();

      // Check cache first
      const cached = this.userConnectionsCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
        logger.debug(`Using cached connections for ${cacheKey}`);
        return cached.connections;
      }

      // Fetch from database
      const connections = await this.databaseService.getUserMCPConnections(
        userId,
        channelId,
      );

      // Update cache
      this.userConnectionsCache.set(cacheKey, {
        connections,
        timestamp: now,
      });

      // Clean up old cache entries (simple cleanup)
      if (this.userConnectionsCache.size > 100) {
        const keysToDelete: string[] = [];
        for (const [key, value] of this.userConnectionsCache.entries()) {
          if (now - value.timestamp > this.CACHE_TTL_MS) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key) => this.userConnectionsCache.delete(key));
      }

      return connections;
    } catch (error) {
      logger.error(`Error fetching user connections: ${error}`);
      return [];
    }
  }

  /**
   * Invalidate cached connections for a user
   */
  private invalidateUserConnectionsCache(
    userId: string,
    channelId: string,
  ): void {
    const cacheKey = `${userId}:${channelId}`;
    this.userConnectionsCache.delete(cacheKey);
    this.userToolsCache.delete(cacheKey);
    logger.debug(`Invalidated connection and tools cache for ${cacheKey}`);
  }

  /**
   * Connect to an MCP server
   * @param channelId - Discord channel ID for channel-scoped connections
   */
  async connectToServer(
    serverId: string,
    userId: string,
    serverUrl?: string,
    channelId: string = 'default',
  ): Promise<ConnectionResult> {
    try {
      logger.info(`Connecting user ${userId} to server ${serverId}`);

      // All connections are now URL-based (no registry)
      let actualServerUrl = serverUrl;
      if (!actualServerUrl) {
        // Try to get the URL from existing connection
        // This handles the case where user is reconnecting
        const existingConnection =
          await this.databaseService.getUserMCPConnection(
            userId,
            channelId,
            serverId,
          );

        if (existingConnection && existingConnection.server_url) {
          actualServerUrl = existingConnection.server_url;
          logger.info(`Found saved URL for server: ${actualServerUrl}`, {
            service: 'MCPService',
            serverId,
            serverUrl: actualServerUrl,
          });
        } else {
          // If no saved URL and no serverUrl provided, this is an error
          throw new Error(
            `Server ${serverId} requires serverUrl parameter or existing connection with server_url`,
          );
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

      // Check if this server URL is already connected for this user+channel
      // BUT skip this check if we're reconnecting to the same serverId
      const existingConnections =
        await this.databaseService.getUserMCPConnections(userId, channelId);

      const duplicateConnection = existingConnections.find(
        (conn) =>
          conn.server_url === actualServerUrl && conn.server_id !== serverId,
      );

      if (duplicateConnection) {
        throw new Error(
          `You are already connected to this server as "${duplicateConnection.server_name}". Please disconnect or delete the existing connection first.`,
        );
      }

      const connectionPayload: ConnectionRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId, // Using userId as userId for Discord bot
        channelId: channelId,
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
            channelId,
            serverId,
          );
          logger.info(
            `Polling connection status: ${connection ? `status=${connection.status}` : 'not found'} (userId: ${userId}, serverId: ${serverId})`,
          );
          if (connection) {
            if (connection.status === 'connected') {
              // Invalidate cache since connection status changed
              this.invalidateUserConnectionsCache(userId, channelId);

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
              // Invalidate cache since connection status changed
              this.invalidateUserConnectionsCache(userId, channelId);
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
          channelId,
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
  async disconnectFromServer(
    serverId: string,
    userId: string,
    channelId: string = 'default',
  ): Promise<void> {
    try {
      logger.info(`Disconnecting user ${userId} from server ${serverId}`);

      // Get the connection to find the server URL
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        channelId,
        serverId,
      );
      let serverUrl = connection?.server_url;

      // If no saved server URL, use a fallback
      if (!serverUrl) {
        logger.warn(`Server ${serverId} missing server_url, using fallback`);
        serverUrl = `https://server/${serverId}`;
      }

      const disconnectPayload: DisconnectRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId,
        channelId: channelId,
        mcpServerConfigId: serverId,
        mcpServerUrl: serverUrl,
      };

      await this.connectionPool.handleDisconnectRequest(disconnectPayload);

      // Invalidate cache since connection was removed
      this.invalidateUserConnectionsCache(userId, channelId);

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
  /**
   * Strip legacy prefix from tool names (backward compatibility)
   * Old format: mcpcustom_url_https_example_com_toolname
   * New format: toolname
   */
  private stripLegacyPrefix(toolName: string): string {
    // Match pattern: mcpcustom_url_*_actualToolName
    const legacyPattern = /^mcpcustom_url_[^_]+_(.+)$/;
    const match = toolName.match(legacyPattern);

    if (match && match[1]) {
      return match[1];
    }

    return toolName;
  }

  async getAvailableTools(
    userId: string,
    channelId: string,
  ): Promise<ToolInfo[]> {
    try {
      const cacheKey = `${userId}:${channelId}`;
      const now = Date.now();

      // Check cache first
      const cached = this.userToolsCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
        logger.debug(`Using cached tools for ${cacheKey}`);
        return cached.tools;
      }

      const connections = await this.getUserConnections(userId, channelId);
      const tools: ToolInfo[] = [];

      logger.info(
        `[MCPService] getAvailableTools - found ${connections.length} connections for user ${userId}`,
      );

      // Fetch available tools from each connected MCP server
      for (const connection of connections) {
        logger.info(
          `[MCPService] Connection ${connection.server_name}: status=${connection.status}, has_tools=${!!connection.tools}, tools_length=${connection.tools?.length || 0}`,
        );

        if (connection.status === 'connected' && connection.tools) {
          try {
            // Parse the tools JSON from the database
            const serverTools = JSON.parse(connection.tools);
            logger.info(
              `[MCPService] Parsed ${serverTools.length} tools from ${connection.server_name}`,
            );

            // Convert MCP SDK Tool objects to ToolInfo format
            for (const tool of serverTools) {
              // Strip legacy prefix for backward compatibility
              const cleanName = this.stripLegacyPrefix(tool.name);

              const toolInfo: ToolInfo = {
                name: cleanName,
                title: tool.title, // Include human-readable title if available
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

      // Update cache
      this.userToolsCache.set(cacheKey, {
        tools,
        timestamp: now,
      });

      // Clean up old cache entries (simple cleanup)
      if (this.userToolsCache.size > 100) {
        const keysToDelete: string[] = [];
        for (const [key, value] of this.userToolsCache.entries()) {
          if (now - value.timestamp > this.CACHE_TTL_MS) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key) => this.userToolsCache.delete(key));
      }

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
   * Get display name for a tool (uses title if available, falls back to name)
   */
  async getToolDisplayName(
    userId: string,
    functionName: string,
    channelId: string = 'default',
  ): Promise<string> {
    try {
      // Parse function name (could be "toolname" or "hash_toolname")
      let toolName: string;

      if (functionName.includes('_') && functionName.match(/^[a-z0-9]{4}_/)) {
        // Format: hash_toolname (collision case)
        const parts = functionName.split('_');
        toolName = parts.slice(1).join('_');
      } else {
        // Format: toolname (no collision)
        toolName = functionName;
      }

      // Get all tools and find the matching one
      const tools = await this.getAvailableTools(userId, channelId);
      const tool = tools.find((t) => t.name === toolName);

      if (tool?.title) {
        return tool.title;
      }

      // Fallback to the original function name
      return functionName;
    } catch (error) {
      logger.warn(`Could not get tool display name for ${functionName}`);
      return functionName;
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
    channelId: string = 'default',
  ): Promise<string | null> {
    try {
      const connections = await this.getUserConnections(userId, channelId);

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
    channelId: string = 'default',
  ): Promise<any | null> {
    try {
      const connections = await this.getUserConnections(userId, channelId);

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
   * Generate a short 4-character hash from a string
   */
  private generateShortHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to base36 and take first 4 characters
    return Math.abs(hash).toString(36).substring(0, 4);
  }

  /**
   * Convert available tools to OpenAI function format for LLM integration
   * Uses clean tool names by default, only adds prefix on collision
   */
  async convertToolsToOpenAIFunctions(
    userId: string,
    channelId: string = 'default',
  ): Promise<any[]> {
    try {
      const tools = await this.getAvailableTools(userId, channelId);

      // Track tool name usage to detect collisions
      const toolNameCounts = new Map<string, number>();
      const toolNameToServer = new Map<string, string[]>();

      // First pass: count occurrences of each tool name
      for (const tool of tools) {
        const count = toolNameCounts.get(tool.name) || 0;
        toolNameCounts.set(tool.name, count + 1);

        const servers = toolNameToServer.get(tool.name) || [];
        servers.push(tool.serverName);
        toolNameToServer.set(tool.name, servers);
      }

      // Second pass: generate function names with prefixes only for collisions
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

        // Check if this tool name has collisions
        const hasCollision = (toolNameCounts.get(tool.name) || 0) > 1;

        let functionName: string;
        if (hasCollision) {
          // Generate a short 4-character hash from the server name
          const serverHash = this.generateShortHash(tool.serverName);
          functionName = `${serverHash}_${tool.name}`;
        } else {
          // No collision, use the clean tool name
          functionName = tool.name;
        }

        return {
          name: functionName,
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
   * Now handles both clean tool names and prefixed names (hash_toolname)
   */
  async handleMCPFunctionCall(
    functionName: string,
    functionArguments: Record<string, any>,
    userId: string,
    channelId: string = 'default',
  ): Promise<FunctionCallResult> {
    try {
      logger.info(
        `Handling MCP function call: ${functionName} for user ${userId}`,
      );

      // Get all user connections first
      const connections = await this.getUserConnections(userId, channelId);

      // Strategy: Try to find the tool with the exact name first
      // Only if that fails AND the name looks like hash_toolname, try splitting it
      let toolName: string = functionName;
      let serverHash: string | null = null;
      let targetConnection = null;

      // First attempt: Try to find a connection with the exact function name
      for (const conn of connections) {
        const connTools = JSON.parse(conn.tools || '[]');
        if (connTools.some((t: any) => t.name === functionName)) {
          targetConnection = conn;
          toolName = functionName;
          break;
        }
      }

      // Second attempt: If not found and name matches hash pattern, try splitting
      if (
        !targetConnection &&
        functionName.includes('_') &&
        functionName.match(/^[a-z0-9]{4}_/)
      ) {
        // Format might be: hash_toolname (collision case)
        const parts = functionName.split('_');
        const potentialHash = parts[0];
        const potentialToolName = parts.slice(1).join('_');

        // Find the connection with matching hash
        for (const conn of connections) {
          const connHash = this.generateShortHash(conn.server_name);
          if (connHash === potentialHash) {
            // Verify this connection actually has the tool
            const connTools = JSON.parse(conn.tools || '[]');
            if (connTools.some((t: any) => t.name === potentialToolName)) {
              targetConnection = conn;
              toolName = potentialToolName;
              serverHash = potentialHash;
              break;
            }
          }
        }
      }

      if (!targetConnection) {
        logger.error(
          `[MCPService] Failed to find tool ${toolName}. Available connections: ${connections.map((c) => c.server_name).join(', ')}`,
        );
        throw new Error(`No connection found with tool: ${functionName}`);
      }

      const serverId = targetConnection.server_id;
      let serverUrl = targetConnection?.server_url;

      if (!serverUrl) {
        throw new Error(`Server ${serverId} is missing server_url in database`);
      }

      const toolPayload: InvokeToolRequestPayload = {
        generatedAt: new Date().toISOString(),
        userId: userId,
        channelId: channelId,
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
    channelId: string = 'default',
  ): Promise<ConnectionResult> {
    try {
      logger.info(
        `Auto-reconnecting after OAuth for user ${userId}, server ${serverId}`,
      );

      // Get the saved connection info
      const connection = await this.databaseService.getUserMCPConnection(
        userId,
        channelId,
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
        channelId,
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
  async resetServerData(
    serverId: string,
    userId: string,
    channelId: string = 'default',
  ): Promise<void> {
    try {
      logger.info(`Resetting server data for ${serverId}, user ${userId}`);

      // Disconnect if connected
      try {
        await this.disconnectFromServer(serverId, userId, channelId);
      } catch (error) {
        // Ignore disconnect errors during reset
        logger.warn('Error during disconnect in reset', {
          service: 'MCPService',
          serverId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Delete saved connection data
      await this.databaseService.deleteUserMCPConnection(
        userId,
        channelId,
        serverId,
      );

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
    channelId: string = 'default',
  ): Promise<void> {
    try {
      logger.info(`Deleting server connection ${serverId} for user ${userId}`);

      // First disconnect from the server if connected
      try {
        await this.disconnectFromServer(serverId, userId, channelId);
      } catch (error) {
        // Ignore disconnect errors - might already be disconnected
        logger.warn(
          `Disconnect during delete failed (ignoring): ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Then delete all database records and OAuth tokens
      await this.resetServerData(serverId, userId, channelId);

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
  async getConnectionDiagnostics(
    userId: string,
    channelId: string = 'default',
  ): Promise<{
    databaseConnections: any[];
    activeConnections: any;
    mismatchedConnections: string[];
  }> {
    // Get connections from database
    const dbConnections = await this.databaseService.getUserMCPConnections(
      userId,
      channelId,
    );

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
  async cleanupStaleConnections(
    userId: string,
    channelId: string = 'default',
  ): Promise<{
    cleanedCount: number;
    cleanedConnections: string[];
    remainingConnections: number;
  }> {
    const diagnostics = await this.getConnectionDiagnostics(userId, channelId);
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
          dbConn.channel_id,
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
  async repairCorruptedConnections(
    userId: string,
    channelId: string = 'default',
  ): Promise<{
    repairedCount: number;
    repairedConnections: Array<{
      id: string;
      issues: string[];
      fixes: string[];
    }>;
    healthyConnections: number;
  }> {
    const dbConnections = await this.databaseService.getUserMCPConnections(
      userId,
      channelId,
    );
    const repairedConnections: Array<{
      id: string;
      issues: string[];
      fixes: string[];
    }> = [];

    for (const dbConn of dbConnections) {
      const issues: string[] = [];
      const fixes: string[] = [];
      const poolKey = `${dbConn.user_id}::${dbConn.server_id}`;

      // Check for missing or empty server_url
      if (!dbConn.server_url || dbConn.server_url.trim() === '') {
        issues.push('Missing server_url');

        // All servers are now URL-based, mark as disconnected and require manual reconnection
        fixes.push(
          'Server missing URL - marked as disconnected (requires manual reconnection)',
        );

        await this.databaseService.updateUserMCPConnection(
          dbConn.user_id,
          dbConn.channel_id,
          dbConn.server_id,
          {
            status: 'disconnected',
            error_message: 'Server URL missing - please reconnect manually',
          },
        );
      }

      // Check for missing server_name
      if (!dbConn.server_name || dbConn.server_name.trim() === '') {
        issues.push('Missing server_name');

        // Generate a name from the server_url if available
        let serverName = 'Unnamed Server';
        if (dbConn.server_url) {
          try {
            const url = new URL(dbConn.server_url);
            serverName = `${url.hostname}`;
          } catch {
            serverName = dbConn.server_id.substring(0, 20);
          }
        } else {
          serverName = dbConn.server_id.substring(0, 20);
        }

        fixes.push(`Set server_name to: ${serverName}`);

        await this.databaseService.updateUserMCPConnection(
          dbConn.user_id,
          dbConn.channel_id,
          dbConn.server_id,
          { server_name: serverName },
        );
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
