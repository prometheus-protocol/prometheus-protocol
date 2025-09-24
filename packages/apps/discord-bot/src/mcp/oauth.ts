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

  // 1. Check for tokens first
  const tokens = await provider.tokens();
  if (tokens && tokens.access_token) {
    // Optionally: check if token is expired and refresh if needed
    return 'AUTHORIZED';
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

      console.log('Registered new OAuth client:', fullInformation);
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
      const newTokens = await refreshAuthorization(authorizationServerUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
        resource,
      });

      await provider.saveTokens(newTokens);
      return 'AUTHORIZED';
    } catch {
      // Could not refresh OAuth tokens
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
