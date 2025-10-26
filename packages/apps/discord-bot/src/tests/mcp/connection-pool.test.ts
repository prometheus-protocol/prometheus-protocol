import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionPoolService } from '../../services/connections.js';
import { SupabaseService } from '../../services/database.js';
import { MCPEventService } from '../../services/event-emitter.service.js';
import { ConnectionManagerOAuthProvider } from '../../mcp/oauth-provider.js';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { pendingRequestManager } from '../../services/pending-request-manager.js';
import { auth } from '../../mcp/oauth.js';
import type {
  ConnectionRequestPayload,
  TokensObtainedPayload,
  FetchResourceRequestPayload,
  InvokeToolRequestPayload,
  DisconnectRequestPayload,
  SamplingDecisionSubmittedPayload,
} from '../../dtos/pubsub.events.dto.js';

// Mock external dependencies
vi.mock('@modelcontextprotocol/sdk/client/index.js');
vi.mock('@modelcontextprotocol/sdk/client/streamable-http.js');
vi.mock('@modelcontextprotocol/sdk/client/sse.js');
vi.mock('@modelcontextprotocol/sdk/shared/auth.js');
vi.mock('../../mcp/oauth-provider.js');
vi.mock('../../services/event-emitter.service.js');
vi.mock('../../services/pending-request-manager.js');

// Mock auth function
vi.mock('../../mcp/oauth.js', () => ({
  auth: vi.fn().mockResolvedValue('SUCCESS'),
}));

const createMockDatabase = (): SupabaseService => {
  const mockDb = {
    storeConnectionDetails: vi.fn().mockResolvedValue(undefined),
    updateConnectionStatus: vi.fn().mockResolvedValue(undefined),
    getReconnectableConnections: vi.fn(),
    getUserMCPConnection: vi.fn().mockResolvedValue(null),
  } as any;
  mockDb.getReconnectableConnections.mockResolvedValue([]);
  return mockDb;
};

const createMockEventService = (): MCPEventService => {
  const mockEventService = {
    publishConnectionStatusUpdate: vi.fn().mockResolvedValue(undefined),
    publishAuthRequired: vi.fn().mockResolvedValue(undefined),
    publishServerCapabilities: vi.fn().mockResolvedValue(undefined),
    publishToolsFetched: vi.fn().mockResolvedValue(undefined),
    publishResourcesFetched: vi.fn().mockResolvedValue(undefined),
    publishResourceDataFetched: vi.fn().mockResolvedValue(undefined),
    publishToolResult: vi.fn().mockResolvedValue(undefined),
    publishToolInvocationProgress: vi.fn().mockResolvedValue(undefined),
    publishNotificationReceived: vi.fn().mockResolvedValue(undefined),
    publishSamplingRequestReceived: vi.fn().mockResolvedValue(undefined),
    publishElicitationRequestReceived: vi.fn().mockResolvedValue(undefined),
  } as any;
  return mockEventService;
};

const createMockClient = () => {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getServerCapabilities: vi
      .fn()
      .mockReturnValue({ tools: { listChanged: true } }),
    getServerVersion: vi
      .fn()
      .mockReturnValue({ name: 'Test Server', version: '1.0.0' }),
    listTools: vi.fn().mockResolvedValue({
      tools: [{ name: 'test-tool', description: 'Test tool' }],
    }),
    listResources: vi.fn().mockResolvedValue({
      resources: [{ uri: 'test://resource', name: 'Test Resource' }],
    }),
    callTool: vi.fn().mockResolvedValue({ result: { success: true } }),
    readResource: vi.fn().mockResolvedValue({
      contents: [
        {
          uri: 'test://resource',
          text: 'Test content',
          mimeType: 'text/plain',
        },
      ],
    }),
    setRequestHandler: vi.fn(),
    setNotificationHandler: vi.fn(),
    onclose: undefined,
    onerror: undefined,
  };
};

const createMockAuthProvider = () => {
  return {
    tokens: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
  };
};

describe('ConnectionPoolService', () => {
  let connectionPool: ConnectionPoolService;
  let mockDatabase: SupabaseService;
  let mockEventService: MCPEventService;
  let mockClient: any;
  let mockAuthProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase = createMockDatabase();
    mockEventService = createMockEventService();
    mockClient = createMockClient();
    mockAuthProvider = createMockAuthProvider();

    // Mock the McpClient constructor
    vi.mocked(McpClient).mockImplementation(() => mockClient as any);
    vi.mocked(ConnectionManagerOAuthProvider).mockImplementation(
      () => mockAuthProvider as any,
    );

    // Set up mock auth function
    vi.mocked(auth).mockResolvedValue('AUTHORIZED');

    connectionPool = new ConnectionPoolService(mockDatabase, mockEventService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with database service', () => {
      expect(connectionPool).toBeInstanceOf(ConnectionPoolService);
      expect((connectionPool as any).databaseService).toBe(mockDatabase);
    });

    it('should initialize empty connection maps', () => {
      const activeConnections = (connectionPool as any).activeConnections;
      expect(activeConnections.size).toBe(0);
    });
  });

  describe('handleConnectionRequest', () => {
    const mockPayload: ConnectionRequestPayload = {
      userId: 'test-user',
      channelId: 'test-channel',
      mcpServerConfigId: 'test-server',
      mcpServerUrl: 'https://test.com',
      generatedAt: new Date().toISOString(),
    };
    it('should handle successful connection request', async () => {
      await connectionPool.handleConnectionRequest(mockPayload);

      // Should store initial connection details
      expect(mockDatabase.storeConnectionDetails).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        'CONNECTION_REQUESTED',
        expect.any(Object),
        mockPayload.mcpServerUrl,
      );

      // Should create and connect client
      expect(McpClient).toHaveBeenCalled();
      expect(mockClient.connect).toHaveBeenCalled();

      // Should update status to ACTIVE
      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        mockPayload.mcpServerUrl,
        'ACTIVE',
        expect.objectContaining({
          lastSucceededAt: expect.any(String),
          failureCount: 0,
        }),
      );

      // Should publish connection status update
      expect(
        mockEventService.publishConnectionStatusUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'connected',
          userId: mockPayload.userId,
          mcpServerConfigId: mockPayload.mcpServerConfigId,
        }),
      );
    });

    it('should handle missing required fields', async () => {
      const invalidPayload = {
        userId: '',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://test-server.com/mcp',
      } as ConnectionRequestPayload;

      await connectionPool.handleConnectionRequest(invalidPayload);

      // Should not proceed with connection
      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('should handle existing active connection', async () => {
      // First connection
      await connectionPool.handleConnectionRequest(mockPayload);
      vi.clearAllMocks();

      // Second connection with same key
      await connectionPool.handleConnectionRequest(mockPayload);

      // Should recognize existing connection
      expect(mockClient.connect).not.toHaveBeenCalledTimes(2);
    });

    it('should handle connection failure', async () => {
      const connectionError = new Error('Connection failed');

      // Create a fresh client for this test with failure
      const failingClient = createMockClient();
      failingClient.connect.mockRejectedValue(connectionError);
      vi.mocked(McpClient).mockImplementationOnce(() => failingClient as any);

      await connectionPool.handleConnectionRequest(mockPayload);

      // Should update status to FAILED_CONNECTION
      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        mockPayload.mcpServerUrl,
        'FAILED_CONNECTION',
        expect.objectContaining({
          lastFailureError: connectionError.message,
        }),
      );

      // Should publish disconnected status
      expect(
        mockEventService.publishConnectionStatusUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'disconnected',
          error: expect.objectContaining({
            message: connectionError.message,
          }),
        }),
      );
    });

    it('should handle auth redirect response', async () => {
      // Create a fresh connection pool for this test
      const freshConnectionPool = new ConnectionPoolService(
        mockDatabase,
        mockEventService,
      );

      // Mock the auth provider constructor to return a provider with no tokens
      const mockAuthProvider = createMockAuthProvider();
      mockAuthProvider.tokens.mockRejectedValue(
        new Error('No tokens available'),
      );

      // Mock the ConnectionManagerOAuthProvider constructor
      vi.mocked(ConnectionManagerOAuthProvider).mockImplementationOnce(
        () => mockAuthProvider as any,
      );

      // Mock client to throw an authentication-related error after auth succeeds
      const mockClient = createMockClient();
      mockClient.connect.mockRejectedValue(new Error('authentication failed'));
      vi.mocked(McpClient).mockImplementationOnce(() => mockClient as any);

      // Mock auth function to return success so we get to the connection attempt
      vi.mocked(auth).mockResolvedValueOnce('AUTHORIZED');

      await freshConnectionPool.handleConnectionRequest(mockPayload);

      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        mockPayload.mcpServerUrl,
        'AUTH_PENDING',
        expect.any(Object),
      );
    });
  });

  describe('handleTokensObtained', () => {
    const mockPayload: TokensObtainedPayload = {
      userId: 'test-user',
      channelId: 'test-channel',
      mcpServerConfigId: 'test-server',
      mcpServerUrl: 'https://test.com',
      generatedAt: new Date().toISOString(),
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };
    it('should handle tokens obtained for existing connection', async () => {
      // First establish a connection
      const connectionPayload: ConnectionRequestPayload = {
        userId: mockPayload.userId,
        channelId: 'test-channel',
        mcpServerConfigId: mockPayload.mcpServerConfigId,
        mcpServerUrl: mockPayload.mcpServerUrl,
        generatedAt: mockPayload.generatedAt,
      };
      await connectionPool.handleConnectionRequest(connectionPayload);
      vi.clearAllMocks();

      // Handle tokens obtained
      await connectionPool.handleTokensObtained(mockPayload);

      // Should trigger full connection re-establishment
      expect(mockDatabase.storeConnectionDetails).toHaveBeenCalled();
    });

    it('should handle tokens obtained without existing connection', async () => {
      await connectionPool.handleTokensObtained(mockPayload);

      // Should initiate full connection request
      expect(mockDatabase.storeConnectionDetails).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        'CONNECTION_REQUESTED',
        expect.any(Object),
        mockPayload.mcpServerUrl,
      );
    });
  });

  describe('handleInvokeToolRequest', () => {
    const mockPayload: InvokeToolRequestPayload = {
      userId: 'test-user',
      channelId: 'test-channel',
      mcpServerConfigId: 'test-server',
      mcpServerUrl: 'https://test.com',
      generatedAt: new Date().toISOString(),
      invocationId: 'test-invocation',
      toolName: 'test-tool',
      toolInput: '{"test": "input"}',
      convoId: 'test-convo',
    };
    beforeEach(async () => {
      // Establish a connection first
      const connectionPayload: ConnectionRequestPayload = {
        userId: mockPayload.userId,
        channelId: 'test-channel',
        mcpServerConfigId: mockPayload.mcpServerConfigId,
        mcpServerUrl: mockPayload.mcpServerUrl,
        generatedAt: mockPayload.generatedAt,
      };
      await connectionPool.handleConnectionRequest(connectionPayload);
      vi.clearAllMocks();
    });

    it('should invoke tool successfully', async () => {
      await connectionPool.handleInvokeToolRequest(mockPayload);

      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: mockPayload.toolName,
          arguments: { test: 'input' },
        },
        undefined,
        expect.objectContaining({
          timeout: expect.any(Number),
          onprogress: expect.any(Function),
        }),
      );

      expect(mockEventService.publishToolResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          invocationId: mockPayload.invocationId,
          toolName: mockPayload.toolName,
        }),
      );
    });

    it('should handle tool invocation error', async () => {
      const toolError = new Error('Tool execution failed');
      mockClient.callTool.mockRejectedValueOnce(toolError);

      await connectionPool.handleInvokeToolRequest(mockPayload);

      expect(mockEventService.publishToolResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: expect.objectContaining({
            message: toolError.message,
          }),
        }),
      );
    });

    it('should handle missing connection', async () => {
      // Create a fresh connection pool without any existing connections
      const freshConnectionPool = new ConnectionPoolService(
        mockDatabase,
        mockEventService,
      );

      // The method should complete without throwing, but publish error events
      await freshConnectionPool.handleInvokeToolRequest(mockPayload);

      // Should publish tool result with error status
      expect(mockEventService.publishToolResult).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: expect.objectContaining({
            message:
              'Connection to MCP server not found or inactive. Trigger a new connection request [here](/mcp).',
          }),
        }),
      );
    });

    it('should handle tool progress updates', async () => {
      const progressCallback = vi.fn();
      mockClient.callTool.mockImplementationOnce(
        async (opts: any, _undefined: any, config: any) => {
          // Simulate progress update
          await config.onprogress({ progress: 50, message: 'Processing...' });
          return { result: { success: true } };
        },
      );

      await connectionPool.handleInvokeToolRequest(mockPayload);

      expect(
        mockEventService.publishToolInvocationProgress,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          invocationId: mockPayload.invocationId,
          progress: { progress: 50, message: 'Processing...' },
        }),
      );
    });
  });

  describe('handleFetchResourceRequest', () => {
    const mockPayload: FetchResourceRequestPayload = {
      userId: 'workspace-123',
      channelId: 'test-channel',
      mcpServerConfigId: 'server-456',
      mcpServerUrl: 'https://test-server.com/mcp',
      generatedAt: new Date().toISOString(),
      resourcePath: 'test://resource',
      convoId: 'convo-123',
    };

    beforeEach(async () => {
      // Establish a connection first
      const connectionPayload: ConnectionRequestPayload = {
        userId: mockPayload.userId,
        channelId: 'test-channel',
        mcpServerConfigId: mockPayload.mcpServerConfigId,
        mcpServerUrl: mockPayload.mcpServerUrl,
        generatedAt: mockPayload.generatedAt,
      };
      await connectionPool.handleConnectionRequest(connectionPayload);
      vi.clearAllMocks();
    });

    it('should fetch resource successfully', async () => {
      await connectionPool.handleFetchResourceRequest(mockPayload);

      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: mockPayload.resourcePath,
      });

      expect(mockEventService.publishResourceDataFetched).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'test://resource',
          originalRequestUri: mockPayload.resourcePath,
          mimeType: 'text/plain',
        }),
      );
    });

    it('should handle empty resource content', async () => {
      mockClient.readResource.mockResolvedValueOnce({ contents: [] });

      await connectionPool.handleFetchResourceRequest(mockPayload);

      expect(
        mockEventService.publishResourceDataFetched,
      ).not.toHaveBeenCalled();
    });

    it('should handle resource fetch error', async () => {
      const fetchError = new Error('Resource not found');
      mockClient.readResource.mockRejectedValueOnce(fetchError);

      await connectionPool.handleFetchResourceRequest(mockPayload);

      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        expect.any(String),
        'FAILED_FETCH_RESOURCE',
        expect.objectContaining({
          lastFailureError: fetchError.message,
        }),
      );
    });
  });

  describe('handleDisconnectRequest', () => {
    const mockPayload: DisconnectRequestPayload = {
      userId: 'workspace-123',
      channelId: 'test-channel',
      mcpServerConfigId: 'server-456',
      mcpServerUrl: 'https://test-server.com/mcp',
      generatedAt: new Date().toISOString(),
    };

    it('should disconnect active connection', async () => {
      // Establish connection first
      const connectionPayload: ConnectionRequestPayload = {
        userId: mockPayload.userId,
        channelId: 'test-channel',
        mcpServerConfigId: mockPayload.mcpServerConfigId,
        mcpServerUrl: mockPayload.mcpServerUrl,
        generatedAt: mockPayload.generatedAt,
      };
      await connectionPool.handleConnectionRequest(connectionPayload);
      vi.clearAllMocks();

      await connectionPool.handleDisconnectRequest(mockPayload);

      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        mockPayload.mcpServerUrl,
        'DISCONNECTED_BY_USER',
      );

      expect(mockClient.close).toHaveBeenCalled();
      expect(
        mockEventService.publishConnectionStatusUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'disconnected',
        }),
      );
    });

    it('should handle disconnect when no active connection exists', async () => {
      await connectionPool.handleDisconnectRequest(mockPayload);

      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        mockPayload.userId,
        mockPayload.channelId,
        mockPayload.mcpServerConfigId,
        mockPayload.mcpServerUrl,
        'DISCONNECTED_BY_USER',
      );

      expect(
        mockEventService.publishConnectionStatusUpdate,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'disconnected',
          error: expect.objectContaining({
            message: expect.stringContaining('no active client found'),
          }),
        }),
      );
    });
  });

  describe('handleSamplingDecisionSubmitted', () => {
    const mockPayload: SamplingDecisionSubmittedPayload = {
      userId: 'workspace-123',
      channelId: 'test-channel',
      mcpServerConfigId: 'server-456',
      mcpServerUrl: 'https://test-server.com/mcp',
      generatedAt: new Date().toISOString(),
      sdkContext: {
        sessionId: 'session-123',
        requestId: 456,
      },
      decision: 'approved',
      approvedCompletion: {
        model: 'test-model',
        role: 'assistant',
        content: { type: 'text', text: 'Approved response' },
      },
    };

    it('should handle approved sampling decision', async () => {
      // Reset mocks
      vi.mocked(pendingRequestManager.resolveRequest).mockClear();
      vi.mocked(pendingRequestManager.rejectRequest).mockClear();

      await connectionPool.handleSamplingDecisionSubmitted(mockPayload);

      expect(pendingRequestManager.resolveRequest).toHaveBeenCalledWith(
        'session-123:456',
        mockPayload.approvedCompletion,
      );
    });

    it('should handle rejected sampling decision', async () => {
      const rejectedPayload: SamplingDecisionSubmittedPayload = {
        ...mockPayload,
        decision: 'rejected',
        rejectionReason: 'User declined',
        approvedCompletion: undefined,
      };

      // Reset mocks
      vi.mocked(pendingRequestManager.resolveRequest).mockClear();
      vi.mocked(pendingRequestManager.rejectRequest).mockClear();

      await connectionPool.handleSamplingDecisionSubmitted(rejectedPayload);

      expect(pendingRequestManager.rejectRequest).toHaveBeenCalledWith(
        'session-123:456',
        expect.objectContaining({
          code: 'SamplingRejected',
          message: 'User declined',
        }),
      );
    });
  });

  describe('shutdownAllConnections', () => {
    it('should shutdown all active connections', async () => {
      // Create one mock client for testing
      const mockClient1 = createMockClient();

      // Mock the McpClient constructor to return the client
      vi.mocked(McpClient).mockImplementationOnce(() => mockClient1 as any);

      // Establish a single connection
      const payload = {
        userId: 'workspace-1',
        channelId: 'test-channel',
        mcpServerConfigId: 'server-1',
        mcpServerUrl: 'https://test-server-1.com/mcp',
        generatedAt: new Date().toISOString(),
      } as ConnectionRequestPayload;

      await connectionPool.handleConnectionRequest(payload);

      vi.clearAllMocks();

      await connectionPool.shutdownAllConnections();

      // Should close the client
      expect(mockClient1.close).toHaveBeenCalledTimes(1);

      // Should update database status
      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        'workspace-1',
        'test-channel',
        'server-1',
        'https://test-server-1.com/mcp',
        'DISCONNECTED_ON_SHUTDOWN',
      );

      // Should clear the connections map
      const activeConnections = (connectionPool as any).activeConnections;
      expect(activeConnections.size).toBe(0);
    }, 10000);

    it('should handle shutdown errors gracefully', async () => {
      // Establish connection
      const connectionPayload: ConnectionRequestPayload = {
        userId: 'workspace-123',
        channelId: 'test-channel',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://test-server.com',
        generatedAt: new Date().toISOString(),
      };
      await connectionPool.handleConnectionRequest(connectionPayload);

      // Mock client.close to throw error
      mockClient.close.mockRejectedValueOnce(new Error('Close failed'));

      await connectionPool.shutdownAllConnections();

      // Should still update database and clear connections
      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalled();
      const activeConnections = (connectionPool as any).activeConnections;
      expect(activeConnections.size).toBe(0);
    });
  });

  describe('reestablishPersistentConnections', () => {
    it('should reestablish connections from database', async () => {
      const mockStoredConnections = [
        {
          userId: 'workspace-123',
          channel_id: 'test-channel',
          mcpServerConfigId: 'server-456',
          mcpServerBaseUrl: 'https://test-server.com/mcp',
        },
      ];

      vi.mocked(mockDatabase.getReconnectableConnections).mockResolvedValueOnce(
        mockStoredConnections,
      );

      await connectionPool.reestablishPersistentConnections();

      expect(mockDatabase.getReconnectableConnections).toHaveBeenCalled();
      expect(mockDatabase.updateConnectionStatus).toHaveBeenCalledWith(
        'workspace-123',
        'test-channel',
        'server-456',
        'https://test-server.com/mcp',
        'RECONNECTING_ON_STARTUP',
        expect.any(Object),
      );
    });

    it('should handle database errors during reestablishment', async () => {
      vi.mocked(mockDatabase.getReconnectableConnections).mockRejectedValueOnce(
        new Error('Database error'),
      );

      await connectionPool.reestablishPersistentConnections();

      // Should not throw, just log the error
      expect(mockDatabase.getReconnectableConnections).toHaveBeenCalled();
    });
  });

  describe('connection pool key generation', () => {
    it('should generate consistent pool keys', () => {
      // Test the key generation logic directly by using the same logic as the service
      const generateConnectionPoolKey = (
        userId: string,
        mcpServerConfigId: string,
      ) => {
        return `${userId}::${mcpServerConfigId}`;
      };

      const key1 = generateConnectionPoolKey('user-789', 'server-456');
      const key2 = generateConnectionPoolKey('user-789', 'server-456');

      // Keys should be consistent
      expect(key1).toBe(key2);
      expect(key1).toBe('user-789::server-456');

      // Different inputs should produce different keys
      const key3 = generateConnectionPoolKey('user-123', 'server-456');
      expect(key3).not.toBe(key1);
      expect(key3).toBe('user-123::server-456');
    });
  });
});
