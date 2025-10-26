import { SupabaseService } from './database.js';
import { DiscordNotificationService } from './discord-notification.service.js';
import logger from '../utils/logger.js';
import {
  MCPAuthRequiredEvent,
  MCPToolsFetchedEvent,
  MCPResourceDataFetchedEvent,
  MCPNotificationEvent,
  MCPToolResultEvent,
  MCPServerCapabilitiesEvent,
  MCPConnectionStatusUpdateEvent,
  MCPResourcesFetchedEvent,
  MCPToolInvocationProgressEvent,
  MCPSamplingRequestReceivedEvent,
  MCPElicitationRequestReceivedEvent,
} from '../dtos/mcp.shared.types.dto.js';
import { SavedMCPConnection } from '../types/index.js';

/**
 * Service to handle MCP events that were previously handled via PubSub.
 * Now handles events directly in the Discord bot monolith by updating the database
 * and triggering any necessary follow-up actions.
 *
 * Simplified for Discord bot use case - uses existing MCP connection table.
 */
export class MCPEventHandlerService {
  constructor(
    private databaseService: SupabaseService,
    private discordNotification?: DiscordNotificationService,
  ) {}

  /**
   * Handle MCP authentication required event
   * Updates the server connection with OAuth details and sends Discord notification
   */
  async handleAuthRequired(payload: MCPAuthRequiredEvent): Promise<void> {
    const { userId, channelId, mcpServerConfigId, mcpServerUrl, oauthAuthorizationUrl } =
      payload;

    logger.info(
      `[MCPEventHandler] Auth required for server ${mcpServerConfigId}`,
    );

    try {
      // For Discord bot, we map userId to userId (Discord user)
      const existingConnection =
        await this.databaseService.getUserMCPConnection(
          userId, // userId in Discord context
          channelId,
          mcpServerConfigId,
        );

      // Generate a better fallback name from URL if needed
      let fallbackName = 'MCP Server';
      if (mcpServerUrl || existingConnection?.server_url) {
        try {
          const url = new URL(mcpServerUrl || existingConnection!.server_url);
          fallbackName = url.hostname;
        } catch {
          fallbackName = 'MCP Server';
        }
      }

      const serverName = existingConnection?.server_name || fallbackName;

      const connectionData: SavedMCPConnection = {
        user_id: userId,
        channel_id: channelId,
        server_id: mcpServerConfigId,
        server_name: serverName,
        server_url: mcpServerUrl || existingConnection?.server_url || '', // Use actual MCP server URL
        status: 'auth-required',
        tools: existingConnection?.tools || '[]',
        error_message: null,
        connected_at: null,
        last_used: null,
      };

      await this.databaseService.saveUserMCPConnection(connectionData);

      // Send Discord notification with auth URL
      if (this.discordNotification && oauthAuthorizationUrl) {
        await this.discordNotification.sendAuthRequiredMessage(
          userId,
          serverName,
          oauthAuthorizationUrl,
        );
      }

      logger.info(
        `[MCPEventHandler] Updated server ${mcpServerConfigId} status to auth-required and sent Discord notification`,
      );
    } catch (error) {
      logger.error(
        `[MCPEventHandler] Error handling auth required for ${mcpServerConfigId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Handle tools fetched event
   * Updates the connection with tools data
   */
  async handleToolsFetched(payload: MCPToolsFetchedEvent): Promise<void> {
    const { userId, channelId, mcpServerConfigId, tools } = payload;

    logger.info(
      `[MCPEventHandler] Tools fetched for ${mcpServerConfigId}: ${tools.length} tools`,
    );

    try {
      // Small delay to ensure handleServerCapabilities has committed its changes
      // This is necessary because both handlers run in parallel during reconnection
      await new Promise((resolve) => setTimeout(resolve, 100));

      const existingConnection =
        await this.databaseService.getUserMCPConnection(
          userId,
          channelId,
          mcpServerConfigId,
        );

      if (!existingConnection) {
        logger.warn(
          `[MCPEventHandler] No existing connection found for ${mcpServerConfigId}`,
        );
        return;
      }

      logger.info(
        `[MCPEventHandler] handleToolsFetched - existing="${existingConnection.server_name}", preserving all fields`,
      );

      // Use spread operator to preserve ALL existing fields, only update tools and timestamps
      const connectionData: SavedMCPConnection = {
        ...existingConnection,
        tools: JSON.stringify(tools),
        last_used: new Date(),
      };

      await this.databaseService.saveUserMCPConnection(connectionData);

      logger.info(
        `[MCPEventHandler] Successfully synced ${tools.length} tools for ${mcpServerConfigId} with server_name="${connectionData.server_name}"`,
      );
    } catch (error) {
      logger.error(
        `[MCPEventHandler] Error syncing tools for ${mcpServerConfigId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Handle resources fetched event
   * For Discord bot, we'll just log this since we don't have a separate resources table
   */
  async handleResourcesFetched(
    payload: MCPResourcesFetchedEvent,
  ): Promise<void> {
    const { userId, mcpServerConfigId, resources } = payload;

    logger.info(
      `[MCPEventHandler] Resources fetched for ${mcpServerConfigId}: ${resources.length} resources`,
    );

    // For Discord bot, resources aren't stored separately
    // Could be extended in the future if needed
    logger.debug(
      `[MCPEventHandler] Resources for ${mcpServerConfigId}: ${resources.map((r) => r.uri).join(', ')}`,
    );
  }

  /**
   * Handle resource data fetched event
   * For Discord bot, we'll just log this since we don't have resource storage
   */
  async handleResourceDataFetched(
    payload: MCPResourceDataFetchedEvent,
  ): Promise<void> {
    const { mcpServerConfigId, uri, text, blob, sizeBytes } = payload;

    logger.info(
      `[MCPEventHandler] Resource data fetched for ${uri} from ${mcpServerConfigId} (text: ${!!text}, blob: ${!!blob}, size: ${sizeBytes})`,
    );

    // For Discord bot, we don't store resource content
    // Could be extended in the future if needed
  }

  /**
   * Handle connection status update
   * Updates the connection status
   */
  async handleConnectionStatusUpdate(
    payload: MCPConnectionStatusUpdateEvent,
  ): Promise<void> {
    const { userId, channelId, mcpServerConfigId, status, error } = payload;

    logger.info(
      `[MCPEventHandler] Connection status update for ${mcpServerConfigId}: ${status}`,
    );

    try {
      const existingConnection =
        await this.databaseService.getUserMCPConnection(
          userId,
          channelId,
          mcpServerConfigId,
        );

      if (!existingConnection) {
        logger.warn(
          `[MCPEventHandler] No existing connection found for ${mcpServerConfigId}`,
        );
        return;
      }

      // Skip updating connections that have been explicitly deleted by user
      if (existingConnection.status === 'DISCONNECTED_BY_USER') {
        logger.info(
          `[MCPEventHandler] Skipping status update for ${mcpServerConfigId} - connection was deleted by user`,
        );
        return;
      }

      const validStatus = [
        'connected',
        'disconnected',
        'error',
        'auth-required',
      ].includes(status)
        ? (status as 'connected' | 'disconnected' | 'error' | 'auth-required')
        : 'error';

      // IMPORTANT: When status is 'connected', skip the database write!
      // handleServerCapabilities will run immediately after this and will update
      // the database with the proper server_name (title). If we write here, we'll
      // overwrite with stale data and cause a race condition.
      if (validStatus === 'connected') {
        logger.info(
          `[MCPEventHandler] Skipping database write for 'connected' status - handleServerCapabilities will handle it`,
        );
        return;
      }

      // For all other statuses (disconnected, error, auth-required), update the database
      const connectionData: SavedMCPConnection = {
        ...existingConnection,
        status: validStatus,
        error_message: error?.message || null,
        last_used: new Date(),
      };

      await this.databaseService.saveUserMCPConnection(connectionData);

      logger.info(
        `[MCPEventHandler] Updated connection status for ${mcpServerConfigId} to ${status}`,
      );
    } catch (error) {
      logger.error(
        `[MCPEventHandler] Error updating connection status for ${mcpServerConfigId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Handle server capabilities event
   * Updates the connection with server info
   */
  async handleServerCapabilities(
    payload: MCPServerCapabilitiesEvent,
  ): Promise<void> {
    const { userId, mcpServerConfigId, capabilities, name, version } = payload;

    logger.info(
      `[MCPEventHandler] Server capabilities for ${mcpServerConfigId}: ${name} v${version}`,
    );

    try {
      const existingConnection =
        await this.databaseService.getUserMCPConnection(
          userId,
          mcpServerConfigId,
        );

      // Use the name from the payload (which comes from connections.ts with proper title priority)
      // Only fall back to existing name if payload doesn't have one
      const finalServerName =
        name || existingConnection?.server_name || 'Unknown MCP Server';

      logger.info(
        `[MCPEventHandler] handleServerCapabilities - payload.name="${name}", existing="${existingConnection?.server_name}", using="${finalServerName}"`,
      );

      const connectionData: SavedMCPConnection = {
        user_id: userId,
        server_id: mcpServerConfigId,
        server_name: finalServerName,
        server_url: existingConnection?.server_url || '',
        status: existingConnection?.status || 'connected',
        tools: existingConnection?.tools || '[]',
        error_message: null,
        connected_at: existingConnection?.connected_at || new Date(),
        last_used: new Date(),
      };

      await this.databaseService.saveUserMCPConnection(connectionData);

      logger.info(
        `[MCPEventHandler] Updated capabilities for ${mcpServerConfigId} with server_name="${finalServerName}"`,
      );
    } catch (error) {
      logger.error(
        `[MCPEventHandler] Error updating capabilities for ${mcpServerConfigId}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Handle tool result event
   * For Discord bot, we pass this to MCPService to resolve pending invocations
   */
  async handleToolResult(payload: MCPToolResultEvent): Promise<void> {
    const { userId, invocationId, toolName, status, result, error } = payload;

    logger.info(
      `[MCPEventHandler] Tool result for ${toolName} (${invocationId}): ${status} (hasResult: ${!!result}, hasError: ${!!error})`,
    );

    // Notify any listeners (like Discord notification service) if needed
    if (this.discordNotification && status === 'success') {
      // Could send success notification to Discord if needed
      logger.debug(
        `[MCPEventHandler] Tool ${toolName} completed successfully for user ${userId}`,
      );
    } else if (this.discordNotification && status === 'error') {
      // Could send error notification to Discord if needed
      logger.debug(
        `[MCPEventHandler] Tool ${toolName} failed for user ${userId}: ${error?.message}`,
      );
    }
  }

  /**
   * Handle tool invocation progress event
   * For Discord bot, we'll just log progress
   */
  async handleToolInvocationProgress(
    payload: MCPToolInvocationProgressEvent,
  ): Promise<void> {
    const { invocationId, progress } = payload;

    logger.debug(
      `[MCPEventHandler] Tool invocation progress for ${invocationId}`,
    );

    // For Discord bot, we don't store progress separately
    // Could be used to update Discord messages with progress if needed
  }

  /**
   * Handle notification received event
   * For Discord bot, we might log these or send them to relevant Discord channels
   */
  async handleNotificationReceived(
    payload: MCPNotificationEvent,
  ): Promise<void> {
    const { mcpServerConfigId, notification } = payload;

    logger.info(
      `[MCPEventHandler] Notification from ${mcpServerConfigId}: ${notification.method}`,
    );

    // For Discord bot, we could:
    // 1. Log the notification (done above)
    // 2. Send to a Discord channel if configured
    // 3. Trigger resource re-fetching if it's a resource update notification

    if (
      notification.method === 'resource_updated' ||
      notification.method === 'resource_list_changed'
    ) {
      logger.info(
        `[MCPEventHandler] Resource change notification from ${mcpServerConfigId}, may need to re-fetch resources`,
      );
      // Could trigger a resource refetch here if needed
    }
  }

  /**
   * Handle sampling request received event
   * For Discord bot, we'll just log this
   */
  async handleSamplingRequestReceived(
    payload: MCPSamplingRequestReceivedEvent,
  ): Promise<void> {
    const { mcpServerConfigId, sdkContext } = payload;

    logger.info(
      `[MCPEventHandler] Sampling request from ${mcpServerConfigId}: ${sdkContext.requestId}`,
    );

    // For Discord bot, we don't handle sampling requests
    // Could be extended if needed
  }

  /**
   * Handle elicitation request received event
   * For Discord bot, we'll just log this
   */
  async handleElicitationRequestReceived(
    payload: MCPElicitationRequestReceivedEvent,
  ): Promise<void> {
    const { mcpServerConfigId, sdkContext } = payload;

    logger.info(
      `[MCPEventHandler] Elicitation request from ${mcpServerConfigId}: ${sdkContext.requestId}`,
    );

    // For Discord bot, we don't handle elicitation requests
    // Could be extended if needed
  }
}
