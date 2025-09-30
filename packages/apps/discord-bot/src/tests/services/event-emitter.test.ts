import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPEventService } from '../../services/event-emitter.service.js';

describe('MCPEventService', () => {
  let eventService: MCPEventService;
  let mockListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventService = new MCPEventService();
    mockListener = vi.fn();
  });

  afterEach(() => {
    eventService.removeAllListeners();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize as EventEmitter with proper max listeners', () => {
      expect(eventService).toBeInstanceOf(MCPEventService);
      expect(eventService.getMaxListeners()).toBe(50);
    });
  });

  describe('publishConnectionStatusUpdate', () => {
    it('should emit connection-status-update event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        status: 'connected',
      };

      eventService.on('mcp:connection-status-update', mockListener);
      await eventService.publishConnectionStatusUpdate(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        status: 'disconnected',
      };

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventService.on('mcp:connection-status-update', listener1);
      eventService.on('mcp:connection-status-update', listener2);
      await eventService.publishConnectionStatusUpdate(payload);

      expect(listener1).toHaveBeenCalledWith(payload);
      expect(listener2).toHaveBeenCalledWith(payload);
    });
  });

  describe('publishAuthRequired', () => {
    it('should emit auth-required event with correct payload', async () => {
      const payload = {
        generatedAt: new Date().toISOString(),
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        mcpServerUrl: 'https://example.com/mcp',
        oauthAuthorizationUrl: 'https://auth.example.com/authorize',
      };

      eventService.on('mcp:auth-required', mockListener);
      await eventService.publishAuthRequired(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishResourceFetchError', () => {
    it('should emit resource-fetch-error event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        error: 'Failed to fetch resource',
        resourceUri: 'test://resource',
      };

      eventService.on('mcp:resource-fetch-error', mockListener);
      await eventService.publishResourceFetchError(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishResourcesFetched', () => {
    it('should emit resources-fetched event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        resources: [
          { uri: 'test://resource1', name: 'Resource 1' },
          { uri: 'test://resource2', name: 'Resource 2' },
        ],
        generatedAt: new Date().toISOString(),
      };

      eventService.on('mcp:resources-fetched', mockListener);
      await eventService.publishResourcesFetched(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishResourceDataFetched', () => {
    it('should emit resource-data-fetched event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        resourceUri: 'test://resource',
        data: { content: 'test data' },
        timestamp: new Date().toISOString(),
      };

      eventService.on('mcp:resource-data-fetched', mockListener);
      await eventService.publishResourceDataFetched(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishToolsFetched', () => {
    it('should emit tools-fetched event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        tools: [
          { name: 'test-tool', description: 'A test tool' },
          { name: 'another-tool', description: 'Another test tool' },
        ],
        generatedAt: new Date().toISOString(),
      };

      eventService.on('mcp:tools-fetched', mockListener);
      await eventService.publishToolsFetched(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishToolInvocationProgress', () => {
    it('should emit tool-invocation-progress event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        invocationId: 'invocation-123',
        progress: 50,
        message: 'Processing...',
        timestamp: new Date().toISOString(),
      };

      eventService.on('mcp:tool-invocation-progress', mockListener);
      await eventService.publishToolInvocationProgress(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishToolResult', () => {
    it('should emit tool-result event with success result', async () => {
      const payload = {
        userId: 'user-123',
        invocationId: 'invocation-123',
        toolName: 'test-tool',
        status: 'success',
        result: { output: 'Tool executed successfully' },
      };

      eventService.on('mcp:tool-result', mockListener);
      await eventService.publishToolResult(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should emit tool-result event with error result', async () => {
      const payload = {
        userId: 'user-123',
        invocationId: 'invocation-123',
        toolName: 'test-tool',
        status: 'error',
        error: new Error('Tool execution failed'),
      };

      eventService.on('mcp:tool-result', mockListener);
      await eventService.publishToolResult(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
    });
  });

  describe('publishServerCapabilities', () => {
    it('should emit server-capabilities event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        capabilities: { tools: { listChanged: true } },
        name: 'Test Server',
        version: '1.0.0',
      };

      eventService.on('mcp:server-capabilities', mockListener);
      await eventService.publishServerCapabilities(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishNotificationReceived', () => {
    it('should emit notification-received event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        notification: {
          method: 'resource_updated',
          params: { resourceUri: 'test://resource' },
        },
      };

      eventService.on('mcp:notification-received', mockListener);
      await eventService.publishNotificationReceived(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishElicitationRequestReceived', () => {
    it('should emit elicitation-request-received event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        request: {
          method: 'prompt_elicitation',
          params: { prompt: 'What would you like to do?' },
        },
      };

      eventService.on('mcp:elicitation-request-received', mockListener);
      await eventService.publishElicitationRequestReceived(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishSamplingRequestReceived', () => {
    it('should emit sampling-request-received event with correct payload', async () => {
      const payload = {
        userId: 'user-123',
        mcpServerConfigId: 'server-456',
        request: {
          method: 'completion_sample',
          params: { prompt: 'Complete this text...', max_tokens: 100 },
        },
      };

      eventService.on('mcp:sampling-request-received', mockListener);
      await eventService.publishSamplingRequestReceived(payload);

      expect(mockListener).toHaveBeenCalledWith(payload);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('typed helper methods', () => {
    it('should provide typed listeners for connection status updates', () => {
      const handler = vi.fn();
      eventService.onConnectionStatusUpdate(handler);

      const payload = { status: 'connected' };
      eventService.emit('mcp:connection-status-update', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should provide typed listeners for resources fetched', () => {
      const handler = vi.fn();
      eventService.onResourcesFetched(handler);

      const payload = { resources: [] };
      eventService.emit('mcp:resources-fetched', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should provide typed listeners for tools fetched', () => {
      const handler = vi.fn();
      eventService.onToolsFetched(handler);

      const payload = { tools: [] };
      eventService.emit('mcp:tools-fetched', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should provide typed listeners for tool results', () => {
      const handler = vi.fn();
      eventService.onToolResult(handler);

      const payload = { result: 'success' };
      eventService.emit('mcp:tool-result', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('error handling', () => {
    it('should propagate listener errors as expected', async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      eventService.on('mcp:connection-status-update', errorListener);

      const payload = { status: 'connected' };

      // EventEmitter will throw when a listener throws
      await expect(
        eventService.publishConnectionStatusUpdate(payload),
      ).rejects.toThrow('Listener error');

      expect(errorListener).toHaveBeenCalled();
    });

    it('should handle errors thrown by listeners according to EventEmitter behavior', () => {
      const throwingListener = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      eventService.on('mcp:connection-status-update', throwingListener);

      // EventEmitter will throw the error if no error listener is present
      expect(() => {
        eventService.emit('mcp:connection-status-update', {});
      }).toThrow('Test error');

      expect(throwingListener).toHaveBeenCalled();
    });
  });

  describe('memory management', () => {
    it('should properly remove listeners', () => {
      eventService.on('mcp:connection-status-update', mockListener);
      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        1,
      );

      eventService.off('mcp:connection-status-update', mockListener);
      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        0,
      );
    });

    it('should clear all listeners when requested', () => {
      eventService.on('mcp:connection-status-update', mockListener);
      eventService.on('mcp:tools-fetched', mockListener);
      eventService.on('mcp:resources-fetched', mockListener);

      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        1,
      );
      expect(eventService.listenerCount('mcp:tools-fetched')).toBe(1);
      expect(eventService.listenerCount('mcp:resources-fetched')).toBe(1);

      eventService.removeAllListeners();

      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        0,
      );
      expect(eventService.listenerCount('mcp:tools-fetched')).toBe(0);
      expect(eventService.listenerCount('mcp:resources-fetched')).toBe(0);
    });

    it('should support removing listeners for specific events', () => {
      eventService.on('mcp:connection-status-update', mockListener);
      eventService.on('mcp:tools-fetched', mockListener);

      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        1,
      );
      expect(eventService.listenerCount('mcp:tools-fetched')).toBe(1);

      eventService.removeAllListeners('mcp:connection-status-update');

      expect(eventService.listenerCount('mcp:connection-status-update')).toBe(
        0,
      );
      expect(eventService.listenerCount('mcp:tools-fetched')).toBe(1);
    });
  });
});
