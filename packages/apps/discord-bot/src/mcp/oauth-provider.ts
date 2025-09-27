import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  OAuthClientInformationSchema,
  OAuthClientInformation,
  OAuthTokens,
  OAuthTokensSchema,
  OAuthMetadata,
  OAuthMetadataSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { DatabaseService } from '../types/services.js';
import { MCPEventService } from '../services/event-emitter.service.js';
import logger from '../utils/logger.js';

// This class is now specific to the Connection Manager's needs.
// It uses userId and mcpServerConfigId.
export class ConnectionManagerOAuthProvider implements OAuthClientProvider {
  constructor(
    private mcpServerConfigId: string,
    private userId: string,
    private databaseService: DatabaseService,
    private eventService: MCPEventService,
    private mcpServerUrl?: string,
  ) {}

  // serverId for database paths is mcpServerConfigId
  private get dbServerId(): string {
    return this.mcpServerConfigId;
  }

  get redirectUrl(): string {
    return process.env.OAUTH_CALLBACK_URL!;
  }

  get clientMetadata() {
    // This metadata is for registering this Connection Manager (acting as a client) with the MCP Server.
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'Prometheus Protocol Discord Bot',
      client_uri: 'https://prometheusprotocol.org',
    };
  }

  /**
   * Retrieves the AS metadata from the database.
   * This is the canonical "getter" for cached metadata.
   */
  async serverMetadata(): Promise<OAuthMetadata | undefined> {
    try {
      const metadata = await this.databaseService.getOAuthServerMetadata(
        this.dbServerId,
      );
      if (metadata) {
        return OAuthMetadataSchema.parseAsync(metadata);
      }
      return undefined;
    } catch (err) {
      console.error(
        `Failed to retrieve server metadata for ${this.dbServerId}:`,
        err,
      );
      return undefined;
    }
  }

  /**
   * Saves the discovered AS metadata to the database for future use.
   */
  async saveServerMetadata(metadata: OAuthMetadata): Promise<void> {
    try {
      await this.databaseService.saveOAuthServerMetadata(
        this.dbServerId,
        metadata,
      );
    } catch (err) {
      console.error(
        `Failed to save server metadata for ${this.dbServerId}:`,
        err,
      );
      throw err;
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    try {
      const clientInfo = await this.databaseService.getOAuthClientInfo(
        this.dbServerId,
      );
      if (clientInfo && clientInfo.client_id) {
        return OAuthClientInformationSchema.parseAsync(clientInfo);
      }
      return undefined;
    } catch (err) {
      console.error(
        `Failed to fetch client information for ${this.dbServerId}:`,
        err,
      );
      return undefined;
    }
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformation,
  ): Promise<void> {
    try {
      await this.databaseService.saveOAuthClientInfo(
        this.dbServerId,
        clientInformation,
      );
    } catch (err) {
      console.error(
        `Failed to save client information for ${this.dbServerId}:`,
        err,
      );
      throw err;
    }
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    try {
      const tokenData = await this.databaseService.getOAuthTokens(
        this.dbServerId,
        this.userId,
      );
      if (tokenData && tokenData.access_token) {
        const oauthTokens = {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_in: tokenData.expires_at
            ? Math.max(
                0,
                Math.floor(
                  (tokenData.expires_at.getTime() - Date.now()) / 1000,
                ),
              )
            : undefined,
          refresh_token: tokenData.refresh_token || undefined,
          scope: tokenData.scope || undefined,
        };
        return OAuthTokensSchema.parseAsync(oauthTokens);
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to retrieve tokens for ${this.dbServerId}:`, err);
      return undefined;
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    try {
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined;

      await this.databaseService.saveOAuthTokens({
        server_id: this.dbServerId,
        user_id: this.userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt || null,
        scope: tokens.scope || null,
        token_type: tokens.token_type || 'Bearer',
        raw_tokens: tokens,
      });
    } catch (err) {
      console.error(`Failed to save tokens for ${this.dbServerId}:`, err);
      throw err;
    }
  }

  // This method is called by the SDK.
  redirectToAuthorization(authorizationUrl: URL): void {
    // Publish the auth required event to trigger Discord bot OAuth flow
    this.eventService
      .publishAuthRequired({
        generatedAt: new Date().toISOString(),
        userId: this.userId, // In Discord context, userId is the user ID
        mcpServerConfigId: this.mcpServerConfigId,
        mcpServerUrl: this.mcpServerUrl || '', // Use the server URL passed to the provider
        oauthAuthorizationUrl: authorizationUrl.toString(),
      })
      .catch((err) => {
        logger.error(
          `[AuthProvider-${this.userId}-${this.dbServerId}] Failed to publish AuthRequired event:`,
          err,
        );
      });
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    try {
      console.warn(
        `Saving PKCE code_verifier to DB for server ${this.dbServerId}.`,
      );

      // Get existing oauth_pending record or create a new one
      const existing = await this.databaseService.getOAuthPending(
        this.dbServerId,
        this.userId,
      );

      await this.databaseService.saveOAuthPending({
        server_id: this.dbServerId,
        user_id: this.userId,
        state: existing?.state || 'temp-state', // Will be updated when auth flow starts
        code_verifier: codeVerifier,
        auth_url: existing?.auth_url || '',
      });
    } catch (err) {
      console.error(
        `Failed to save code verifier for ${this.dbServerId}:`,
        err,
      );
      throw err;
    }
  }

  async codeVerifier(): Promise<string> {
    try {
      const pending = await this.databaseService.getOAuthPending(
        this.dbServerId,
        this.userId,
      );
      if (pending?.code_verifier) {
        console.warn(
          `Loaded PKCE code_verifier from DB for server ${this.dbServerId}.`,
        );
        return pending.code_verifier;
      }
      console.warn(
        `No PKCE code_verifier found in DB for server ${this.dbServerId}.`,
      );
      throw new Error('No code verifier found');
    } catch (err) {
      console.error(
        `Failed to retrieve code verifier for ${this.dbServerId}:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Saves the resource URL to the temporary initiation data in database.
   * This should be called alongside saveCodeVerifier.
   */
  async saveResource(resource: URL): Promise<void> {
    try {
      console.info(`Saving resource URL to DB: ${resource.toString()}`);

      // Get existing oauth_pending record or create a new one
      const existing = await this.databaseService.getOAuthPending(
        this.dbServerId,
        this.userId,
      );

      // For now, we'll store the resource URL in the auth_url field if it's not already set
      // In a production system, you might want to add a dedicated resource_url field to the table
      await this.databaseService.saveOAuthPending({
        server_id: this.dbServerId,
        user_id: this.userId,
        state: existing?.state || 'temp-state',
        code_verifier: existing?.code_verifier || '',
        auth_url: existing?.auth_url || resource.toString(), // Store resource URL here temporarily
      });
    } catch (err) {
      console.error(`Failed to save resource URL for ${this.dbServerId}:`, err);
      throw err;
    }
  }

  /**
   * Retrieves the resource URL from the temporary initiation data in database.
   */
  async getResource(): Promise<URL | undefined> {
    try {
      const pending = await this.databaseService.getOAuthPending(
        this.dbServerId,
        this.userId,
      );
      if (pending?.auth_url && pending.auth_url !== '') {
        console.info(`Loaded resource URL from DB: ${pending.auth_url}`);
        return new URL(pending.auth_url);
      }
      console.warn(
        `No resource URL found in DB for server ${this.dbServerId}.`,
      );
      return undefined;
    } catch (err) {
      console.error(
        `Failed to retrieve resource URL for ${this.dbServerId}:`,
        err,
      );
      return undefined;
    }
  }

  /**
   * Saves the OAuth pending state and authorization URL for callback lookup.
   */
  async saveOAuthPending(params: {
    state: string;
    authUrl: string;
    codeVerifier?: string;
    resourceUrl?: string;
  }): Promise<void> {
    try {
      console.info(
        `Saving OAuth pending state for server ${this.dbServerId}: state=${params.state.substring(0, 10)}...`,
      );

      // Get existing oauth_pending record to preserve any existing data
      const existing = await this.databaseService.getOAuthPending(
        this.dbServerId,
        this.userId,
      );

      await this.databaseService.saveOAuthPending({
        server_id: this.dbServerId,
        user_id: this.userId,
        state: params.state,
        code_verifier: params.codeVerifier || existing?.code_verifier || '',
        auth_url: params.resourceUrl || params.authUrl, // Use resource URL if provided, otherwise auth URL
      });
    } catch (err) {
      console.error(
        `Failed to save OAuth pending state for ${this.dbServerId}:`,
        err,
      );
      throw err;
    }
  }
}
