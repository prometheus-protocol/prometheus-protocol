import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPEventHandlerService } from '../../services/mcp-event-handler.service.js';
import { DiscordNotificationService } from '../../services/discord-notification.service.js';
import { SupabaseService } from '../../services/database.js';

describe('MCP Discord Integration', () => {
  let eventHandler: MCPEventHandlerService;
  let mockDiscordNotification: any;
  let mockDatabaseService: any;

  beforeEach(() => {
    // Mock database service
    mockDatabaseService = {
      updateMCPConnection: vi.fn().mockResolvedValue(undefined),
      getMCPConnection: vi.fn().mockResolvedValue(null),
      getUserMCPConnection: vi.fn().mockResolvedValue({
        server_name: 'Test Server',
        user_id: 'user-123',
        mcp_server_config_id: 'server-456',
        mcp_server_url: 'https://test-server.com/mcp',
        status: 'DISCONNECTED',
      }),
      saveMCPConnection: vi.fn().mockResolvedValue(undefined),
      saveUserMCPConnection: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock Discord notification service
    mockDiscordNotification = {
      sendAuthRequiredMessage: vi.fn().mockResolvedValue(undefined),
      sendConnectionSuccessMessage: vi.fn().mockResolvedValue(undefined),
      sendConnectionErrorMessage: vi.fn().mockResolvedValue(undefined),
    } as any;

    eventHandler = new MCPEventHandlerService(
      mockDatabaseService,
      mockDiscordNotification,
    );
  });

  describe('handleAuthRequired', () => {
    it('should send Discord notification when auth is required', async () => {
      const authRequiredData = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://test-server.com/mcp',
        serverName: 'Test Server',
        generatedAt: new Date().toISOString(),
        oauthAuthorizationUrl: 'https://auth.example.com/oauth?code=abc123',
      };

      // Call the auth required handler directly
      await eventHandler.handleAuthRequired(authRequiredData);

      // Verify that Discord notification was sent
      expect(
        mockDiscordNotification.sendAuthRequiredMessage,
      ).toHaveBeenCalledWith(
        'user-123',
        'Test Server',
        'https://auth.example.com/oauth?code=abc123',
      );
    });

    it('should handle Discord notification errors by logging and re-throwing', async () => {
      mockDiscordNotification.sendAuthRequiredMessage.mockRejectedValue(
        new Error('Discord API error'),
      );

      const authRequiredData = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://test-server.com/mcp',
        serverName: 'Test Server',
        generatedAt: new Date().toISOString(),
        oauthAuthorizationUrl: 'https://auth.example.com/oauth?code=abc123',
      };

      // Should throw when Discord notification fails (current behavior)
      await expect(
        eventHandler.handleAuthRequired(authRequiredData),
      ).rejects.toThrow('Discord API error');

      expect(
        mockDiscordNotification.sendAuthRequiredMessage,
      ).toHaveBeenCalled();
    });
  });

  describe('without Discord notification service', () => {
    it('should work normally when Discord service is not provided', async () => {
      const handlerWithoutDiscord = new MCPEventHandlerService(
        mockDatabaseService,
      );

      const authRequiredData = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://test-server.com/mcp',
        serverName: 'Test Server',
        generatedAt: new Date().toISOString(),
        oauthAuthorizationUrl: 'https://auth.example.com/oauth?code=abc123',
      };

      // Should not throw even without Discord service
      await expect(
        handlerWithoutDiscord.handleAuthRequired(authRequiredData),
      ).resolves.toBeUndefined();
    });
  });
});
