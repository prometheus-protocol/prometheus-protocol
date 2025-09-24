import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { auth } from '../../mcp/oauth.js';
import { ConnectionManagerOAuthProvider } from '../../mcp/oauth-provider.js';
import * as authSdk from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthMetadata,
  OAuthProtectedResourceMetadata,
  OAuthClientInformation,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

// Mock all the SDK functions
vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  discoverOAuthProtectedResourceMetadata: vi.fn(),
  extractResourceMetadataUrl: vi.fn(),
  selectResourceURL: vi.fn(),
  registerClient: vi.fn(),
  exchangeAuthorization: vi.fn(),
  refreshAuthorization: vi.fn(),
  startAuthorization: vi.fn(),
  discoverAuthorizationServerMetadata: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
};
global.console = mockConsole as any;

// Create a mock OAuth provider
const createMockProvider = (
  overrides: Partial<ConnectionManagerOAuthProvider> = {},
): ConnectionManagerOAuthProvider => {
  const defaultProvider = {
    serverMetadata: vi.fn(),
    saveServerMetadata: vi.fn(),
    clientInformation: vi.fn(),
    saveClientInformation: vi.fn(),
    tokens: vi.fn(),
    saveTokens: vi.fn(),
    codeVerifier: vi.fn(),
    saveCodeVerifier: vi.fn(),
    getResource: vi.fn(),
    saveResource: vi.fn(),
    saveOAuthPending: vi.fn(),
    redirectToAuthorization: vi.fn(),
    redirectUrl: 'https://example.com/callback',
    clientMetadata: {
      client_name: 'Test Client',
      redirect_uris: ['https://example.com/callback'],
    },
  };

  return { ...defaultProvider, ...overrides } as ConnectionManagerOAuthProvider;
};

describe('auth function', () => {
  let mockProvider: ConnectionManagerOAuthProvider;

  // Mock data
  const mockResourceMetadata: OAuthProtectedResourceMetadata = {
    resource: 'https://api.example.com',
    authorization_servers: ['https://auth.example.com'],
    scopes_supported: ['read', 'write'],
    bearer_methods_supported: ['header'],
  };

  const mockServerMetadata: OAuthMetadata = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    registration_endpoint: 'https://auth.example.com/register',
    scopes_supported: ['read', 'write'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
  };

  const mockClientInfo: OAuthClientInformation = {
    client_id: 'test-client-123',
    client_secret: 'test-secret',
  };

  const mockTokens: OAuthTokens = {
    access_token: 'access-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh-token-123',
    scope: 'read write',
  };

  beforeEach(() => {
    mockProvider = createMockProvider();

    // Reset all mocks
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset SDK mocks
    Object.values(authSdk).forEach((fn) => {
      if (typeof fn === 'function') {
        vi.mocked(fn).mockReset();
      }
    });
  });

  describe('Open server scenarios (no OAuth required)', () => {
    it('should return AUTHORIZED for servers with no resource metadata', async () => {
      // Mock fetch to return 200 (no auth required)
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

      // Mock discovery to return no metadata
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(undefined as any);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/.well-known/oauth-protected-resource',
        { method: 'GET' },
      );
    });

    it('should return AUTHORIZED for servers with empty authorization_servers', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

      const emptyResourceMetadata = {
        ...mockResourceMetadata,
        authorization_servers: [],
      };

      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(emptyResourceMetadata);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
    });

    it('should handle network errors during well-known endpoint fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(undefined as any);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
    });
  });

  describe('Resource metadata discovery', () => {
    it('should discover metadata via 401 response header', async () => {
      const mockResponse = new Response('', { status: 401 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const headerMetadataUrl = new URL('https://example.com/metadata');
      vi.mocked(authSdk.extractResourceMetadataUrl).mockReturnValue(
        headerMetadataUrl,
      );
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);

      // Mock other required functions for complete flow
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      // Use server metadata WITHOUT DCR support for PENDING_CLIENT_REGISTRATION
      const noDcrServerMetadata = {
        ...mockServerMetadata,
        registration_endpoint: undefined, // Remove DCR support
      };
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(noDcrServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('PENDING_CLIENT_REGISTRATION');
      expect(authSdk.extractResourceMetadataUrl).toHaveBeenCalledWith(
        mockResponse,
      );
      expect(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).toHaveBeenCalledWith('https://api.example.com', {
        resourceMetadataUrl: headerMetadataUrl,
      });
    });

    it('should fall back to normal discovery when 401 header method fails', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));

      // First, header method should find a URL but fail to get metadata
      const headerMetadataUrl = new URL('https://example.com/bad-metadata');
      vi.mocked(authSdk.extractResourceMetadataUrl).mockReturnValue(
        headerMetadataUrl,
      );
      vi.mocked(authSdk.discoverOAuthProtectedResourceMetadata)
        .mockResolvedValueOnce(undefined as any) // First call (header method fails)
        .mockResolvedValueOnce(mockResourceMetadata); // Second call (normal discovery succeeds)

      // Mock other required functions
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      // Use server metadata WITHOUT DCR support for PENDING_CLIENT_REGISTRATION
      const noDcrServerMetadata = {
        ...mockServerMetadata,
        registration_endpoint: undefined, // Remove DCR support
      };
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(noDcrServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
        resourceMetadataUrl: new URL('https://example.com/metadata'),
      });

      expect(result).toBe('PENDING_CLIENT_REGISTRATION');
      expect(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('Server metadata management', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
    });

    it('should use cached server metadata when available', async () => {
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(mockTokens);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockProvider.serverMetadata).toHaveBeenCalled();
      expect(
        authSdk.discoverAuthorizationServerMetadata,
      ).not.toHaveBeenCalled();
    });

    it('should discover and cache server metadata when not cached', async () => {
      mockProvider.serverMetadata = vi.fn().mockResolvedValue(undefined);
      mockProvider.saveServerMetadata = vi.fn();
      mockProvider.tokens = vi.fn().mockResolvedValue(mockTokens);

      vi.mocked(authSdk.discoverAuthorizationServerMetadata).mockResolvedValue(
        mockServerMetadata,
      );

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
      expect(authSdk.discoverAuthorizationServerMetadata).toHaveBeenCalledWith(
        mockResourceMetadata.authorization_servers![0],
      );
      expect(mockProvider.saveServerMetadata).toHaveBeenCalledWith(
        mockServerMetadata,
      );
    });

    it('should throw error when metadata discovery fails', async () => {
      mockProvider.serverMetadata = vi.fn().mockResolvedValue(undefined);

      vi.mocked(authSdk.discoverAuthorizationServerMetadata).mockRejectedValue(
        new Error('Discovery failed'),
      );

      await expect(
        auth(mockProvider, {
          serverUrl: 'https://api.example.com',
        }),
      ).rejects.toThrow('Could not discover or load OAuth server metadata.');
    });
  });

  describe('Token management', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
    });

    it('should return AUTHORIZED when valid tokens exist', async () => {
      mockProvider.tokens = vi.fn().mockResolvedValue(mockTokens);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockProvider.tokens).toHaveBeenCalled();
    });

    it('should attempt token refresh when refresh token exists but no valid access token', async () => {
      const expiredTokens = { ...mockTokens, access_token: '' };
      mockProvider.tokens = vi.fn().mockResolvedValue(expiredTokens);
      mockProvider.clientInformation = vi
        .fn()
        .mockResolvedValue(mockClientInfo);
      mockProvider.saveTokens = vi.fn();

      const newTokens = { ...mockTokens, access_token: 'new-access-token' };
      vi.mocked(authSdk.refreshAuthorization).mockResolvedValue(newTokens);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('AUTHORIZED');
      expect(authSdk.refreshAuthorization).toHaveBeenCalledWith(
        mockResourceMetadata.authorization_servers![0],
        expect.objectContaining({
          metadata: mockServerMetadata,
          clientInformation: mockClientInfo,
          refreshToken: expiredTokens.refresh_token,
        }),
      );
      expect(mockProvider.saveTokens).toHaveBeenCalledWith(newTokens);
    });
  });

  describe('Client registration', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
    });

    it('should return PENDING_CLIENT_REGISTRATION for non-DCR servers', async () => {
      const noDcrMetadata = {
        ...mockServerMetadata,
        registration_endpoint: undefined,
      };
      mockProvider.serverMetadata = vi.fn().mockResolvedValue(noDcrMetadata);
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('PENDING_CLIENT_REGISTRATION');
    });

    it('should register new client when DCR is supported and no client info exists', async () => {
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);
      mockProvider.saveClientInformation = vi.fn();

      const fullClientInfo = {
        ...mockClientInfo,
        redirect_uris: ['https://example.com/callback'],
      };
      vi.mocked(authSdk.registerClient).mockResolvedValue(
        fullClientInfo as any,
      );
      vi.mocked(authSdk.startAuthorization).mockResolvedValue({
        authorizationUrl: new URL(
          'https://auth.example.com/authorize?code=123',
        ),
        codeVerifier: 'test-verifier',
      });

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('REDIRECT');
      expect(authSdk.registerClient).toHaveBeenCalledWith(
        mockResourceMetadata.authorization_servers![0],
        expect.objectContaining({
          metadata: mockServerMetadata,
          clientMetadata: mockProvider.clientMetadata,
        }),
      );
      expect(mockProvider.saveClientInformation).toHaveBeenCalledWith(
        fullClientInfo,
      );
    });

    it('should throw error when client registration fails', async () => {
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);
      mockProvider.saveClientInformation = vi.fn();

      vi.mocked(authSdk.registerClient).mockRejectedValue(
        new Error('Registration failed'),
      );

      await expect(
        auth(mockProvider, {
          serverUrl: 'https://api.example.com',
        }),
      ).rejects.toThrow('Could not register OAuth client.');
    });

    it('should throw error when trying to exchange code without existing client info', async () => {
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);

      await expect(
        auth(mockProvider, {
          serverUrl: 'https://api.example.com',
          authorizationCode: 'test-code',
        }),
      ).rejects.toThrow(
        'Existing OAuth client information is required when exchanging an authorization code',
      );
    });
  });

  describe('Authorization code exchange', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
      mockProvider.clientInformation = vi
        .fn()
        .mockResolvedValue(mockClientInfo);
    });

    it('should exchange authorization code for tokens', async () => {
      mockProvider.getResource = vi
        .fn()
        .mockResolvedValue(new URL('https://api.example.com'));
      mockProvider.codeVerifier = vi.fn().mockResolvedValue('test-verifier');
      mockProvider.saveTokens = vi.fn();

      vi.mocked(authSdk.exchangeAuthorization).mockResolvedValue(mockTokens);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
        authorizationCode: 'auth-code-123',
      });

      expect(result).toBe('AUTHORIZED');
      expect(authSdk.exchangeAuthorization).toHaveBeenCalledWith(
        mockResourceMetadata.authorization_servers![0],
        expect.objectContaining({
          metadata: mockServerMetadata,
          clientInformation: mockClientInfo,
          authorizationCode: 'auth-code-123',
          codeVerifier: 'test-verifier',
          redirectUri: mockProvider.redirectUrl,
        }),
      );
      expect(mockProvider.saveTokens).toHaveBeenCalledWith(mockTokens);
    });
  });

  describe('Authorization flow initiation', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
      mockProvider.clientInformation = vi
        .fn()
        .mockResolvedValue(mockClientInfo);
    });

    it('should start new authorization flow when no tokens exist', async () => {
      mockProvider.saveCodeVerifier = vi.fn();
      mockProvider.saveResource = vi.fn();
      mockProvider.redirectToAuthorization = vi.fn();

      const authorizationUrl = new URL(
        'https://auth.example.com/authorize?code=123',
      );
      const codeVerifier = 'generated-verifier';

      vi.mocked(authSdk.startAuthorization).mockResolvedValue({
        authorizationUrl,
        codeVerifier,
      });

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
        scope: 'read write',
      });

      expect(result).toBe('REDIRECT');
      expect(authSdk.startAuthorization).toHaveBeenCalledWith(
        mockResourceMetadata.authorization_servers![0],
        expect.objectContaining({
          metadata: mockServerMetadata,
          clientInformation: mockClientInfo,
          scope: 'read write',
          redirectUrl: mockProvider.redirectUrl,
        }),
      );
      expect(mockProvider.saveOAuthPending).toHaveBeenCalledWith(
        expect.objectContaining({
          codeVerifier,
        }),
      );
      expect(mockProvider.redirectToAuthorization).toHaveBeenCalledWith(
        authorizationUrl,
      );
    });

    it('should use default scope from server metadata when no scope provided', async () => {
      mockProvider.saveCodeVerifier = vi.fn();
      mockProvider.redirectToAuthorization = vi.fn();

      vi.mocked(authSdk.startAuthorization).mockResolvedValue({
        authorizationUrl: new URL('https://auth.example.com/authorize'),
        codeVerifier: 'test-verifier',
      });

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('REDIRECT');
      expect(authSdk.startAuthorization).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          scope: 'read write', // From mockServerMetadata.scopes_supported
        }),
      );
    });
  });

  describe('URL handling', () => {
    it('should handle string URLs correctly', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(undefined as any);

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com/',
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/.well-known/oauth-protected-resource',
        { method: 'GET' },
      );
    });

    it('should handle URL objects correctly', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(undefined as any);

      const result = await auth(mockProvider, {
        serverUrl: new URL('https://api.example.com/'),
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/.well-known/oauth-protected-resource',
        { method: 'GET' },
      );
    });

    it('should use provided resourceMetadataUrl when available', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(undefined as any);

      const customMetadataUrl = new URL('https://custom.example.com/metadata');

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
        resourceMetadataUrl: customMetadataUrl,
      });

      expect(result).toBe('AUTHORIZED');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.example.com/metadata',
        { method: 'GET' },
      );
    });
  });

  describe('Error scenarios', () => {
    it('should handle missing saveClientInformation method', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );

      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(null);
      mockProvider.clientInformation = vi.fn().mockResolvedValue(null);
      mockProvider.saveClientInformation = undefined as any;

      await expect(
        auth(mockProvider, {
          serverUrl: 'https://api.example.com',
        }),
      ).rejects.toThrow(
        'OAuth client information must be saveable for dynamic registration',
      );
    });

    it('should handle token refresh failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }));
      vi.mocked(
        authSdk.discoverOAuthProtectedResourceMetadata,
      ).mockResolvedValue(mockResourceMetadata);
      vi.mocked(authSdk.selectResourceURL).mockResolvedValue(
        new URL('https://api.example.com'),
      );

      const expiredTokens = { ...mockTokens, access_token: '' };
      mockProvider.serverMetadata = vi
        .fn()
        .mockResolvedValue(mockServerMetadata);
      mockProvider.tokens = vi.fn().mockResolvedValue(expiredTokens);
      mockProvider.clientInformation = vi
        .fn()
        .mockResolvedValue(mockClientInfo);
      mockProvider.saveCodeVerifier = vi.fn();
      mockProvider.redirectToAuthorization = vi.fn();

      vi.mocked(authSdk.refreshAuthorization).mockRejectedValue(
        new Error('Refresh failed'),
      );
      vi.mocked(authSdk.startAuthorization).mockResolvedValue({
        authorizationUrl: new URL('https://auth.example.com/authorize'),
        codeVerifier: 'new-verifier',
      });

      const result = await auth(mockProvider, {
        serverUrl: 'https://api.example.com',
      });

      expect(result).toBe('REDIRECT');
      expect(authSdk.startAuthorization).toHaveBeenCalled();
    });
  });
});
