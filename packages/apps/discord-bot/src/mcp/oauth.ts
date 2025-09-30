import {
  discoverOAuthProtectedResourceMetadata,
  extractResourceMetadataUrl,
  selectResourceURL,
  registerClient,
  exchangeAuthorization,
  refreshAuthorization,
  startAuthorization,
  discoverAuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/client/auth.js';
import {
  OAuthMetadata,
  OAuthProtectedResourceMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { ConnectionManagerOAuthProvider } from './oauth-provider.js';

/**
 * Checks if a JWT is expired or close to expiring.
 * @param token The JWT string.
 * @param bufferSeconds A buffer in seconds to treat the token as expired ahead of time (e.g., for network latency). Defaults to 30 seconds.
 * @returns `true` if the token is expired, `false` otherwise.
 */
function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  try {
    // Get the payload part of the token (the middle part)
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      console.log('DEBUG: Invalid token format - no payload section');
      return true; // Invalid token format
    }

    // Decode the base64 payload
    const decodedJson = atob(payloadBase64);
    const payload = JSON.parse(decodedJson);

    // Check if the 'exp' claim exists
    if (!payload.exp || typeof payload.exp !== 'number') {
      console.log('DEBUG: No exp claim found in token payload:', payload);
      return true; // No expiration claim, treat as invalid/expired
    }

    // Get the expiration time in milliseconds
    const expMillis = payload.exp * 1000;
    // Get the current time in milliseconds
    const nowMillis = Date.now();

    const timeUntilExpiry = expMillis - nowMillis;
    const isExpired = expMillis < nowMillis + bufferSeconds * 1000;

    console.log('DEBUG: Token expiry check:', {
      exp: payload.exp,
      expMillis,
      nowMillis,
      timeUntilExpirySeconds: Math.floor(timeUntilExpiry / 1000),
      bufferSeconds,
      isExpired,
      // Token preview removed for security
    });

    // Check if the token is expired, including the buffer
    return isExpired;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true; // If we can't parse it, assume it's expired/invalid
  }
}

export async function auth(
  provider: ConnectionManagerOAuthProvider,
  {
    serverUrl,
    authorizationCode,
    scope,
    resourceMetadataUrl,
  }: {
    serverUrl: string | URL;
    authorizationCode?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
  },
): Promise<'AUTHORIZED' | 'REDIRECT' | 'PENDING_CLIENT_REGISTRATION'> {
  let resourceMetadata: OAuthProtectedResourceMetadata | undefined;
  let authorizationServerUrl = serverUrl;

  // Build the well-known URL
  const wellKnownUrl = resourceMetadataUrl
    ? resourceMetadataUrl.toString()
    : (typeof serverUrl === 'string'
        ? serverUrl
        : serverUrl.toString()
      ).replace(/\/$/, '') + '/.well-known/oauth-protected-resource';

  // 1. Try to fetch the well-known endpoint directly to check for resource_metadata in header
  try {
    const res = await fetch(wellKnownUrl, { method: 'GET' });
    if (res.status === 401) {
      const newResourceMetadataUrl = extractResourceMetadataUrl(res);
      if (newResourceMetadataUrl) {
        resourceMetadata = await discoverOAuthProtectedResourceMetadata(
          serverUrl,
          { resourceMetadataUrl: newResourceMetadataUrl },
        );
      }
    }
  } catch {
    // Ignore network errors here, fallback to normal discovery
  }

  // 2. If not found via header, try normal discovery
  if (!resourceMetadata) {
    try {
      resourceMetadata = await discoverOAuthProtectedResourceMetadata(
        serverUrl,
        {
          resourceMetadataUrl,
        },
      );
    } catch (err) {
      // Only catch real errors (network, etc)
      // Optionally, you could log or handle as needed
    }
  }

  // If the server is open (no OAuth required), just return 'AUTHORIZED'
  if (
    !resourceMetadata ||
    !resourceMetadata.authorization_servers ||
    resourceMetadata.authorization_servers.length === 0
  ) {
    return 'AUTHORIZED';
  }

  if (
    resourceMetadata &&
    resourceMetadata.authorization_servers &&
    resourceMetadata.authorization_servers.length > 0
  ) {
    authorizationServerUrl = resourceMetadata.authorization_servers[0];
  }

  console.log('resourceMetadata', resourceMetadata);

  // ... rest of your function unchanged ...
  const resource: URL | undefined = await selectResourceURL(
    serverUrl,
    provider,
    resourceMetadata,
  );
  console.log('resource', resource?.toString());

  // 1. First, try to get metadata from our DB cache.
  let metadata: OAuthMetadata | undefined = await provider.serverMetadata();

  // 2. If it's a cache miss, discover it from the network.
  if (!metadata) {
    console.log('No cached metadata found, discovering from network...');
    try {
      const discoveredMetadata = await discoverAuthorizationServerMetadata(
        authorizationServerUrl,
      );
      if (discoveredMetadata) {
        metadata = discoveredMetadata;
        // 3. If discovery succeeds, SAVE IT to the cache for next time.
        await provider.saveServerMetadata(metadata);
        console.log('Successfully discovered and cached metadata.');
      }
    } catch (e) {
      console.error('Failed to discover OAuth metadata', e);
      // Handle error appropriately, maybe throw or return an error status
      throw new Error('Could not discover or load OAuth server metadata.');
    }
  } else {
    console.log('Successfully loaded metadata from cache.');
  }

  if (!metadata) {
    // This should now only happen if discovery fails.
    throw new Error('Failed to obtain OAuth server metadata.');
  }

  console.log('metadata', metadata);

  // 1. Check for existing and valid tokens first
  const tokens = await provider.tokens();
  if (tokens && tokens.access_token) {
    // Check if the access token is NOT expired.
    if (!isTokenExpired(tokens.access_token)) {
      // If we have a token and it's still valid, we're good.
      return 'AUTHORIZED';
    }
    // If the token IS expired, we don't return. We let the code
    // fall through to the refresh logic below.
    console.log('Access token is expired, proceeding to refresh logic.');
  }

  // Handle client registration if needed
  let clientInformation = await provider.clientInformation();
  console.log('clientInformation', clientInformation);
  if (!clientInformation) {
    // Check if DCR is supported
    const supportsDCR = !!(metadata && metadata.registration_endpoint);

    if (!supportsDCR) {
      // For GitHub and other non-DCR servers, return a special status
      return 'PENDING_CLIENT_REGISTRATION';
    }

    if (authorizationCode !== undefined) {
      throw new Error(
        'Existing OAuth client information is required when exchanging an authorization code',
      );
    }

    if (!provider.saveClientInformation) {
      throw new Error(
        'OAuth client information must be saveable for dynamic registration',
      );
    }

    try {
      const fullInformation = await registerClient(authorizationServerUrl, {
        metadata,
        clientMetadata: provider.clientMetadata,
      });

      console.log('Registered new OAuth client:', {
        client_id: fullInformation.client_id ? '[REDACTED]' : 'none',
        hasClientSecret: !!fullInformation.client_secret,
        // Sensitive client data removed for security
      });
      await provider.saveClientInformation(fullInformation);
      clientInformation = fullInformation;
    } catch (e) {
      console.error('Failed to register OAuth client', e);
      throw new Error('Could not register OAuth client.');
    }
  }

  // Exchange authorization code for tokens
  if (authorizationCode !== undefined) {
    const resourceFromStorage = await provider.getResource();

    const codeVerifier = await provider.codeVerifier();
    const tokens = await exchangeAuthorization(authorizationServerUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: provider.redirectUrl,
      resource: resourceFromStorage,
    });

    await provider.saveTokens(tokens);
    return 'AUTHORIZED';
  }

  // Handle token refresh or new authorization
  if (tokens?.refresh_token) {
    try {
      // Attempt to refresh the token
      console.log('Attempting to refresh OAuth tokens...');
      console.log('DEBUG: Refresh token details:', {
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        hasExpiryInfo: tokens.expires_in !== undefined,
        hasMetadata: !!metadata,
        hasClientInformation: !!clientInformation,
        // Sensitive token data removed for security
      });

      const newTokens = await refreshAuthorization(authorizationServerUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
        resource,
      });

      console.log('DEBUG: Token refresh successful, saving new tokens');
      await provider.saveTokens(newTokens);
      return 'AUTHORIZED';
    } catch (refreshError: any) {
      // Could not refresh OAuth tokens
      console.log('DEBUG: Token refresh failed with error:', {
        error: refreshError.message,
        status: refreshError.status || refreshError.response?.status,
        responseText: refreshError.response?.statusText,
        stack: refreshError.stack,
      });
      console.log(
        'Failed to refresh OAuth tokens, starting new authorization.',
      );
    }
  }

  // Generate a unique state parameter for this OAuth flow
  const state = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

  const scopeToUse = scope || metadata.scopes_supported?.join(' ');

  console.log('scope', scopeToUse);
  // Start new authorization flow
  const { authorizationUrl, codeVerifier } = await startAuthorization(
    authorizationServerUrl,
    {
      metadata,
      clientInformation,
      state,
      redirectUrl: provider.redirectUrl,
      scope: scopeToUse,
      resource,
    },
  );

  // Save all OAuth pending data together for callback lookup
  await provider.saveOAuthPending({
    state,
    authUrl: authorizationUrl.toString(),
    codeVerifier,
    resourceUrl: resource?.toString(),
  });

  provider.redirectToAuthorization(authorizationUrl);
  return 'REDIRECT';
}
