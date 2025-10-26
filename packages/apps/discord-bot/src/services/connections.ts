// src/mcp-connection-manager/services/connection.pool.service.ts
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import {
  Notification as SDKNotificationBase,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ToolListChangedNotificationSchema,
  ServerCapabilities,
  Progress,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  Implementation,
} from '@modelcontextprotocol/sdk/types.js'; // Verify this path for Zod schemas from SDK
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ConnectionManagerOAuthProvider } from '../mcp/oauth-provider.js';
import { SupabaseService } from './database.js';
import { MCPEventService } from './event-emitter.service.js';
import {
  ConnectionRequestPayload,
  TokensObtainedPayload,
  FetchResourceRequestPayload,
  InvokeToolRequestPayload,
  DisconnectRequestPayload,
  SamplingDecisionSubmittedPayload,
  ElicitationDataSubmittedPayload,
  MCPSamplingCompletionResult,
  MCPElicitationResult,
} from '../dtos/pubsub.events.dto.js';
import { MCPResourceDataFetchedEvent } from '../dtos/mcp.shared.types.dto.js';
import { pendingRequestManager } from './pending-request-manager.js';
import { auth } from '../mcp/oauth.js';
import logger from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';

const TIMEOUT_SECONDS = 60_000; // Fixed timeout for elicitation requests

// Generate connection pool key using userId (Discord) and mcpServerConfigId
function generateConnectionPoolKey(
  userId: string,
  mcpServerConfigId: string,
): string {
  return `${userId}::${mcpServerConfigId}`;
}

interface ActiveConnection {
  client: McpClient | null; // Client instance, null if not yet created
  authProvider: ConnectionManagerOAuthProvider;
  mcpServerUrl: string;
  userId: string;
  channelId: string;
  mcpServerConfigId: string;
  isActiveAttempted: boolean;
  currentTransportType?: 'streamableHttp' | 'sse';
  capabilities?: ServerCapabilities;
}

export class ConnectionPoolService {
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private eventService: MCPEventService;
  private databaseService: SupabaseService;

  // Maps to store debounce timers, keyed by poolKey.
  private resourceListDebounceTimers = new Map<string, NodeJS.Timeout>();
  private toolListDebounceTimers = new Map<string, NodeJS.Timeout>();

  // The delay in milliseconds to wait before fetching after a notification.
  private readonly DEBOUNCE_DELAY_MS = 300;

  constructor(databaseService: SupabaseService, eventService: MCPEventService) {
    logger.info('Initializing ConnectionPoolService...');
    this.databaseService = databaseService;
    this.eventService = eventService;
    logger.info(
      'ConnectionPoolService initialized. Active connections map created.',
    );
  }

  private getConnectionOrFail(poolKey: string): ActiveConnection {
    const conn = this.activeConnections.get(poolKey);

    // Debug logging for connection state
    logger.info(
      `[ConnPool-${poolKey}] Debug - Connection exists: ${!!conn}, isActiveAttempted: ${conn?.isActiveAttempted}, total active connections: ${this.activeConnections.size}`,
    );
    if (this.activeConnections.size > 0) {
      logger.info(
        `[ConnPool-${poolKey}] Active connection keys: ${Array.from(this.activeConnections.keys()).join(', ')}`,
      );
    }

    if (!conn || !conn.isActiveAttempted) {
      logger.warn(
        `[ConnPool-${poolKey}] No active or successfully attempted connection found.`,
      );
      throw new NotFoundError(
        `Connection to MCP server not found or inactive. Trigger a new connection request [here](/mcp).`,
      );
    }
    return conn;
  }

  private async markConnectionAsInactive(
    poolKey: string,
    reason: string,
    deleteFromPool: boolean = true,
    skipFirestoreStatusUpdate: boolean = false,
  ): Promise<void> {
    logger.warn(
      `[ConnPool-${poolKey}] Marking connection as inactive. Reason: ${reason}`,
    );
    const connection = this.activeConnections.get(poolKey);

    if (connection) {
      connection.isActiveAttempted = false;

      if (!skipFirestoreStatusUpdate) {
        try {
          await this.databaseService.updateConnectionStatus(
            connection.userId,
            connection.channelId,
            connection.mcpServerConfigId,
            connection.mcpServerUrl,
            'DISCONNECTED_UNEXPECTEDLY',
            {
              lastFailureError: reason,
              lastAttemptedAt: new Date().toISOString(),
            },
          );
        } catch (fsError: any) {
          logger.error(
            `[ConnPool-${poolKey}] Failed to update Firestore status to DISCONNECTED_UNEXPECTEDLY during markConnectionAsInactive:`,
            fsError,
          );
        }
      }

      if (deleteFromPool) {
        this.activeConnections.delete(poolKey);
        logger.info(`[ConnPool-${poolKey}] Connection removed from pool.`);
        // Publish status update after deleting from pool
        await this.eventService.publishConnectionStatusUpdate({
          generatedAt: new Date().toISOString(),
          userId: connection.userId,
          channelId: connection.channelId,
          mcpServerConfigId: connection.mcpServerConfigId,
          mcpServerUrl: connection.mcpServerUrl,
          status: 'disconnected',
          lastUpdated: new Date(),
          error: {
            message: reason,
            code: 'inactive',
            details:
              'Connection marked as inactive due to error or disconnect.',
          },
        });
      }
    }
  }

  private createClientNotificationHandler(
    poolKey: string,
  ): (notification: any) => Promise<void> {
    return async (notification: any) => {
      const connection = this.activeConnections.get(poolKey);
      if (!connection || !connection.isActiveAttempted) {
        logger.warn(
          `[ConnPool-${poolKey}] Received notification for inactive or non-existent connection. Ignoring.`,
        );
        return;
      }

      const { client, userId, mcpServerConfigId, mcpServerUrl, channelId } = connection;

      if (!client) {
        throw new Error(`[ConnPool-${poolKey}] Client is not initialized.`);
      }

      logger.info(
        `[ConnPool-${poolKey}] Client received notification: method='${
          notification.method
        }', params='${JSON.stringify(notification.params)}'`,
      );

      try {
        switch (notification.method) {
          case 'notifications/resources/list_changed':
            logger.info(
              `[ConnPool-${poolKey}] Resource list changed notification received. Debouncing fetch for ${this.DEBOUNCE_DELAY_MS}ms.`,
            );

            // Clear any existing timer for this resource list.
            if (this.resourceListDebounceTimers.has(poolKey)) {
              clearTimeout(this.resourceListDebounceTimers.get(poolKey)!);
            }

            // Set a new timer.
            const resourceTimerId = setTimeout(async () => {
              try {
                logger.info(
                  `[ConnPool-${poolKey}] Debounce timer finished. Fetching updated resource list...`,
                );
                const resourcesResponse = await client.listResources();
                await this.eventService.publishResourcesFetched({
                  generatedAt: new Date().toISOString(),
                  userId,
                  channelId,
                  mcpServerConfigId,
                  mcpServerUrl,
                  resources: resourcesResponse.resources,
                });
                logger.info(
                  `[ConnPool-${poolKey}] Successfully fetched and published debounced resource list.`,
                );
              } catch (error: any) {
                logger.error(
                  `[ConnPool-${poolKey}] Error during debounced resource list fetch: ${error.message}`,
                  error,
                );
              } finally {
                this.resourceListDebounceTimers.delete(poolKey);
              }
            }, this.DEBOUNCE_DELAY_MS);

            this.resourceListDebounceTimers.set(poolKey, resourceTimerId);
            break;

          case 'notifications/tools/list_changed':
            logger.info(
              `[ConnPool-${poolKey}] Tool list changed notification received. Debouncing fetch for ${this.DEBOUNCE_DELAY_MS}ms.`,
            );

            // Clear any existing timer for this tool list.
            if (this.toolListDebounceTimers.has(poolKey)) {
              clearTimeout(this.toolListDebounceTimers.get(poolKey)!);
            }

            // Set a new timer.
            const toolTimerId = setTimeout(async () => {
              try {
                logger.info(
                  `[ConnPool-${poolKey}] Debounce timer finished. Fetching updated tool list...`,
                );
                const toolsResponse = await client.listTools();
                await this.eventService.publishToolsFetched({
                  generatedAt: new Date().toISOString(),
                  userId,
                  channelId,
                  mcpServerConfigId,
                  mcpServerUrl,
                  tools: toolsResponse.tools,
                });
                logger.info(
                  `[ConnPool-${poolKey}] Successfully fetched and published debounced tool list.`,
                );
              } catch (error: any) {
                logger.error(
                  `[ConnPool-${poolKey}] Error during debounced tool list fetch: ${error.message}`,
                  error,
                );
              } finally {
                this.toolListDebounceTimers.delete(poolKey);
              }
            }, this.DEBOUNCE_DELAY_MS);

            this.toolListDebounceTimers.set(poolKey, toolTimerId);
            break;

          case 'notifications/resources/updated':
            const resourceUri = (notification.params as any)?.uri;

            if (!resourceUri || typeof resourceUri !== 'string') {
              logger.warn(
                `[ConnPool-${poolKey}] Resource updated notification received without a valid URI in params. Params: ${JSON.stringify(
                  notification.params,
                )}`,
              );
            }
            logger.info(
              `[ConnPool-${poolKey}] Resource updated notification for URI: ${
                resourceUri || 'undefined'
              }. Relaying notification.`,
            );

            const resourceUpdatedSdkNotification: SDKNotificationBase = {
              method: notification.method,
              params: {
                timestamp: new Date().toISOString(),
                content: notification.params,
                ...(resourceUri && { resourceUri }),
              },
            };
            await this.eventService.publishNotificationReceived({
              generatedAt: new Date().toISOString(),
              userId,
              mcpServerConfigId,
              mcpServerUrl,
              notification: resourceUpdatedSdkNotification,
            });
            break;

          default:
            logger.warn(
              `[ConnPool-${poolKey}] Received notification with unhandled or generic method: ${notification.method}. Relaying as generic notification.`,
            );
            const genericSdkNotification: SDKNotificationBase = {
              method: notification.method,
              params: {
                timestamp: new Date().toISOString(),
                content: notification.params,
              },
            };
            await this.eventService.publishNotificationReceived({
              generatedAt: new Date().toISOString(),
              userId,
              mcpServerConfigId,
              mcpServerUrl,
              notification: genericSdkNotification,
            });
            break;
        }
      } catch (error: any) {
        logger.error(
          `[ConnPool-${poolKey}] Error processing notification (method: ${notification.method}): ${error.message}`,
          error,
        );
      }
    };
  }

  /**
   * Handles an incoming request to establish or verify a connection to an MCP server.
   * This function manages the entire connection lifecycle, including authentication,
   * transport negotiation, and error handling.
   *
   * @param payload The connection request details.
   */
  async handleConnectionRequest(
    payload: ConnectionRequestPayload,
  ): Promise<void> {
    // 1. Initial validation
    if (
      !payload.userId ||
      !payload.mcpServerConfigId ||
      !payload.mcpServerUrl
    ) {
      const error = new Error(
        'Connection request missing required fields: userId, mcpServerConfigId, or mcpServerUrl.',
      );
      logger.error(error.message, error);
      // Cannot update status without IDs, so we log and exit.
      return;
    }

    const poolKey = generateConnectionPoolKey(
      payload.userId,
      payload.mcpServerConfigId,
    );

    logger.info(
      `[ConnPool-${poolKey}] Handling connection request for ${
        payload.mcpServerUrl
      }, userId: ${payload.userId || 'N/A'}`,
    );

    // Set initial status. Any subsequent error will UPDATE this status.
    await this.databaseService.storeConnectionDetails(
      payload.userId,
      payload.channelId,
      payload.mcpServerConfigId,
      'CONNECTION_REQUESTED',
      { lastAttemptedAt: new Date().toISOString() },
      payload.mcpServerUrl, // Pass the URL so it can create the record if needed
    );

    let primaryError: Error | undefined;

    // 2. Main Logic Block: The entire connection lifecycle is wrapped.
    try {
      // --- Existing Connection Check ---
      if (this.activeConnections.has(poolKey)) {
        const existingConn = this.activeConnections.get(poolKey)!;
        if (existingConn.isActiveAttempted) {
          logger.info(
            `[ConnPool-${poolKey}] Connection already active. Checking client status.`,
          );
          if (existingConn.client) {
            // Connection exists and has a client, update user if needed and return
            if (payload.userId && existingConn.userId !== payload.userId) {
              logger.info(
                `[ConnPool-${poolKey}] Updating userId for existing connection from ${existingConn.userId} to ${payload.userId}`,
              );
              existingConn.userId = payload.userId;
              // Optionally update in database
            }
            return; // Success, exit early.
          } else {
            logger.warn(
              `[ConnPool-${poolKey}] Existing connection has no client. Recreating.`,
            );
            // Clean up the old connection before proceeding.
            this.activeConnections.delete(poolKey);
          }
        } else {
          logger.info(
            `[ConnPool-${poolKey}] Existing inactive connection entry found. Recreating.`,
          );
          this.activeConnections.delete(poolKey);
        }
      }

      // --- New Connection Setup ---
      await this.eventService.publishConnectionStatusUpdate({
        generatedAt: new Date().toISOString(),
        userId: payload.userId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: payload.mcpServerUrl,
        status: 'reconnecting', // Or 'connecting'
        lastUpdated: new Date(),
      });

      const serverUrlObject = new URL(payload.mcpServerUrl);
      const authProvider = new ConnectionManagerOAuthProvider(
        payload.mcpServerConfigId,
        payload.userId,
        this.databaseService,
        this.eventService,
        payload.mcpServerUrl,
        payload.channelId, // Pass channelId to the provider
      );

      // Store the authProvider in the pool immediately.
      const connectionAttempt: ActiveConnection = {
        client: null, // Client not created yet
        authProvider,
        mcpServerUrl: payload.mcpServerUrl,
        userId: payload.userId,
        channelId: payload.channelId,
        mcpServerConfigId: payload.mcpServerConfigId,
        isActiveAttempted: false,
      };
      this.activeConnections.set(poolKey, connectionAttempt);

      const authStatus = await auth(authProvider, {
        serverUrl: payload.mcpServerUrl,
      });

      console.log('authStatus', authStatus);

      // Handle non-error exit conditions from auth flow
      if (authStatus === 'REDIRECT') {
        logger.info(
          `[ConnPool-${poolKey}] AuthProvider initiated OAuth flow. Redirecting user.`,
        );
        await this.databaseService.updateConnectionStatus(
          payload.userId,
          payload.channelId,
          payload.mcpServerConfigId,
          payload.mcpServerUrl,
          'AUTH_PENDING',
        );
        return;
      }

      if (authStatus === 'PENDING_CLIENT_REGISTRATION') {
        logger.info(
          `[ConnPool-${poolKey}] Dynamic client registration failed. Manual action required.`,
        );
        await this.eventService.publishConnectionStatusUpdate({
          generatedAt: new Date().toISOString(),
          userId: payload.userId,
          mcpServerConfigId: payload.mcpServerConfigId,
          mcpServerUrl: payload.mcpServerUrl,
          status: 'pending_client_registration',
          lastUpdated: new Date(),
        });
        await this.databaseService.updateConnectionStatus(
          payload.userId,
          payload.channelId,
          payload.mcpServerConfigId,
          payload.mcpServerUrl,
          'PENDING_CLIENT_REGISTRATION',
        );
        return;
      }

      // --- Client Creation and Connection ---
      const clientConstructorOpts: Implementation = {
        title: 'Prometheus Protocol MCP Client',
        name: 'prometheus-protocol-mcp-client',
        version: '1.0.1',
      };
      const clientOptions = {
        capabilities: { sampling: {}, elicitation: {} },
      };
      const client = new McpClient(clientConstructorOpts, clientOptions);
      connectionAttempt.client = client; // Add client to the connection object

      const commonTransportOptions = { authProvider };
      let connectedTransportType: 'streamableHttp' | 'sse' | undefined;

      client.onclose = async () => {
        logger.warn(
          `[ConnPool-${poolKey}] Client connection closed unexpectedly.`,
        );
      };
      client.onerror = async (error: Error) => {
        //  Don't fail connection on connection termination errors. We
        //  handle reconnection attempts in the transport layer.
        // error.message:
        // SSE stream disconnected: TypeError: terminated
        if (
          error.message.includes('terminated') ||
          error.message.includes('disconnected') ||
          error.message.includes('upstream request timeout')
        ) {
          logger.info(
            `[ConnPool-${poolKey}] Connection terminated or disconnected, but not failing connection attempt.`,
          );
          return; // Don't treat this as a failure.
        }

        console.log('error', error);
        logger.error(
          `[ConnPool-${poolKey}] Client connection error: ${error.message}`,
          error, // Log the full object for better context
        );
        // This is the key change: treat any client-reported error as a
        // terminal failure for this connection attempt. This will update
        // Firestore and publish the correct 'FAILED' status.
        await this._handleConnectionFailure(payload, poolKey, error);
      };

      // --- NEW LOGIC: Check URL for SSE convention ---
      if (payload.mcpServerUrl.endsWith('/sse')) {
        logger.info(
          `[ConnPool-${poolKey}] URL indicates SSE transport. Connecting directly with SSE.`,
        );
        try {
          const sseTransport = new SSEClientTransport(
            serverUrlObject,
            commonTransportOptions,
          );
          await client.connect(sseTransport);
          connectedTransportType = 'sse';
        } catch (error: any) {
          // If the direct SSE connection fails, we treat it as a terminal failure.
          // The main catch block of the calling function will handle this.
          logger.error(
            `[ConnPool-${poolKey}] Direct SSE connection failed: ${error.message}`,
          );
          throw error; // Re-throw to be caught by the outer logic
        }
      } else {
        // --- ORIGINAL LOGIC: Try Streamable HTTP with SSE Fallback ---
        logger.info(
          `[ConnPool-${poolKey}] Attempting Streamable HTTP transport with SSE fallback.`,
        );
        try {
          const transport = new StreamableHTTPClientTransport(serverUrlObject, {
            ...commonTransportOptions,
            reconnectionOptions: {
              initialReconnectionDelay: 1000,
              maxReconnectionDelay: 30000,
              reconnectionDelayGrowFactor: 1.5,
              maxRetries: 5,
            },
          });
          transport.onerror = (error: Error) => {
            logger.error(
              `[ConnPool-${poolKey}] Streamable HTTP transport error: ${error.message}`,
            );
          };
          transport.onclose = () => {
            logger.info(
              `[ConnPool-${poolKey}] Streamable HTTP transport closed.`,
            );
          };
          await client.connect(transport);
          connectedTransportType = 'streamableHttp';
        } catch (streamableError: any) {
          primaryError = streamableError;
          logger.warn(
            `[ConnPool-${poolKey}] Streamable HTTP failed: ${streamableError.message}. Fallback to SSE.`,
          );
          const sseTransport = new SSEClientTransport(
            serverUrlObject,
            commonTransportOptions,
          );
          // If this fails, the main catch block of the calling function will handle it.
          await client.connect(sseTransport);
          connectedTransportType = 'sse';

          primaryError = undefined;
        }
      }

      logger.info(
        `[ConnPool-${poolKey}] Connected via ${connectedTransportType}.`,
      );

      // --- Step 1: Core Connection & Capability Check ---
      // This is the essential part to consider the connection "active".
      const capabilities = client.getServerCapabilities();
      const serverInfo = client.getServerVersion();

      if (!capabilities || Object.keys(capabilities).length === 0) {
        // If a server has no capabilities, it's not useful. Treat as a failure.
        throw new Error('Server reported no capabilities. Cannot proceed.');
      }

      connectionAttempt.capabilities = capabilities;
      logger.info(
        `[ConnPool-${poolKey}] Server capabilities received: ${JSON.stringify(
          capabilities,
        )}`,
      );

      // --- Extract and update server display name from MCP server metadata ---
      if (serverInfo && typeof serverInfo === 'object') {
        try {
          // Get current connection data from database to preserve existing server_name as fallback
          const existingConnection =
            await this.databaseService.getUserMCPConnection(
              payload.userId,
              payload.channelId,
              payload.mcpServerConfigId,
            );

          // Extract display name from MCP server metadata
          // Priority: title > name > existing server_name > mcpServerConfigId
          const serverTitle = (serverInfo as any).title;
          const serverName = (serverInfo as any).name;
          const currentServerName = existingConnection?.server_name;

          // Helper to check if a name looks auto-generated (UUID, hostname, or long hash)
          const looksAutoGenerated = (name: string | undefined): boolean => {
            if (!name) return true;
            // Check if it's a UUID
            if (
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                name,
              )
            )
              return true;
            // Check if it's a hostname/URL-like (contains dots and looks like domain)
            if (/^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(name)) return true;
            // Check if it's a long hash-like string (40+ chars of hex)
            if (/^[a-z0-9]{40,}$/i.test(name)) return true;
            return false;
          };

          // Determine the display name
          let displayName: string;

          if (serverTitle) {
            // If server provides a title, always use it
            displayName = serverTitle;
          } else if (
            currentServerName &&
            !looksAutoGenerated(currentServerName)
          ) {
            // If there's an existing human-readable name, keep it
            displayName = currentServerName;
          } else {
            // Otherwise use the server's name or fallback chain
            displayName =
              serverName || currentServerName || payload.mcpServerConfigId;
          }

          logger.info(
            `[ConnPool-${poolKey}] Server metadata: name="${serverName}", title="${serverTitle}", current="${currentServerName}", using="${displayName}"`,
          );

          // Update the database record with the proper display name if it's different
          if (displayName !== currentServerName) {
            await this.databaseService.updateUserMCPConnection(
              payload.userId,
              payload.channelId,
              payload.mcpServerConfigId,
              { server_name: displayName },
            );
            logger.info(
              `[ConnPool-${poolKey}] Updated server display name from "${currentServerName}" to "${displayName}"`,
            );
          }
        } catch (error) {
          logger.warn(
            `[ConnPool-${poolKey}] Failed to extract server metadata for display name: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      // --- FIX FOR RACE CONDITION ---
      // Set the internal state flag NOW. Any incoming requests from this point
      // will see the connection as fully active.
      connectionAttempt.isActiveAttempted = true;
      connectionAttempt.currentTransportType = connectedTransportType;
      logger.info(`[ConnPool-${poolKey}] Internal state marked as active.`);

      // --- Step 2: IMMEDIATELY Update State to ACTIVE ---
      // This is the critical fix for the race condition.
      // We now consider the connection active and ready for use.
      logger.info(
        `[ConnPool-${poolKey}] Marking connection as ACTIVE in database.`,
      );
      await this.databaseService.updateConnectionStatus(
        payload.userId,
        payload.channelId,
        payload.mcpServerConfigId,
        payload.mcpServerUrl,
        'ACTIVE',
        {
          lastSucceededAt: new Date().toISOString(),
          failureCount: 0,
          transportType: connectedTransportType,
          // capabilities are now available to be saved
          capabilities: connectionAttempt.capabilities,
        },
      );

      // Publish the status update so other services know it's ready.
      await this.eventService.publishConnectionStatusUpdate({
        generatedAt: new Date().toISOString(),
        userId: payload.userId,
        channelId: payload.channelId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: payload.mcpServerUrl,
        status: 'connected',
        lastUpdated: new Date(),
      });

      // --- Step 3: Perform Secondary Setup (Resources, Tools, Handlers) ---
      // We wrap this in its own try/catch. A failure here should be logged
      // but should NOT tear down the now-active connection.
      try {
        logger.info(
          `[ConnPool-${poolKey}] Performing post-connection setup...`,
        );

        // Publish capabilities (can be done here, it's not critical for connection status)
        // Use title from serverInfo if available, fallback to name
        const serverTitle = serverInfo && (serverInfo as any).title;
        const serverName = serverInfo && (serverInfo as any).name;
        const displayName = serverTitle || serverName || 'Unknown MCP Server';

        await this.eventService.publishServerCapabilities({
          generatedAt: new Date().toISOString(),
          userId: payload.userId,
          channelId: payload.channelId,
          mcpServerConfigId: payload.mcpServerConfigId,
          mcpServerUrl: payload.mcpServerUrl,
          name: displayName,
          version: serverInfo?.version || 'Unknown Version',
          capabilities,
        });

        // Set up all your request and notification handlers
        const notificationHandlerCb =
          this.createClientNotificationHandler(poolKey);

        client.setRequestHandler(
          ElicitRequestSchema,
          async (request, context) => {
            const { sessionId, requestId } = context;
            const compositeKey = `${sessionId}:${requestId}`;

            console.log('request: ', request);

            logger.info(
              `[ConnPool-${poolKey}] Received 'elicitation/create'. Key: ${compositeKey}. Publishing to main app.`,
            );

            // 1. Publish the request to the main app for the user to see.
            //    We pass the context
            await this.eventService.publishElicitationRequestReceived({
              generatedAt: new Date().toISOString(),
              userId: payload.userId,
              mcpServerConfigId: payload.mcpServerConfigId,
              mcpServerUrl: payload.mcpServerUrl,
              sdkContext: {
                sessionId: sessionId || 'unknown-session',
                requestId,
              },
              timeoutSeconds: TIMEOUT_SECONDS, // Elicitation requests have a fixed timeout
              timestamp: new Date().toISOString(),
              elicitationRequest: request,
            });
            // 2. Return a promise that waits for the result from the Pub/Sub listener.
            try {
              const result =
                await pendingRequestManager.waitForResponse<MCPElicitationResult>(
                  compositeKey,
                );

              // The SDK expects the result to be the content of the response.
              return {
                ...result,
              };
            } catch (error) {
              logger.error(
                `[ConnPool-${poolKey}] Error waiting for elicitation response for ${compositeKey}:`,
                error as Error,
              );
              // Re-throw the error so the SDK can send an error response to the server.
              console.log('error', error);
              pendingRequestManager.rejectRequest(compositeKey, error as Error);
              throw error;
            }
          },
        );

        client.setRequestHandler(
          CreateMessageRequestSchema,
          async (request, context) => {
            const { sessionId, requestId } = context;
            const compositeKey = `${sessionId}:${requestId}`;

            logger.info(
              `[ConnPool-${poolKey}] Received 'sampling/createMessage'. Key: ${compositeKey}. Publishing to main app.`,
            );

            // 1. Publish the request to the main app for the user to see.
            //    We pass the context needed to resolve this request later.
            await this.eventService.publishSamplingRequestReceived({
              generatedAt: new Date().toISOString(),
              userId: payload.userId,
              mcpServerConfigId: payload.mcpServerConfigId,
              mcpServerUrl: payload.mcpServerUrl,
              sdkContext: {
                sessionId: sessionId || 'unknown-session',
                requestId,
              },
              timeoutSeconds: TIMEOUT_SECONDS, // Elicitation requests have a fixed timeout
              timestamp: new Date().toISOString(),
              samplingRequest: request.params,
            });

            // 2. Return a promise that waits for the result from the Pub/Sub listener.
            try {
              const result =
                await pendingRequestManager.waitForResponse<MCPSamplingCompletionResult>(
                  compositeKey,
                );

              // The SDK expects the result to be the content of the response.
              return {
                ...result,
              };
            } catch (error) {
              logger.error(
                `[ConnPool-${poolKey}] Error waiting for sampling response for ${compositeKey}:`,
                error as Error,
              );
              // Re-throw the error so the SDK can send an error response to the server.
              console.log('error', error);
              pendingRequestManager.rejectRequest(compositeKey, error);
              throw error;
            }
          },
        );

        logger.info(
          `[ConnPool-${poolKey}] Handler for 'sampling/createMessage' set.`,
        );

        const resourceCaps = capabilities.resources;
        if (resourceCaps) {
          const resourcesResponse = await client.listResources();
          console.log('resourcesResponse', resourcesResponse);
          await this.eventService.publishResourcesFetched({
            generatedAt: new Date().toISOString(),
            userId: payload.userId,
            channelId: payload.channelId,
            mcpServerConfigId: payload.mcpServerConfigId,
            mcpServerUrl: payload.mcpServerUrl,
            resources: resourcesResponse.resources,
          });

          if (resourceCaps.listChanged) {
            client.setNotificationHandler(
              ResourceListChangedNotificationSchema,
              notificationHandlerCb as any,
            );
            logger.info(
              `[ConnPool-${poolKey}] Handler for 'resources/list_changed' set.`,
            );
          }

          if (resourceCaps.subscribe) {
            client.setNotificationHandler(
              ResourceUpdatedNotificationSchema,
              notificationHandlerCb as any,
            );
            logger.info(
              `[ConnPool-${poolKey}] Handler for 'resources/updated' set.`,
            );
          }
          // listChanged handler already set above if capable
        }

        const toolCaps = capabilities.tools;
        if (toolCaps) {
          const toolsResponse = await client.listTools();
          console.log('toolsResponse', toolsResponse);
          await this.eventService.publishToolsFetched({
            generatedAt: new Date().toISOString(),
            userId: payload.userId,
            channelId: payload.channelId,
            mcpServerConfigId: payload.mcpServerConfigId,
            mcpServerUrl: payload.mcpServerUrl,
            tools: toolsResponse.tools,
          });
          if (toolCaps?.listChanged) {
            client.setNotificationHandler(
              ToolListChangedNotificationSchema,
              notificationHandlerCb as any,
            );
            logger.info(
              `[ConnPool-${poolKey}] Handler for 'tools/list_changed' set.`,
            );
          }
        }

        logger.info(`[ConnPool-${poolKey}] Post-connection setup complete.`);
      } catch (postConnectionError: any) {
        // Log this as a non-fatal error for the connection itself.
        // The connection is ACTIVE, but setup is incomplete.
        logger.error(
          `[ConnPool-${poolKey}] A non-fatal error occurred during post-connection setup: ${postConnectionError.message}`,
          postConnectionError,
        );
        // You might want to publish an event here indicating a degraded connection.
      }

      logger.info(
        `[ConnPool-${poolKey}] Connection established and configured.`,
      );
    } catch (error: any) {
      const errorToReport = primaryError || error;
      // 3. Centralized Catch Block: All errors from the `try` block land here.
      logger.error(
        `[ConnPool-${poolKey}] A critical error occurred during connection handling: ${errorToReport.message}`,
        errorToReport,
      );
      await this._handleConnectionFailure(payload, poolKey, error);
    }
  }

  /**
   * Centralized handler for processing connection failures. It updates Firestore,
   * publishes a status update, and cleans up the connection pool.
   *
   * @param payload The original connection request payload.
   * @param poolKey The key for the connection in the active connections map.
   * @param error The error that caused the failure.
   */
  private async _handleConnectionFailure(
    payload: {
      userId: string;
      channelId: string;
      mcpServerConfigId: string;
      mcpServerUrl: string;
    },
    poolKey: string,
    error: any,
  ): Promise<void> {
    const { userId, channelId, mcpServerConfigId, mcpServerUrl } = payload;

    const isAuthError =
      error.message.toLowerCase().includes('auth') ||
      error.message.toLowerCase().includes('token') ||
      error.status === 401 ||
      error.response?.status === 401;

    const conn = this.activeConnections.get(poolKey);
    const tokens = await conn?.authProvider.tokens().catch(() => undefined);

    // If tokens are missing and it's an auth-related error, it might be a pending user action.
    // In this case, we update the status but keep the authProvider in the pool for the callback.
    if (isAuthError && !tokens) {
      logger.warn(
        `[ConnPool-${poolKey}] Connection failed with a likely authorization issue. Setting status to AUTH_PENDING.`,
      );

      // Get existing connection to preserve server_name
      const existingConnection =
        await this.databaseService.getUserMCPConnection(
          userId,
          channelId,
          mcpServerConfigId,
        );

      await this.databaseService.updateConnectionStatus(
        userId,
        channelId,
        mcpServerConfigId,
        mcpServerUrl,
        'AUTH_PENDING',
        {
          lastFailureError: error.message,
          lastAttemptedAt: new Date().toISOString(),
        },
      );

      // Publish status update event so UI/handlers can react
      await this.eventService.publishConnectionStatusUpdate({
        generatedAt: new Date().toISOString(),
        userId,
        mcpServerConfigId,
        mcpServerUrl,
        status: 'auth-required',
        lastUpdated: new Date(),
        serverName: existingConnection?.server_name || mcpServerConfigId,
        error: {
          message: 'Authentication expired or was revoked. Please reconnect.',
          code: 'AUTH_EXPIRED',
          details: error.message,
        },
      });

      // We DO NOT remove from activeConnections here, as the authProvider state is needed.
      return;
    }

    // For all other critical, non-recoverable errors, we clean up completely.
    logger.warn(
      `[ConnPool-${poolKey}] Critical connection failure. Removing from pool.`,
    );
    if (conn) {
      try {
        // client might be null if error happened before it was created
        if (conn.client) {
          await conn.client.close();
        }
      } catch (e) {
        /* ignore close error on cleanup */
      }
      this.activeConnections.delete(poolKey);
    }

    // Update database and publish the failure status.
    await this.databaseService.updateConnectionStatus(
      userId,
      channelId,
      mcpServerConfigId,
      mcpServerUrl,
      'FAILED_CONNECTION',
      {
        lastFailureError: error.message,
        failureCount: 1, // increment by 1 instead of using FieldValue
        lastAttemptedAt: new Date().toISOString(),
      },
    );

    await this.eventService.publishConnectionStatusUpdate({
      generatedAt: new Date().toISOString(),
      userId,
      mcpServerConfigId,
      mcpServerUrl,
      status: 'disconnected',
      lastUpdated: new Date(),
      error: {
        message: error.message,
        code: String(
          error.code ||
            error.status ||
            error.response?.status ||
            'UNKNOWN_ERROR',
        ),
        details: error.stack, // Stack provides more context for debugging
      },
    });
  }

  /**
   * Handles the final user decision for a sampling request.
   * This method is called by the PubSub listener when a decision arrives.
   * It finds the corresponding pending promise and resolves or rejects it.
   */
  public async handleSamplingDecisionSubmitted(
    payload: SamplingDecisionSubmittedPayload,
  ): Promise<void> {
    const { sdkContext, decision } = payload;

    console.log('payload: ', payload);

    // 1. Reconstruct the composite key from the payload to find the pending request.
    const compositeKey = `${sdkContext.sessionId}:${sdkContext.requestId}`;

    logger.info(
      `[ConnPool] Handling sampling decision '${decision}' for key: ${compositeKey}`,
    );

    // 2. Resolve or reject the promise in the PendingRequestManager.
    if (decision === 'approved' && payload.approvedCompletion) {
      // This will un-block the original `setRequestHandler` and send the
      // successful result back to the MCP server via the SDK.
      pendingRequestManager.resolveRequest(
        compositeKey,
        payload.approvedCompletion,
      );
      logger.info(
        `[ConnPool] Resolved pending sampling request for ${compositeKey}.`,
      );
    } else {
      // This will cause the promise in the `setRequestHandler` to throw an
      // error, which the SDK will catch and send back to the MCP server.
      const error = {
        code: 'SamplingRejected',
        message:
          payload.rejectionReason || 'The user rejected the sampling request.',
      };
      pendingRequestManager.rejectRequest(compositeKey, error);
      logger.warn(
        `[ConnPool] Rejected pending sampling request for ${compositeKey}.`,
      );
    }
  }

  /**
   * Handles the final user decision for a sampling request.
   * This method is called by the PubSub listener when a decision arrives.
   * It finds the corresponding pending promise and resolves or rejects it.
   */
  public async handleElicitationDataSubmitted(
    payload: ElicitationDataSubmittedPayload,
  ): Promise<void> {
    const { sdkContext, elicitationResult } = payload;

    console.log('payload: ', payload);

    // 1. Reconstruct the composite key from the payload to find the pending request.
    const compositeKey = `${sdkContext.sessionId}:${sdkContext.requestId}`;

    logger.info(
      `[ConnPool] Handling elicitation data for key: ${compositeKey}`,
    );

    // 2. Resolve or reject the promise in the PendingRequestManager.
    if (elicitationResult) {
      // This will un-block the original `setRequestHandler` and send the
      // successful result back to the MCP server via the SDK.
      pendingRequestManager.resolveRequest(compositeKey, elicitationResult);
      logger.info(
        `[ConnPool] Resolved pending elicitation request for ${compositeKey}.`,
      );
    } else {
      // This will cause the promise in the `setRequestHandler` to throw an
      // error, which the SDK will catch and send back to the MCP server.
      const error = {
        code: 'ElicitationFailed',
        message: 'The elicitation request failed.',
      };
      pendingRequestManager.rejectRequest(compositeKey, error);
      logger.warn(
        `[ConnPool] Rejected pending elicitation request for ${compositeKey}.`,
      );
    }
  }

  async handleTokensObtained(payload: TokensObtainedPayload): Promise<void> {
    const poolKey = generateConnectionPoolKey(
      payload.userId,
      payload.mcpServerConfigId,
    );
    logger.info(
      `[ConnPool-${poolKey}] Received 'TokensObtained' for ${payload.mcpServerUrl}.`,
    );
    const connection = this.activeConnections.get(poolKey);

    if (!connection || !connection.client) {
      // If no connection object or client (e.g., after a critical error removed it)
      logger.warn(
        `[ConnPool-${poolKey}] No existing client/connection for 'TokensObtained'. Re-initiating full connection request.`,
      );
      // This will create a new ActiveConnection object, including a new AuthProvider
      await this.handleConnectionRequest({
        userId: payload.userId,
        channelId: payload.channelId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: payload.mcpServerUrl,
        generatedAt: payload.generatedAt,
      });
      return;
    }

    if (payload.userId) {
      if (connection.userId !== payload.userId) {
        logger.info(
          `[ConnPool-${poolKey}] Updating userId from TokensObtained: ${connection.userId} -> ${payload.userId}`,
        );
        connection.userId = payload.userId;
        // Note: OAuth provider is recreated with correct userId for each connection request
      }
    }

    logger.info(
      `[ConnPool-${poolKey}] Client exists. Attempting to establish/verify connection with new tokens.`,
    );
    try {
      // Even if isActiveAttempted was true, tokens might have changed, or initial setup might have failed post-connect().
      // A full handleConnectionRequest ensures all setup steps (capabilities, notifications) are re-run.
      logger.info(
        `[ConnPool-${poolKey}] Forcing full connection re-establishment logic for TokensObtained to ensure all handlers and capabilities are set with new auth context.`,
      );
      // We don't delete from `activeConnections` here because `handleConnectionRequest` will reuse/update
      // the existing entry if found, or recreate if necessary.
      // The important part is that the AuthProvider on `connection.authProvider` has been updated by the SDK/OAuth flow.
      await this.handleConnectionRequest({
        userId: payload.userId,
        channelId: payload.channelId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: payload.mcpServerUrl,
        generatedAt: payload.generatedAt,
      });
      // handleConnectionRequest will set isActiveAttempted and Firestore status upon success.
      // If it succeeds, the connection.isActiveAttempted will be true.
      const updatedConnection = this.activeConnections.get(poolKey);
      if (updatedConnection?.isActiveAttempted) {
        logger.info(
          `[ConnPool-${poolKey}] Connection successfully established/verified after 'TokensObtained'.`,
        );
      } else {
        logger.warn(
          `[ConnPool-${poolKey}] Connection NOT active after 'TokensObtained' and re-attempt. Check previous logs from handleConnectionRequest.`,
        );
        // Firestore status would have been set by handleConnectionRequest's error path.
      }
    } catch (error: any) {
      logger.error(
        `[ConnPool-${poolKey}] Error during post-'TokensObtained' connection processing: ${error.message}`,
        error,
      );
      // This catch block might be redundant if handleConnectionRequest handles all its errors,
      // but as a safeguard:
      await this.databaseService.updateConnectionStatus(
        payload.userId,
        payload.channelId,
        payload.mcpServerConfigId,
        payload.mcpServerUrl,
        'FAILED_POST_TOKEN_OBTAINED',
        {
          lastFailureError: error.message,
          lastAttemptedAt: new Date().toISOString(),
        },
      );
      await this.markConnectionAsInactive(
        poolKey,
        `Critical error post TokensObtained: ${error.message}`,
        true,
        true,
      );
    }
  }
  async handleFetchResourceRequest(
    payload: FetchResourceRequestPayload,
  ): Promise<void> {
    const poolKey = generateConnectionPoolKey(
      payload.userId,
      payload.mcpServerConfigId,
    );
    logger.info(
      `[ConnPool-${poolKey}] Processing fetch resource request for: ${payload.resourcePath}`,
    );
    let connectionUrl = payload.mcpServerUrl; // Fallback

    try {
      const connection = this.getConnectionOrFail(poolKey);
      connectionUrl = connection.mcpServerUrl;

      if (!connection.client) {
        throw new Error(`[ConnPool-${poolKey}] Client is not initialized.`);
      }

      const resourceResult = await connection.client.readResource({
        uri: payload.resourcePath, // This is the URI that was requested
      });

      if (!resourceResult?.contents?.length) {
        logger.warn(
          `[ConnPool-${poolKey}] No content returned for requested URI ${payload.resourcePath}.`,
        );
        // Optional: Publish a specific "not found" or "empty content" event for the *requested URI*
        // This depends on whether the MAS needs to know that a specific fetch attempt yielded nothing.
        // For now, we'll just log and do nothing further if contents is empty.
        return;
      }

      // Iterate over each content item returned by the MCP server
      for (const sdkContentItem of resourceResult.contents) {
        logger.info(
          `[ConnPool-${poolKey}] Processing content item with URI: ${sdkContentItem.uri} (Original request: ${payload.resourcePath})`,
        );

        const resourceForEvent: MCPResourceDataFetchedEvent = {
          generatedAt: new Date().toISOString(),
          userId: payload.userId,
          mcpServerConfigId: payload.mcpServerConfigId,
          mcpServerUrl: connectionUrl,
          uri: sdkContentItem.uri, // The URI of this specific content item
          originalRequestUri: payload.resourcePath, // Keep track of the URI that triggered this fetch
          mimeType: sdkContentItem.mimeType,
          channelId: payload.channelId,
        };

        let estimatedPayloadSize = JSON.stringify(resourceForEvent).length;
        const MAX_PUBSUB_PAYLOAD_SIZE = 9 * 1024 * 1024; // 9MB to be safe

        if (sdkContentItem.text && typeof sdkContentItem.text === 'string') {
          // Check for undefined explicitly if text can be empty string
          const textLength = new TextEncoder().encode(
            sdkContentItem.text,
          ).byteLength; // Actual byte length
          if (estimatedPayloadSize + textLength < MAX_PUBSUB_PAYLOAD_SIZE) {
            resourceForEvent.text = sdkContentItem.text; // Ensure text is a string
          } else {
            logger.warn(
              `[ConnPool-${poolKey}] Text content for ${sdkContentItem.uri} is too large (${textLength} bytes) for Pub/Sub. Omitting content.`,
            );
            resourceForEvent.contentOmitted = true;
            resourceForEvent.sizeBytes = textLength;
          }
        } else if (
          sdkContentItem.blob &&
          typeof sdkContentItem.blob === 'string'
        ) {
          const base64BlobLength = sdkContentItem.blob.length;
          const estimatedBinarySizeBytes = Math.ceil(base64BlobLength * 0.75);

          if (
            estimatedPayloadSize + base64BlobLength <
            MAX_PUBSUB_PAYLOAD_SIZE
          ) {
            resourceForEvent.blob = sdkContentItem.blob;
          } else {
            logger.warn(
              `[ConnPool-${poolKey}] Blob content for ${sdkContentItem.uri} (base64 length: ${base64BlobLength}) is too large for Pub/Sub. Omitting content.`,
            );
            resourceForEvent.contentOmitted = true;
            resourceForEvent.sizeBytes = estimatedBinarySizeBytes;
          }
        } else {
          logger.warn(
            `[ConnPool-${poolKey}] Content item ${sdkContentItem.uri} has neither text nor blob.`,
          );
          // This content item is essentially metadata-only if it reaches here.
          // You might still want to publish it if the URI and mimeType are useful.
        }

        // Publish an event for *each* content item
        await this.eventService.publishResourceDataFetched(resourceForEvent);

        logger.info(
          `[ConnPool-${poolKey}] Published MCPResourceDataFetched for content item: ${sdkContentItem.uri}`,
        );
      } // End of for...of loop for resourceResult.contents
    } catch (error: any) {
      logger.error(
        `[ConnPool-${poolKey}] Error fetching resource ${payload.resourcePath}: ${error.message}`,
        error,
      );
      const connection = this.activeConnections.get(poolKey); // Re-fetch connection, might have changed
      if (connection) {
        // if connection still exists in map
        connectionUrl = connection.mcpServerUrl; // Update connectionUrl if available
        await this.databaseService.updateConnectionStatus(
          payload.userId,
          payload.channelId,
          payload.mcpServerConfigId,
          connection.mcpServerUrl,
          'FAILED_FETCH_RESOURCE',
          {
            lastFailureError: error.message,
            lastAttemptedAt: new Date().toISOString(),
            failureCount: 1, // increment by 1 instead of using FieldValue
          },
        );
        await this.markConnectionAsInactive(
          poolKey,
          `Fetch resource error: ${error.message}`,
          true,
          true,
        );
      } else {
        logger.warn(
          `[ConnPool-${poolKey}] Connection not found in active pool during fetch resource error handling. Database status for FAILED_FETCH_RESOURCE might not be set if connection was already removed.`,
        );
        // Attempt to update database with payload data if connection object is gone
        await this.databaseService
          .updateConnectionStatus(
            payload.userId,
            payload.channelId,
            payload.mcpServerConfigId,
            payload.mcpServerUrl, // Use payload's URL as fallback
            'FAILED_FETCH_RESOURCE',
            {
              lastFailureError: `Connection object not in map during error: ${error.message}`,
              lastAttemptedAt: new Date().toISOString(),
              failureCount: 1, // increment by 1 instead of using FieldValue
            },
          )
          .catch((fsErr: any) =>
            logger.error(
              `[ConnPool-${poolKey}] Fallback database update failed:`,
              fsErr,
            ),
          );
      }
      // Publish an error event for fetching resource
      // Assumes MCPPublisherService has publishResourceFetchError and corresponding DTO
      // await this.eventService
      //   .publishResourceFetchError({
      //     userId: payload.userId,
      //     mcpServerConfigId: payload.mcpServerConfigId,
      //     mcpServerUrl: connectionUrl,
      //     resourcePath: payload.resourcePath,
      //     convoId: payload.convoId,
      //     error: {
      //       message: error.message,
      //       code: String(error.code || error.status || 'FETCH_FAILED'),
      //       details: error.stack,
      //     },
      //   })
      //   .catch((pubErr) =>
      //     logger.error(
      //       `[ConnPool-${poolKey}] Failed to publish resource fetch error event:`,
      //       pubErr,
      //     ),
      //   );
    }
  }

  async handleInvokeToolRequest(
    payload: InvokeToolRequestPayload,
  ): Promise<void> {
    const poolKey = generateConnectionPoolKey(
      payload.userId,
      payload.mcpServerConfigId,
    );
    logger.info(
      `[ConnPool-${poolKey}] Invoking tool: ${payload.toolName} (Invocation ID: ${payload.invocationId})`,
    );
    let connectionUrl = payload.mcpServerUrl; // Fallback
    try {
      const connection = this.getConnectionOrFail(poolKey);
      connectionUrl = connection.mcpServerUrl;

      // toolInput is already an object, no need to parse if it's not a string
      const toolArguments =
        typeof payload.toolInput === 'string'
          ? JSON.parse(payload.toolInput || '{}')
          : payload.toolInput || {};

      const callToolOpts = {
        // SDK expects 'arguments' not 'input' based on typical use
        name: payload.toolName,
        arguments: toolArguments,
      };

      if (!connection.client) {
        throw new Error(`[ConnPool-${poolKey}] Client is not initialized.`);
      }

      const toolCallResponse = await connection.client.callTool(
        callToolOpts,
        undefined,
        {
          timeout: 1000 * 60 * 5,
          resetTimeoutOnProgress: true, // Reset timeout on progress updates

          // This allows long-running tools to keep the connection alive
          // and not timeout if they send progress updates.
          onprogress: async (progress: Progress) => {
            logger.info(
              `[ConnPool-${poolKey}] Tool '${
                payload.toolName
              }' (Invocation ID: ${
                payload.invocationId
              }) progress update: ${JSON.stringify(progress)}`,
            );
            await this.eventService.publishToolInvocationProgress({
              generatedAt: new Date().toISOString(),
              userId: payload.userId,
              mcpServerConfigId: payload.mcpServerConfigId,
              mcpServerUrl: connectionUrl,
              invocationId: payload.invocationId,
              progress,
              timestamp: new Date().toISOString(),
            });
          },
        },
      ); // 5 minute timeout for tool calls
      logger.info(
        `[ConnPool-${poolKey}] Tool '${payload.toolName}' (Invocation ID: ${
          payload.invocationId
        }) invoked. Response: ${JSON.stringify(toolCallResponse)}`,
      );

      const resultData =
        toolCallResponse.result !== undefined
          ? toolCallResponse.result
          : toolCallResponse; // If .result is not present, the whole response might be the result

      await this.eventService.publishToolResult({
        generatedAt: new Date().toISOString(),
        userId: payload.userId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: connection.mcpServerUrl,
        invocationId: payload.invocationId,
        toolName: payload.toolName,
        convoId: payload.convoId,
        resourcePath: payload.resourcePath,
        status: 'success',
        result: resultData,
      });
    } catch (error: any) {
      logger.error(
        `[ConnPool-${poolKey}] Error invoking tool '${payload.toolName}' (Invocation ID: ${payload.invocationId}): ${error.message}`,
        error,
      );
      // The console logs you added were helpful for debugging, can be removed if you wish.
      console.log('error', error);
      console.log('code', error.code);

      const isMcpError = !!error.code;
      const connection = this.activeConnections.get(poolKey); // Re-fetch
      // Default to payload URL, but prefer the one from the active connection if available.
      let connectionUrl = payload.mcpServerUrl;

      if (connection && !isMcpError) {
        try {
          connectionUrl = connection.mcpServerUrl;
          await this.databaseService.updateConnectionStatus(
            payload.userId,
            payload.channelId,
            payload.mcpServerConfigId,
            connection.mcpServerUrl,
            'FAILED_INVOKE_TOOL',
            {
              lastFailureError: error.message,
              lastAttemptedAt: new Date().toISOString(),
              failureCount: 1, // increment by 1 instead of using FieldValue
            },
          );
          await this.markConnectionAsInactive(
            poolKey,
            error.message,
            true,
            true,
          );
        } catch (fsError) {
          logger.error(
            `[ConnPool-${poolKey}] Failed to update Firestore status to FAILED_INVOKE_TOOL:`,
            fsError as Error,
          );
        }
      } else if (connection && isMcpError) {
        // If connection exists and error is from MCP SDK itself
        connectionUrl = connection.mcpServerUrl; // Use existing connection URL

        // --- START: MODIFICATION FOR GRACEFUL TOOL-DISABLED HANDLING ---

        // The MCP SDK uses JSON-RPC error code -32602 for disabled/invalid tools.
        const disabledToolErrorCode = '-32602';

        if (String(error.code) === disabledToolErrorCode) {
          logger.warn(
            `[ConnPool-${poolKey}] Tool '${payload.toolName}' is disabled or not found (Code: ${error.code}). Attempting to resync the tool list for the client.`,
          );
          try {
            // Re-fetch the list of available tools from the source
            const toolsResponse = await connection.client?.listTools();

            if (!toolsResponse) {
              throw new Error('Failed to fetch tools from MCP server.');
            }

            // Publish the updated (and now correct) tool list to the client
            await this.eventService.publishToolsFetched({
              generatedAt: new Date().toISOString(),
              userId: payload.userId,
              mcpServerConfigId: payload.mcpServerConfigId,
              mcpServerUrl: connection.mcpServerUrl,
              tools: toolsResponse.tools,
            });
            logger.info(
              `[ConnPool-${poolKey}] Successfully published updated tool list after disabled tool error.`,
            );
          } catch (syncError: any) {
            logger.error(
              `[ConnPool-${poolKey}] Failed to resync tools after a disabled tool invocation error: ${syncError.message}`,
              syncError,
            );
          }
        } else {
          // For other MCP SDK errors, just log a warning as before.
          logger.warn(
            `[ConnPool-${poolKey}] MCP SDK error during tool invocation: ${error.message}. Not marking connection as inactive.`,
          );
        }
        // --- END: MODIFICATION ---
      } else {
        logger.warn(
          `[ConnPool-${poolKey}] Connection not found in active pool during invoke tool error handling. Database status for FAILED_INVOKE_TOOL might not be set if connection was already removed.`,
        );
        await this.databaseService
          .updateConnectionStatus(
            payload.userId,
            payload.channelId,
            payload.mcpServerConfigId,
            payload.mcpServerUrl, // Use payload's URL as fallback
            'FAILED_INVOKE_TOOL',
            {
              lastFailureError: `Connection object not in map during error: ${error.message}`,
              lastAttemptedAt: new Date().toISOString(),
              failureCount: 1, // increment by 1 instead of using FieldValue
            },
          )
          .catch((fsErr: any) =>
            logger.error(
              `[ConnPool-${poolKey}] Fallback database update failed:`,
              fsErr,
            ),
          );
      }

      // This is still necessary to inform the original caller that this specific invocation failed.
      await this.eventService
        .publishToolResult({
          generatedAt: new Date().toISOString(),
          userId: payload.userId,
          mcpServerConfigId: payload.mcpServerConfigId,
          mcpServerUrl: connectionUrl,
          invocationId: payload.invocationId,
          toolName: payload.toolName,
          convoId: payload.convoId,
          resourcePath: payload.resourcePath,
          status: 'error',
          error: {
            message: error.message,
            code: String(
              error.code ||
                error.status ||
                error.response?.status ||
                'TOOL_INVOCATION_FAILED',
            ),
            details: error.data || error.stack,
          },
        })
        .catch((pubErr: any) =>
          logger.error(
            `[ConnPool-${poolKey}] Failed to publish tool error event (Invocation ID: ${payload.invocationId}):`,
            pubErr,
          ),
        );
    }
  }

  async handleDisconnectRequest(
    payload: DisconnectRequestPayload,
  ): Promise<void> {
    const poolKey = generateConnectionPoolKey(
      payload.userId,
      payload.mcpServerConfigId,
    );
    logger.info(
      `[ConnPool-${poolKey}] Disconnect request for ${payload.mcpServerUrl}. ActingUser: ${payload.userId}`,
    );
    const connection = this.activeConnections.get(poolKey);

    try {
      // Always update database to reflect user's intent first
      await this.databaseService.updateConnectionStatus(
        payload.userId,
        payload.channelId,
        payload.mcpServerConfigId,
        payload.mcpServerUrl, // Use URL from payload as source of truth for this config
        'DISCONNECTED_BY_USER',
      );
    } catch (error: any) {
      // Log but do not fail the disconnect if database update fails
      // Failure indicates connection was already removed or never existed
      logger.error(
        `[ConnPool-${poolKey}] Error updating Firestore status to DISCONNECTED_BY_USER: ${error.message}`,
        error,
      );
    }

    if (connection?.client) {
      try {
        await connection.client.close();
        logger.info(
          `[ConnPool-${poolKey}] Called client.close() successfully.`,
        );
      } catch (error: any) {
        logger.error(
          `[ConnPool-${poolKey}] Error during client.close(): ${error.message}`,
          error,
        );
      } finally {
        // markConnectionAsInactive will handle removal from map and publishing event
        await this.markConnectionAsInactive(
          poolKey,
          'Explicit disconnect request processed.',
          true, // deleteFromPool
          true, // skipFirestoreStatusUpdate (already set to DISCONNECTED_BY_USER)
        );
      }
    } else {
      logger.info(
        `[ConnPool-${poolKey}] No active client found for disconnect request. Ensuring removal from pool if present.`,
      );
      if (this.activeConnections.has(poolKey)) {
        this.activeConnections.delete(poolKey);
        logger.info(
          `[ConnPool-${poolKey}] Removed stale connection entry from pool.`,
        );
      }
      // Publish a disconnect event even if client wasn't active, to confirm the action
      await this.eventService.publishConnectionStatusUpdate({
        generatedAt: new Date().toISOString(),
        userId: payload.userId,
        mcpServerConfigId: payload.mcpServerConfigId,
        mcpServerUrl: payload.mcpServerUrl,
        status: 'disconnected',
        lastUpdated: new Date(),
        error: {
          message: 'Disconnected by user request (no active client found).',
          code: 'user_disconnect_no_client',
        },
      });
    }
  }

  async shutdownAllConnections(): Promise<void> {
    logger.info('Shutting down all active MCP connections...');
    const connectionsToShutdown = Array.from(this.activeConnections.entries());

    for (const [poolKey, connection] of connectionsToShutdown) {
      logger.info(
        `[ConnPool-${poolKey}] Initiating shutdown for connection to ${connection.mcpServerUrl}`,
      );
      // Set database status first
      await this.databaseService.updateConnectionStatus(
        connection.userId,
        connection.channelId,
        connection.mcpServerConfigId,
        connection.mcpServerUrl,
        'DISCONNECTED_ON_SHUTDOWN',
      );

      try {
        if (connection.client && connection.isActiveAttempted) {
          await connection.client.close();
          logger.info(
            `[ConnPool-${poolKey}] Client closed successfully during shutdown.`,
          );
        }
      } catch (error: any) {
        logger.error(
          `[ConnPool-${poolKey}] Error during client.close() on shutdown: ${error.message}`,
          error,
        );
      } finally {
        // markConnectionAsInactive handles removal from map and publishing event
        await this.markConnectionAsInactive(
          poolKey,
          'Connection pool shutdown.',
          true, // deleteFromPool
          true, // skipFirestoreStatusUpdate (already set to DISCONNECTED_ON_SHUTDOWN)
        );
      }
    }
    this.activeConnections.clear(); // Final clear to ensure map is empty
    logger.info('All MCP connections processed for shutdown.');
  }

  public async reestablishPersistentConnections(): Promise<void> {
    logger.info(
      'Attempting to re-establish persistent connections from Firestore...',
    );
    try {
      const connectionsToReestablish =
        await this.databaseService.getReconnectableConnections();
      logger.info(
        `Found ${connectionsToReestablish.length} connections to re-establish.`,
      );
      for (const storedConn of connectionsToReestablish) {
        logger.info(
          `Attempting to re-establish connection for workspace ${storedConn.userId} (config: ${storedConn.mcpServerConfigId}) to ${storedConn.mcpServerBaseUrl}`,
        );
        await this.databaseService.updateConnectionStatus(
          storedConn.userId,
          storedConn.channel_id,
          storedConn.mcpServerConfigId,
          storedConn.mcpServerBaseUrl,
          'RECONNECTING_ON_STARTUP',
          {
            lastAttemptedAt: new Date().toISOString(),
          },
        );

        try {
          await this.handleConnectionRequest({
            userId: storedConn.userId,
            channelId: storedConn.channel_id,
            mcpServerUrl: storedConn.mcpServerBaseUrl,
            mcpServerConfigId: storedConn.mcpServerConfigId,
            generatedAt: new Date().toISOString(),
            // isReconnectAttempt: true, // Add to DTO if this flag is meaningful for handleConnectionRequest
          });
        } catch (error: any) {
          // This catch is likely redundant if handleConnectionRequest handles its own errors
          logger.error(
            `[WS-${storedConn.userId}] Failed to trigger re-establishment for ${storedConn.mcpServerBaseUrl} on startup: ${error.message}`,
            error,
          );
          // Error should have been handled and Firestore updated by handleConnectionRequest's catch block
        }
      }
    } catch (error: any) {
      logger.error(
        'Error querying or processing connections for re-establishment from database:',
        error,
      );
    }
    logger.info(
      'Re-establishment of persistent connections attempt completed.',
    );
  }

  /**
   * Get diagnostic information about the current state of active connections
   */
  public getDiagnosticInfo(): {
    activeConnectionCount: number;
    activeConnectionKeys: string[];
    connectionDetails: Array<{
      poolKey: string;
      isActiveAttempted: boolean;
      hasClient: boolean;
      currentTransportType?: string;
    }>;
  } {
    const connectionDetails = Array.from(this.activeConnections.entries()).map(
      ([poolKey, connection]) => ({
        poolKey,
        isActiveAttempted: connection.isActiveAttempted,
        hasClient: !!connection.client,
        currentTransportType: connection.currentTransportType,
      }),
    );

    return {
      activeConnectionCount: this.activeConnections.size,
      activeConnectionKeys: Array.from(this.activeConnections.keys()),
      connectionDetails,
    };
  }
}
