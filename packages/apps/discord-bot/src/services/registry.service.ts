import logger from '../utils/logger.js';

// ============================================================================
// UPDATED, ROBUST TYPES
// ============================================================================

/**
 * The minimal set of properties our bot needs. This remains unchanged as it's
 * our clean, internal representation.
 */
export type MinimalMCPServer = {
  id: string; // The server's unique UUID from our registry
  name: string; // The full reverse-DNS name (e.g., "io.github.user/repo")
  description: string;
  url: string; // The primary connection URL from the 'remotes' array
};

/**
 * CHANGED: Represents the raw server object from OUR registry's API.
 * The top-level 'id' is now the guaranteed unique identifier.
 */
type RegistryServerObject = {
  id: string; // This is now the required, canonical UUID.
  name: string;
  description: string;
  remotes?: { url: string }[];
  // The _meta block is now completely optional and not used for core logic.
  _meta?: Record<string, any>;
};

/** The raw list response from OUR registry's API. */
type RegistryApiResponse = {
  servers: RegistryServerObject[];
  metadata: {
    next_cursor: string | null;
  };
};

/** Search parameters for our registry. */
type SearchParams = {
  limit?: number;
  cursor?: string;
  search?: string;
};

// ============================================================================
// REFACTORED REGISTRY SERVICE
// ============================================================================

export class RegistryService {
  private readonly baseUrl: string;
  private readonly defaultHeaders = {
    'User-Agent': 'Prometheus-Discord-Bot/1.0',
  };

  constructor(registryUrl: string = 'https://remote-mcp-servers.com') {
    this.baseUrl = registryUrl;
    logger.info(
      `RegistryService initialized for custom registry: ${this.baseUrl}`,
      { service: 'RegistryService' },
    );
  }

  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value.toString());
      });
    }

    logger.debug(`Registry API Request: GET ${url.toString()}`, {
      service: 'RegistryService',
    });
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.defaultHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
      );
    }
    return response.json();
  }

  /**
   * Search for MCP servers.
   */
  async searchServers(params: SearchParams = {}): Promise<{
    servers: MinimalMCPServer[];
    nextCursor: string | null;
  }> {
    try {
      // Our API doesn't use the 'version' parameter, so it's removed.
      const response = await this.makeRequest<RegistryApiResponse>(
        'api/v0/servers',
        params,
      );

      logger.debug(`Raw API response: ${response.servers.length} servers`, {
        service: 'RegistryService',
        // Updated debug log to show the new source of truth for the ID
        firstServer: response.servers[0]
          ? {
              name: response.servers[0].name,
              id: response.servers[0].id, // Log the top-level ID
              hasRemotes: !!response.servers[0].remotes,
            }
          : null,
      });

      const minimalServers = response.servers
        .map(this.convertToMinimalServer)
        .filter((s): s is MinimalMCPServer => s !== null);

      logger.info(`Found ${minimalServers.length} connectable servers`, {
        service: 'RegistryService',
      });

      return {
        servers: minimalServers,
        nextCursor: response.metadata.next_cursor,
      };
    } catch (error: any) {
      logger.error('Error searching servers:', error);
      return { servers: [], nextCursor: null };
    }
  }

  /**
   * Get a single server by its UUID from our registry.
   */
  async getServerById(serverId: string): Promise<MinimalMCPServer | null> {
    try {
      // The endpoint for fetching by ID is correct.
      const server = await this.makeRequest<RegistryServerObject>(
        `/api/v0/servers/${serverId}`,
      );
      return this.convertToMinimalServer(server);
    } catch (error: any) {
      if (error.message.includes('404')) {
        logger.warn(`Server with ID ${serverId} not found (404).`, {
          service: 'RegistryService',
        });
      } else {
        logger.error(`Error fetching server by ID ${serverId}:`, error);
      }
      return null;
    }
  }

  /**
   * FIXED: The core transformation logic.
   * It now relies on the guaranteed top-level 'id' field.
   */
  private convertToMinimalServer(
    server: RegistryServerObject | null,
  ): MinimalMCPServer | null {
    if (!server) {
      return null;
    }

    // The new, robust source of truth for the ID and remote URL.
    const canonicalId = server.id;
    const primaryRemoteUrl = server.remotes?.[0]?.url;

    // This check remains critical: a server is only useful to the bot if it
    // has a unique ID and a connection URL.
    if (!canonicalId || !primaryRemoteUrl) {
      logger.debug(
        `Skipping server ${server.name}: missing id (${!!canonicalId}) or primaryRemoteUrl (${!!primaryRemoteUrl})`,
        { service: 'RegistryService' },
      );
      return null;
    }

    return {
      id: canonicalId,
      name: server.name,
      description: server.description,
      url: primaryRemoteUrl,
    };
  }
}
