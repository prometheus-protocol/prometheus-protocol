import { describe, test, expect, beforeAll } from 'vitest';
import { Principal } from '@dfinity/principal';
import * as jose from 'jose';
import canisterIds from '../../.dfx/local/canister_ids.json';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { executeFullLoginFlow } from './shared';

// Load shared test environment variables from the global setup file
dotenv.config({ path: path.resolve(__dirname, '../.test.env') });

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
const replicaUrl = `http://127.0.0.1:4943`;
const clientId = process.env.E2E_CLIENT_ID!;

// --- Test Suite ---
describe('Token Endpoint', () => {
  beforeAll(() => {
    if (!clientId) {
      throw new Error(
        'Client ID not found. Ensure global setup ran correctly.',
      );
    }
  });

  describe('Authorization Code Grant', () => {
    test('should exchange a valid auth code for a valid JWT', async () => {
      // Arrange: Execute the full login flow to get a valid code
      const { authCode, pkce, endUserIdentity } = await executeFullLoginFlow(
        'openid profile',
        clientId,
      );

      // Act: Exchange authorization code for a token
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });

      // Assert: Token exchange is successful
      expect(tokenResponse.status).toBe(200);
      const tokenData = await tokenResponse.json();
      expect(tokenData.access_token).toBeDefined();
      expect(tokenData.refresh_token).toBeDefined();
      expect(tokenData.token_type).toBe('Bearer');

      // Assert: JWT is valid and has the correct claims
      const jwksUrl = new URL(`${replicaUrl}/.well-known/jwks.json`);
      jwksUrl.searchParams.set('canisterId', backendCanisterId.toText());
      // TODO: Fix caching to work with query params? Add cache busting to ensure we always get the latest keys
      jwksUrl.searchParams.set('cb', Date.now().toString());
      const remoteJwks = jose.createRemoteJWKSet(new URL(jwksUrl.toString()));
      const { payload } = await jose.jwtVerify(
        tokenData.access_token,
        remoteJwks,
        {
          issuer: `http://${backendCanisterId.toText()}.127.0.0.1:4943`,
          audience: 'https://some-oauth-resource-server.com',
        },
      );
      expect(payload.sub).toBe(endUserIdentity.getPrincipal().toText());
    });

    test('should reject a reused authorization code', async () => {
      // Arrange: Get a valid authorization code
      const { authCode, pkce } = await executeFullLoginFlow(
        'openid profile',
        clientId,
      );
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());

      // Act 1: Use the code successfully once
      const firstResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });
      expect(firstResponse.status).toBe(200);

      // Act 2: Try to use the same code again
      const secondResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });

      // Assert: The second request must fail
      expect(secondResponse.status).toBe(400);
      const errorJson = await secondResponse.json();
      expect(errorJson.error).toBe('invalid_grant');
    });
  });

  describe('Refresh Token Grant', () => {
    let initialRefreshToken: string;
    let initialAccessToken: string;

    // Helper to get an initial set of tokens
    const getInitialTokens = async () => {
      const { authCode, pkce } = await executeFullLoginFlow(
        'openid profile prometheus:charge',
        clientId,
      );
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });
      return await response.json();
    };

    test('should successfully exchange a refresh token for a new set of tokens', async () => {
      // Arrange: Get the initial set of tokens
      const initialTokenData = await getInitialTokens();
      initialRefreshToken = initialTokenData.refresh_token;
      initialAccessToken = initialTokenData.access_token;
      expect(initialRefreshToken).toBeDefined();

      // Act: Use the refresh token to get a new set of tokens
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const refreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: initialRefreshToken,
          client_id: clientId,
        }),
      });

      // Assert: The refresh is successful and tokens are rotated
      expect(refreshResponse.status).toBe(200);
      const refreshedTokenData = await refreshResponse.json();
      expect(refreshedTokenData.access_token).toBeDefined();
      expect(refreshedTokenData.refresh_token).toBeDefined();
      expect(refreshedTokenData.access_token).not.toEqual(initialAccessToken);
      expect(refreshedTokenData.refresh_token).not.toEqual(initialRefreshToken);
    });

    test('should reject a reused (rotated) refresh token', async () => {
      // Arrange: Get an initial token, then use the refresh token once to rotate it.
      const initialTokenData = await getInitialTokens();
      const firstRefreshToken = initialTokenData.refresh_token;
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());

      const firstRefreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: firstRefreshToken,
          client_id: clientId,
        }),
      });
      expect(firstRefreshResponse.status).toBe(200);

      // Act: Try to use the *original* refresh token again
      const secondRefreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: firstRefreshToken, // Using the old, rotated token
          client_id: clientId,
        }),
      });

      // Assert: The second request must fail
      expect(secondRefreshResponse.status).toBe(400);
      const errorJson = await secondRefreshResponse.json();
      expect(errorJson.error).toBe('invalid_grant');
      expect(errorJson.error_description).toContain('revoked');
    });
  });

  describe('Authorization Code Grant Security', () => {
    test('should reject a request with an incorrect code_verifier', async () => {
      // Arrange: Get a valid authorization code
      const { authCode } = await executeFullLoginFlow(
        'openid profile',
        clientId,
      );

      // Act: Attempt to exchange the code with a *wrong* verifier
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: 'this-is-the-wrong-verifier-12345',
          resource: 'https://some-oauth-resource-server.com',
        }),
      });

      // Assert: The request must be rejected
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    });

    test('should reject a request with a mismatched redirect_uri', async () => {
      // Arrange
      const { authCode, pkce } = await executeFullLoginFlow(
        'openid profile',
        clientId,
      );

      // Act
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://evil-site.com', // Mismatched URI
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });

      // Assert
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    });

    test('should reject an expired authorization code', async () => {
      // Arrange
      const { authCode, pkce } = await executeFullLoginFlow(
        'openid profile',
        clientId,
      );

      // Act: Wait for the code to expire (e.g., 61 seconds)
      await new Promise((resolve) => setTimeout(resolve, 61000));

      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: clientId,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com',
        }),
      });

      // Assert
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    }, 80000); // Increase timeout for this specific test
  });
});
