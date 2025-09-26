import logger from '../utils/logger.js';

// ============================================================================
// FINAL MINIMAL, SPEC-COMPLIANT TYPES
// ============================================================================

/**
 * The absolute minimal set of properties our bot needs for server discovery,
 * relying only on guaranteed fields from the official registry spec.
 */
export type MinimalMCPServer = {
  id: string; // The official, unique server UUID
  name: string; // The full reverse-DNS name (e.g., "io.github.user/repo")
  description: string;
  url: string; // The primary connection URL from the 'remotes' array
};

/** The raw server object from the official registry API. */
type OfficialServerObject = {
  name: string;
  description: string;
  remotes?: { url: string }[];
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      serverId: string;
    };
  };
};

/** The raw list response from the official registry API. */
type OfficialApiResponse = {
  servers: OfficialServerObject[];
  metadata: {
    next_cursor: string | null;
  };
};

/** Search parameters supported by the official registry. */
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

  constructor(
    registryUrl: string = 'https://registry.modelcontextprotocol.io',
  ) {
    this.baseUrl = registryUrl;
    logger.info(
      `RegistryService (final minimal) initialized for registry: ${this.baseUrl}`,
      {
        service: 'RegistryService',
      },
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
   * Search for MCP servers. Returns minimal server objects and a pagination cursor.
   */
  async searchServers(params: SearchParams = {}): Promise<{
    servers: MinimalMCPServer[];
    nextCursor: string | null;
  }> {
    try {
      const apiParams = { ...params, version: 'latest' };
      const response = await this.makeRequest<OfficialApiResponse>(
        '/v0/servers',
        apiParams,
      );

      logger.debug(`Raw API response: ${response.servers.length} servers`, {
        service: 'RegistryService',
        firstServer: response.servers[0] ? {
          name: response.servers[0].name,
          hasRemotes: !!response.servers[0].remotes,
          remotesCount: response.servers[0].remotes?.length || 0,
          hasMeta: !!response.servers[0]._meta,
          serverId: response.servers[0]._meta?.['io.modelcontextprotocol.registry/official']?.serverId
        } : null
      });

      const minimalServers = response.servers
        .map(this.convertToMinimalServer.bind(this))
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
   * Get a single server by its official UUID.
   */
  async getServerById(serverId: string): Promise<MinimalMCPServer | null> {
    try {
      const server = await this.makeRequest<OfficialServerObject>(
        `/v0/servers/${serverId}`,
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
   * The core transformation logic. Converts a full official object to our minimal type.
   * Returns null if the server is not connectable.
   */
  private convertToMinimalServer(
    server: OfficialServerObject | null,
  ): MinimalMCPServer | null {
    if (!server) {
      logger.debug('Server is null', { service: 'RegistryService' });
      return null;
    }

    const canonicalId =
      server._meta?.['io.modelcontextprotocol.registry/official']?.serverId;
    const primaryRemoteUrl = server.remotes?.[0]?.url;

    logger.debug(`Converting server: ${server.name}`, {
      service: 'RegistryService',
      canonicalId,
      primaryRemoteUrl,
      hasRemotes: !!server.remotes,
      remotesLength: server.remotes?.length || 0,
      hasMeta: !!server._meta
    });

    // A server is only useful if it has a unique ID and a connection URL.
    if (!canonicalId || !primaryRemoteUrl) {
      logger.debug(`Skipping server ${server.name}: missing canonicalId (${!!canonicalId}) or primaryRemoteUrl (${!!primaryRemoteUrl})`, {
        service: 'RegistryService'
      });
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
