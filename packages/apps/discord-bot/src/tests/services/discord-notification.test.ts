import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from 'discord.js';
import { DiscordNotificationService } from '../../services/discord-notification.service.js';

describe('DiscordNotificationService', () => {
  let service: DiscordNotificationService;
  let mockClient: any;
  let mockUser: any;

  beforeEach(() => {
    // Mock Discord user
    mockUser = {
      send: vi.fn().mockResolvedValue({ id: 'message-123' }),
    };

    // Mock Discord client
    mockClient = {
      users: {
        fetch: vi.fn().mockResolvedValue(mockUser),
      },
    } as any;

    service = new DiscordNotificationService(mockClient);
  });

  describe('sendAuthRequiredMessage', () => {
    it('should send auth required message with correct format', async () => {
      const result = await service.sendAuthRequiredMessage(
        'user-123',
        'test-server',
        'https://auth.example.com/oauth?code=abc123',
      );

      expect(mockClient.users.fetch).toHaveBeenCalledWith('user-123');
      expect(mockUser.send).toHaveBeenCalledWith(
        expect.stringContaining('🔐 **Authentication Required**'),
      );
      expect(result).toBe(undefined); // void method
    });

    it('should handle errors when sending message fails', async () => {
      mockUser.send.mockRejectedValue(new Error('Failed to send'));

      // Should not throw, just log error
      await expect(
        service.sendAuthRequiredMessage(
          'user-123',
          'test-server',
          'https://auth.example.com/oauth?code=abc123',
        ),
      ).resolves.toBeUndefined();
    });

    it('should handle errors when user fetch fails', async () => {
      mockClient.users.fetch.mockRejectedValue(new Error('User not found'));

      // Should not throw, just log error
      await expect(
        service.sendAuthRequiredMessage(
          'user-123',
          'test-server',
          'https://auth.example.com/oauth?code=abc123',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should log errors but not throw exceptions', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockClient.users.fetch.mockRejectedValue(new Error('Network error'));

      // Should not throw, just log error
      await expect(
        service.sendAuthRequiredMessage(
          'user-123',
          'test-server',
          'https://auth.example.com/oauth',
        ),
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });
});
