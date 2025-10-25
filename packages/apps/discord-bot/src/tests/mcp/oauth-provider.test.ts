import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManagerOAuthProvider } from '../../mcp/oauth-provider.js';
import { DatabaseService } from '../../types/services.js';
import { MCPEventService } from '../../services/event-emitter.service.js';
import type {
  OAuthMetadata,
  OAuthClientInformation,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// Mock the database service
const createMockDatabaseService = (): DatabaseService => ({
  // OAuth server metadata methods
  saveOAuthServerMetadata: vi.fn(),
  getOAuthServerMetadata: vi.fn(),
  deleteOAuthServerMetadata: vi.fn(),

  // OAuth client methods
  saveOAuthClientInfo: vi.fn(),
  getOAuthClientInfo: vi.fn(),
  deleteOAuthClientInfo: vi.fn(),

  // OAuth tokens methods
  saveOAuthTokens: vi.fn(),
  getOAuthTokens: vi.fn(),
  deleteOAuthTokens: vi.fn(),

  // OAuth pending methods
  saveOAuthPending: vi.fn(),
  getOAuthPending: vi.fn(),
  getOAuthPendingByState: vi.fn(),
  deleteOAuthPending: vi.fn(),

  // Conversation methods (not used in OAuth provider)
  saveConversation: vi.fn(),
  saveConversationTurn: vi.fn(),
  getConversationHistory: vi.fn(),

  // Alert methods (not used in OAuth provider)
  saveAlertState: vi.fn(),
  getLastAlertState: vi.fn(),
  saveAlert: vi.fn(),
  loadAlerts: vi.fn(),
  updateAlert: vi.fn(),
  deleteAlert: vi.fn(),

  // User preferences (not used in OAuth provider)
  saveUserPreferences: vi.fn(),
  getUserPreferences: vi.fn(),

  // User tasks (not used in OAuth provider)
  saveUserTask: vi.fn(),
  getUserTasks: vi.fn(),
  getUserTask: vi.fn(),
  updateTaskEnabled: vi.fn(),
  updateTaskInterval: vi.fn(),
  updateTaskLastRun: vi.fn(),
  deleteUserTask: vi.fn(),

  // MCP connections (not used in OAuth provider)
  saveUserMCPConnection: vi.fn(),
  getUserMCPConnection: vi.fn(),
  getUserMCPConnections: vi.fn(),
  updateUserMCPConnection: vi.fn(),
  deleteUserMCPConnection: vi.fn(),
  clearConversationHistory: vi.fn(),
});

// Mock the event service
const createMockEventService = (): MCPEventService =>
  ({
    publishAuthRequired: vi.fn().mockResolvedValue(undefined),
    publishConnectionStatusUpdate: vi.fn().mockResolvedValue(undefined),
    publishResourcesFetched: vi.fn().mockResolvedValue(undefined),
    publishToolsFetched: vi.fn().mockResolvedValue(undefined),
    publishServerCapabilities: vi.fn().mockResolvedValue(undefined),
    publishNotificationReceived: vi.fn().mockResolvedValue(undefined),
    publishToolResult: vi.fn().mockResolvedValue(undefined),
    publishResourceDataFetched: vi.fn().mockResolvedValue(undefined),
    publishToolInvocationProgress: vi.fn().mockResolvedValue(undefined),
    publishElicitationRequestReceived: vi.fn().mockResolvedValue(undefined),
    publishSamplingRequestReceived: vi.fn().mockResolvedValue(undefined),
    publishResourceFetchError: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    setMaxListeners: vi.fn(),
    onConnectionStatusUpdate: vi.fn(),
    onResourcesFetched: vi.fn(),
    onToolsFetched: vi.fn(),
    onToolResult: vi.fn(),
  }) as any;

describe('ConnectionManagerOAuthProvider', () => {
  let provider: ConnectionManagerOAuthProvider;
  let mockDatabase: DatabaseService;
  let mockEventService: MCPEventService;

  const testServerConfigId = 'test-server-123';
  const testUserId = 'user-456';

  // Mock environment variable
  const originalEnv = process.env.OAUTH_CALLBACK_URL;

  beforeEach(() => {
    mockDatabase = createMockDatabaseService();
    mockEventService = createMockEventService();
    provider = new ConnectionManagerOAuthProvider(
      testServerConfigId,
      testUserId,
      mockDatabase,
      mockEventService,
      'https://test-server.com', // Test server URL
    );

    // Set up environment
    process.env.OAUTH_CALLBACK_URL = 'https://example.com/oauth/callback';

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.OAUTH_CALLBACK_URL = originalEnv;
  });

  describe('constructor and basic properties', () => {
    it('should initialize with correct parameters', () => {
      expect(provider).toBeInstanceOf(ConnectionManagerOAuthProvider);
      expect(provider.redirectUrl).toBe('https://example.com/oauth/callback');
    });

    it('should have correct client metadata', () => {
      const metadata = provider.clientMetadata;

      expect(metadata).toEqual({
        redirect_uris: ['https://example.com/oauth/callback'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'Prometheus Protocol Discord Bot',
        client_uri: 'https://prometheusprotocol.org',
      });
    });
  });

  describe('serverMetadata', () => {
    const mockMetadata: OAuthMetadata = {
      issuer: 'https://example.com',
      authorization_endpoint: 'https://example.com/auth',
      token_endpoint: 'https://example.com/token',
      registration_endpoint: 'https://example.com/register',
      scopes_supported: ['read', 'write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
    };

    it('should retrieve server metadata from database', async () => {
      mockDatabase.getOAuthServerMetadata = vi
        .fn()
        .mockResolvedValue(mockMetadata);

      const result = await provider.serverMetadata();

      expect(mockDatabase.getOAuthServerMetadata).toHaveBeenCalledWith(
        testServerConfigId,
      );
      expect(result).toEqual(mockMetadata);
    });

    it('should return undefined when no metadata exists', async () => {
      mockDatabase.getOAuthServerMetadata = vi.fn().mockResolvedValue(null);

      const result = await provider.serverMetadata();

      expect(result).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.getOAuthServerMetadata = vi
        .fn()
        .mockRejectedValue(new Error('DB Error'));

      const result = await provider.serverMetadata();

      expect(result).toBeUndefined();
    });

    it('should save server metadata to database', async () => {
      await provider.saveServerMetadata(mockMetadata);

      expect(mockDatabase.saveOAuthServerMetadata).toHaveBeenCalledWith(
        testServerConfigId,
        mockMetadata,
      );
    });

    it('should throw error when saving metadata fails', async () => {
      mockDatabase.saveOAuthServerMetadata = vi
        .fn()
        .mockRejectedValue(new Error('Save failed'));

      await expect(provider.saveServerMetadata(mockMetadata)).rejects.toThrow(
        'Save failed',
      );
    });
  });

  describe('clientInformation', () => {
    const mockClientInfo: OAuthClientInformation = {
      client_id: 'test-client-id',
      client_secret: 'test-secret',
    };

    it('should retrieve client information from database', async () => {
      mockDatabase.getOAuthClientInfo = vi
        .fn()
        .mockResolvedValue(mockClientInfo);

      const result = await provider.clientInformation();

      expect(mockDatabase.getOAuthClientInfo).toHaveBeenCalledWith(
        testServerConfigId,
      );
      expect(result).toEqual(mockClientInfo);
    });

    it('should return undefined when no client info exists', async () => {
      mockDatabase.getOAuthClientInfo = vi.fn().mockResolvedValue(null);

      const result = await provider.clientInformation();

      expect(result).toBeUndefined();
    });

    it('should return undefined when client info has no client_id', async () => {
      mockDatabase.getOAuthClientInfo = vi
        .fn()
        .mockResolvedValue({ client_secret: 'secret' });

      const result = await provider.clientInformation();

      expect(result).toBeUndefined();
    });

    it('should save client information to database', async () => {
      await provider.saveClientInformation(mockClientInfo);

      expect(mockDatabase.saveOAuthClientInfo).toHaveBeenCalledWith(
        testServerConfigId,
        mockClientInfo,
      );
    });
  });

  describe('tokens', () => {
    const mockTokenData = {
      server_id: testServerConfigId,
      user_id: testUserId,
      access_token: 'access-token-123',
      refresh_token: 'refresh-token-123',
      expires_at: new Date(Date.now() + 3600000), // 1 hour from now
      scope: 'read write',
      token_type: 'Bearer',
      raw_tokens: {},
    };

    it('should retrieve tokens from database and format correctly', async () => {
      mockDatabase.getOAuthTokens = vi.fn().mockResolvedValue(mockTokenData);

      const result = await provider.tokens();

      expect(mockDatabase.getOAuthTokens).toHaveBeenCalledWith(
        testServerConfigId,
        testUserId,
      );
      expect(result).toMatchObject({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        token_type: 'Bearer',
        scope: 'read write',
      });
      expect(result?.expires_in).toBeGreaterThan(3500); // Should be close to 3600
    });

    it('should return undefined when no tokens exist', async () => {
      mockDatabase.getOAuthTokens = vi.fn().mockResolvedValue(null);

      const result = await provider.tokens();

      expect(result).toBeUndefined();
    });

    it('should handle expired tokens correctly', async () => {
      const expiredTokenData = {
        ...mockTokenData,
        expires_at: new Date(Date.now() - 1000), // 1 second ago
      };
      mockDatabase.getOAuthTokens = vi.fn().mockResolvedValue(expiredTokenData);

      const result = await provider.tokens();

      expect(result?.expires_in).toBe(0);
    });

    it('should save tokens to database', async () => {
      const tokensToSave: OAuthTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write',
      };

      await provider.saveTokens(tokensToSave);

      expect(mockDatabase.saveOAuthTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          server_id: testServerConfigId,
          user_id: testUserId,
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          scope: 'read write',
          raw_tokens: tokensToSave,
        }),
      );
    });
  });

  describe('codeVerifier', () => {
    const mockPending = {
      server_id: testServerConfigId,
      user_id: testUserId,
      state: 'test-state',
      code_verifier: 'test-verifier-123',
      auth_url: 'https://example.com/auth',
    };

    it('should save code verifier to database', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue(null);

      await provider.saveCodeVerifier('test-verifier-123');

      expect(mockDatabase.saveOAuthPending).toHaveBeenCalledWith({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'temp-state',
        code_verifier: 'test-verifier-123',
        auth_url: '',
      });
    });

    it('should preserve existing data when saving code verifier', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue(mockPending);

      await provider.saveCodeVerifier('new-verifier');

      expect(mockDatabase.saveOAuthPending).toHaveBeenCalledWith({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'test-state',
        code_verifier: 'new-verifier',
        auth_url: 'https://example.com/auth',
      });
    });

    it('should retrieve code verifier from database', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue(mockPending);

      const result = await provider.codeVerifier();

      expect(mockDatabase.getOAuthPending).toHaveBeenCalledWith(
        testServerConfigId,
        testUserId,
      );
      expect(result).toBe('test-verifier-123');
    });

    it('should throw error when no code verifier exists', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue(null);

      await expect(provider.codeVerifier()).rejects.toThrow(
        'No code verifier found',
      );
    });
  });

  describe('resource', () => {
    const testResourceUrl = new URL('https://example.com/resource');

    it('should save resource URL to database', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue(null);

      await provider.saveResource(testResourceUrl);

      expect(mockDatabase.saveOAuthPending).toHaveBeenCalledWith({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'temp-state',
        code_verifier: '',
        auth_url: 'https://example.com/resource',
      });
    });

    it('should retrieve resource URL from database', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'test-state',
        code_verifier: 'verifier',
        auth_url: 'https://example.com/resource',
      });

      const result = await provider.getResource();

      expect(result).toEqual(testResourceUrl);
    });

    it('should return undefined when no resource URL exists', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'test-state',
        code_verifier: 'verifier',
        auth_url: '',
      });

      const result = await provider.getResource();

      expect(result).toBeUndefined();
    });

    it('should handle invalid URLs gracefully', async () => {
      mockDatabase.getOAuthPending = vi.fn().mockResolvedValue({
        server_id: testServerConfigId,
        user_id: testUserId,
        state: 'test-state',
        code_verifier: 'verifier',
        auth_url: 'invalid-url',
      });

      const result = await provider.getResource();

      expect(result).toBeUndefined();
    });
  });

  describe('redirectToAuthorization', () => {
    it('should handle redirect authorization call without throwing', () => {
      const authUrl = new URL('https://example.com/auth?code=123');

      expect(() => {
        provider.redirectToAuthorization(authUrl);
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle database errors in all methods gracefully', async () => {
      const dbError = new Error('Database connection failed');

      // Mock all database methods to throw errors
      Object.keys(mockDatabase).forEach((key) => {
        if (typeof mockDatabase[key as keyof DatabaseService] === 'function') {
          vi.mocked(
            mockDatabase[key as keyof DatabaseService],
          ).mockRejectedValue(dbError);
        }
      });

      // These should not throw but return undefined
      expect(await provider.serverMetadata()).toBeUndefined();
      expect(await provider.clientInformation()).toBeUndefined();
      expect(await provider.tokens()).toBeUndefined();
      expect(await provider.getResource()).toBeUndefined();

      // These should throw errors
      await expect(
        provider.saveServerMetadata({} as OAuthMetadata),
      ).rejects.toThrow();
      await expect(
        provider.saveClientInformation({} as OAuthClientInformation),
      ).rejects.toThrow();
      await expect(provider.saveTokens({} as OAuthTokens)).rejects.toThrow();
      await expect(provider.saveCodeVerifier('test')).rejects.toThrow();
      await expect(provider.codeVerifier()).rejects.toThrow();
      await expect(
        provider.saveResource(new URL('https://example.com')),
      ).rejects.toThrow();
    });
  });
});
