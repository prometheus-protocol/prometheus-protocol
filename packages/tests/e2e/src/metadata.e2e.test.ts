import { describe, test, expect } from 'vitest';
import { Principal } from '@dfinity/principal';
import canisterIds from '../../../../.dfx/local/canister_ids.json';

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.auth_server.local);
const replicaUrl = `http://127.0.0.1:4943`;

// --- Test Suite ---
describe('Server Metadata Endpoints', () => {
  test('should return correct and compliant server metadata from /.well-known/oauth-authorization-server', async () => {
    // Arrange: Construct the URL for the metadata endpoint
    const metadataUrl = new URL(
      `${replicaUrl}/.well-known/oauth-authorization-server`,
    );
    metadataUrl.searchParams.set('canisterId', backendCanisterId.toText());
    // TODO: Fix caching to work with query params? Add cache busting to ensure we always get the latest metadata
    metadataUrl.searchParams.set('cb', Date.now().toString());

    // Act: Fetch the metadata
    const response = await fetch(metadataUrl.toString());
    const metadata = await response.json();

    // Assert: The request was successful and returned the correct content type
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    // Assert: The issuer URL is correctly constructed for the local environment
    const expectedIssuer = `http://${backendCanisterId.toText()}.127.0.0.1:4943`;
    expect(metadata.issuer).toBe(expectedIssuer);

    // Assert: All other endpoint URLs are correctly formed relative to the issuer
    expect(metadata.authorization_endpoint).toBe(`${expectedIssuer}/authorize`);
    expect(metadata.token_endpoint).toBe(`${expectedIssuer}/token`);
    expect(metadata.jwks_uri).toBe(`${expectedIssuer}/.well-known/jwks.json`);
    expect(metadata.registration_endpoint).toBe(`${expectedIssuer}/register`);

    // Assert: The server correctly advertises its capabilities, including refresh tokens
    expect(metadata.grant_types_supported).toEqual(
      expect.arrayContaining(['authorization_code', 'refresh_token']),
    );
    expect(metadata.response_types_supported).toContain('code');
    expect(metadata.code_challenge_methods_supported).toContain('S256');
    expect(metadata.token_endpoint_auth_methods_supported).toContain('none');
  });

  test('should return a valid JWKS from /.well-known/jwks.json', async () => {
    // Arrange: Construct the URL for the JWKS endpoint
    const jwksUrl = new URL(`${replicaUrl}/.well-known/jwks.json`);
    jwksUrl.searchParams.set('canisterId', backendCanisterId.toText());
    // TODO: Fix caching to work with query params? Add cache busting to ensure we always get the latest keys
    jwksUrl.searchParams.set('cb', Date.now().toString());

    // Act: Fetch the JWKS
    const response = await fetch(jwksUrl.toString());
    const jwks = await response.json();

    // Assert: The request was successful
    expect(response.status).toBe(200);

    // Assert: The JWKS has the correct structure
    expect(jwks).toHaveProperty('keys');
    expect(Array.isArray(jwks.keys)).toBe(true);
    // The key is generated on first request, so the array should now have one key.
    expect(jwks.keys.length).toBe(1);

    // Assert: The key has all required properties for a JWT validation library
    const key = jwks.keys[0];
    expect(key.kty).toBe('EC');
    expect(key.crv).toBe('P-256');
    expect(key.kid).toBe(backendCanisterId.toText()); // Key ID must be the canister principal
    expect(key.alg).toBe('ES256');
    expect(key.x).toBeDefined();
    expect(key.y).toBeDefined();
  });
});
