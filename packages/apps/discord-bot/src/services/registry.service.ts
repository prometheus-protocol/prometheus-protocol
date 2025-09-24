import logger from '../utils/logger.js';
import {
  RegistryApiResponse,
  RegistryAuthTypesResponse,
  RegistryCategoriesResponse,
  RegistrySearchParams,
  RegistryServerObject,
  RegistryServerResponse,
} from '../types/registry.types.js';

/**
 * Service for interacting with the external MCP Registry API
 * at https://remote-mcp-servers.com
 */
export class RegistryService {
  private readonly baseUrl = 'https://remote-mcp-servers.com';
  private readonly defaultHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Prometheus-Discord-Bot/1.0',
  };

  constructor() {
    logger.info('RegistryService initialized', {
      service: 'RegistryService',
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Make an HTTP request using fetch with error handling and logging
   */
  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value.toString());
        }
      });
    }

    logger.debug(`Registry API Request: GET ${url.toString()}`, {
      service: 'RegistryService',
      params,
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.defaultHeaders,
        // 10 second timeout
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      logger.debug(
        `Registry API Response: ${response.status} ${url.pathname}`,
        {
          service: 'RegistryService',
          dataLength: Array.isArray(data?.data) ? data.data.length : 'unknown',
        },
      );

      return data;
    } catch (error: any) {
      logger.error(
        `Registry API Error for ${url.toString()}: ${error.message}`,
        error,
        {
          service: 'RegistryService',
          url: url.toString(),
        },
      );
      throw error;
    }
  }

  /**
   * Search for MCP servers using the registry API
   */
  async searchServers(
    params: RegistrySearchParams = {},
  ): Promise<RegistryApiResponse> {
    try {
      logger.info('Searching MCP servers', {
        service: 'RegistryService',
        params,
      });

      const response = await this.makeRequest<RegistryApiResponse>(
        '/api/servers',
        this.cleanParams(params),
      );

      logger.info(`Found ${response.data.length} servers`, {
        service: 'RegistryService',
        totalItems: response.pagination.totalItems,
        currentPage: response.pagination.currentPage,
      });

      return response;
    } catch (error: any) {
      logger.error('Error searching servers:', error);

      // Return empty result on error to prevent Discord bot from crashing
      return {
        data: [],
        pagination: {
          currentPage: params.page || 1,
          itemsPerPage: params.limit || 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }
  }

  /**
   * Get all available categories from the registry
   */
  async getCategories(): Promise<string[]> {
    try {
      logger.debug('Fetching available categories', {
        service: 'RegistryService',
      });

      const response = await this.makeRequest<RegistryCategoriesResponse>(
        '/api/servers/categories',
      );

      logger.debug(`Retrieved ${response.categories.length} categories`, {
        service: 'RegistryService',
        categories: response.categories,
      });

      return response.categories;
    } catch (error: any) {
      logger.error('Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Get all available authentication types from the registry
   */
  async getAuthTypes(): Promise<string[]> {
    try {
      logger.debug('Fetching available auth types', {
        service: 'RegistryService',
      });

      const response = await this.makeRequest<RegistryAuthTypesResponse>(
        '/api/servers/auth-types',
      );

      logger.debug(`Retrieved ${response.authTypes.length} auth types`, {
        service: 'RegistryService',
        authTypes: response.authTypes,
      });

      return response.authTypes;
    } catch (error: any) {
      logger.error('Error fetching auth types:', error);
      return [];
    }
  }

  /**
   * Get a specific server by ID using the direct endpoint
   */
  async getServerById(serverId: string): Promise<RegistryServerObject | null> {
    try {
      logger.debug(`Fetching server by ID: ${serverId}`, {
        service: 'RegistryService',
      });

      // Use the direct server endpoint: /api/servers/{id}
      const response = await this.makeRequest<RegistryServerResponse>(
        `/api/servers/${serverId}`,
      );

      const server = response.data;

      logger.debug(`Server response:`, {
        service: 'RegistryService',
        serverId,
        serverData: JSON.stringify(server, null, 2),
      });

      if (server && server.name) {
        logger.debug(`Found server: ${server.name}`, {
          service: 'RegistryService',
          serverId,
          serverName: server.name,
          serverUrl: server.mcp_url,
        });
      }

      return server;
    } catch (error: any) {
      logger.error(`Error fetching server by ID ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Check if the registry service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.debug('Performing registry health check', {
        service: 'RegistryService',
      });

      // Make a simple request to check if the service is responding
      await this.makeRequest<RegistryApiResponse>('/api/servers', { limit: 1 });

      logger.info('Registry health check passed', {
        service: 'RegistryService',
      });

      return true;
    } catch (error: any) {
      logger.error('Registry health check failed:', error);
      return false;
    }
  }

  /**
   * Clean up search parameters, removing undefined values
   */
  private cleanParams(params: RegistrySearchParams): Record<string, any> {
    const cleaned: Record<string, any> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = value;
      }
    });

    return cleaned;
  }

  /**
   * Convert a RegistryServerObject to the format expected by MCPService
   */
  static convertToMCPServerResult(server: RegistryServerObject): {
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
  } {
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      url: server.mcp_url, // Use the correct field name
      category: server.category,
      author: server.maintainer_name || server.author,
      isOAuthEnabled:
        server.authentication_type === 'OAuth2' || server.authType === 'OAuth',
      tags: server.tags || [],
      auth_type:
        server.authentication_type?.toLowerCase() ||
        server.authType?.toLowerCase() ||
        'none',
      hosted_on: server.hostedOn || 'external',
    };
  }
}
