import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

// Define event types for better type safety
export interface MCPEvents {
  'mcp:auth-required': (data: any) => void;
  'mcp:connection-status-update': (data: any) => void;
  'mcp:resource-fetch-error': (data: any) => void;
  'mcp:resources-fetched': (data: any) => void;
  'mcp:tools-fetched': (data: any) => void;
  'mcp:notification-received': (data: any) => void;
  'mcp:server-capabilities': (data: any) => void;
  'mcp:elicitation-request-received': (data: any) => void;
  'mcp:sampling-request-received': (data: any) => void;
  'mcp:resource-data-fetched': (data: any) => void;
  'mcp:tool-invocation-progress': (data: any) => void;
  'mcp:tool-result': (data: any) => void;
}

class MCPEventService extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners if needed for your use case
    this.setMaxListeners(50);
  }

  // Authentication events
  async publishAuthRequired(data: any): Promise<void> {
    logger.debug('Publishing auth required:', data);
    this.emit('mcp:auth-required', data);
  }

  // Connection events
  async publishConnectionStatusUpdate(status: any): Promise<void> {
    logger.debug('Publishing connection status update:', status);
    this.emit('mcp:connection-status-update', status);
  }

  // Resource events
  async publishResourceFetchError(error: any): Promise<void> {
    logger.debug('Publishing resource fetch error:', error);
    this.emit('mcp:resource-fetch-error', error);
  }

  async publishResourcesFetched(data: any): Promise<void> {
    logger.debug('Publishing resources fetched:', data);
    this.emit('mcp:resources-fetched', data);
  }

  async publishResourceDataFetched(data: any): Promise<void> {
    logger.debug('Publishing resource data fetched:', data);
    this.emit('mcp:resource-data-fetched', data);
  }

  // Tool events
  async publishToolsFetched(data: any): Promise<void> {
    logger.debug('Publishing tools fetched:', data);
    this.emit('mcp:tools-fetched', data);
  }

  async publishToolInvocationProgress(data: any): Promise<void> {
    logger.debug('Publishing tool invocation progress:', data);
    this.emit('mcp:tool-invocation-progress', data);
  }

  async publishToolResult(data: any): Promise<void> {
    logger.debug('Publishing tool result:', data);
    this.emit('mcp:tool-result', data);
  }

  // Server events
  async publishServerCapabilities(data: any): Promise<void> {
    logger.debug('Publishing server capabilities:', data);
    this.emit('mcp:server-capabilities', data);
  }

  async publishNotificationReceived(data: any): Promise<void> {
    logger.debug('Publishing notification received:', data);
    this.emit('mcp:notification-received', data);
  }

  // Elicitation and sampling events
  async publishElicitationRequestReceived(data: any): Promise<void> {
    logger.debug('Publishing elicitation request received:', data);
    this.emit('mcp:elicitation-request-received', data);
  }

  async publishSamplingRequestReceived(data: any): Promise<void> {
    logger.debug('Publishing sampling request received:', data);
    this.emit('mcp:sampling-request-received', data);
  }

  // Helper method to add typed listeners
  onConnectionStatusUpdate(listener: (data: any) => void): this {
    return this.on('mcp:connection-status-update', listener);
  }

  onResourcesFetched(listener: (data: any) => void): this {
    return this.on('mcp:resources-fetched', listener);
  }

  onToolsFetched(listener: (data: any) => void): this {
    return this.on('mcp:tools-fetched', listener);
  }

  onToolResult(listener: (data: any) => void): this {
    return this.on('mcp:tool-result', listener);
  }

  // Add more typed listeners as needed...
}

// Export as singleton
export const mcpEventService = new MCPEventService();
export { MCPEventService };
