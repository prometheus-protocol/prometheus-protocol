import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import * as jose from 'jose';

// Import canister definitions
import { _SERVICE as BackendService } from '../src/declarations/oauth_backend/oauth_backend.did';
import canisterIds from '../.dfx/local/canister_ids.json';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '../src/declarations/oauth_backend';

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
const replicaUrl = `http://127.0.0.1:4943`;

// --- State Variables ---
let dcrResponse: { client_id: string; client_secret: string };
let developerIdentity: Identity;
let backendActor: BackendService;

// --- Helper Functions ---
const generatePkce = async () => {
  const verifier = jose.base64url.encode(
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const challenge = jose.base64url.encode(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ),
  );
  return { verifier, challenge };
};

const createActorFor = (identity: Identity) => {
  const agent = new HttpAgent({
    host: replicaUrl,
    identity,
  });
  return createActor(backendCanisterId, { agent });
};

// --- Test Suite ---
describe('Prometheus Protocol E2E Happy Path', () => {
  beforeAll(async () => {
    // Create a test identity for the "developer" who activates the client

    developerIdentity = Secp256k1KeyIdentity.generate();
    backendActor = createActorFor(developerIdentity);
  });

  afterAll(async () => {});

  test('Phase 1: Should allow a client to dynamically register and activate', async () => {
    // 1a. Dynamic Client Registration
    const registerResponse = await fetch(
      `${replicaUrl}/register?canisterId=${backendCanisterId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'E2E Test App',
          redirect_uris: ['https://jwt.io'],
        }),
      },
    );

    expect(registerResponse.status).toBe(201);
    dcrResponse = await registerResponse.json();
    expect(dcrResponse.client_id).toBeDefined();
    expect(dcrResponse.client_secret).toBeDefined();
  });

  test('Phase 2: Should allow a developer to activate a resource server', async () => {
    // 1b. Activate a resource server
    const activateResponse = await backendActor.register_resource_server({
      initial_service_principal: developerIdentity.getPrincipal(),
      name: 'E2E Test Resource Server',
      uris: ['https://some-oauth-resource-server.com'],
      payout_principal: developerIdentity.getPrincipal(),
    });

    // 'status' : { 'active' : null } |
    //   { 'pending' : null },
    // 'resource_server_id' : string,
    // 'owner' : Principal,
    // 'name' : string,
    // 'uris' : Array<string>,
    // 'service_principals' : Array<Principal>,
    // 'payout_principal' : Principal,

    expect(activateResponse).toHaveProperty('status');
    expect(activateResponse.status).toHaveProperty('active');
    expect(activateResponse.resource_server_id).toBeDefined();
    expect(activateResponse.owner.toText()).toBe(
      developerIdentity.getPrincipal().toText(),
    );
    expect(activateResponse.name).toBe('E2E Test Resource Server');
    expect(activateResponse.uris).toContain(
      'https://some-oauth-resource-server.com',
    );
    expect(activateResponse.service_principals[0].toText()).toBe(
      developerIdentity.getPrincipal().toText(),
    );
    expect(activateResponse.payout_principal.toText()).toBe(
      developerIdentity.getPrincipal().toText(),
    );
  });

  test('Phase 3 & 4: Should perform the full auth code flow and issue a valid JWT', async () => {
    // 2a. Generate PKCE and construct authorize URL
    const pkce = await generatePkce();
    const authUrl = new URL(`${replicaUrl}/authorize`);
    authUrl.searchParams.set('canisterId', backendCanisterId.toText());
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', dcrResponse.client_id);
    authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
    authUrl.searchParams.set('code_challenge', pkce.challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set(
      'resource',
      'https://some-oauth-resource-server.com',
    );
    authUrl.searchParams.set('state', 'a-random-state-string-123');

    // 2b. Start authorization, get session_id from redirect
    const authResponse = await fetch(authUrl.toString(), {
      redirect: 'manual',
    });
    expect(authResponse.status).toBe(302); // Expect a redirect to the frontend
    const location = new URL(authResponse.headers.get('location'));
    const sessionId = location.searchParams.get('session_id');
    expect(sessionId).toBeDefined();

    // 2c. Simulate user login and consent
    const endUserIdentity = Secp256k1KeyIdentity.generate();
    const endUserActor = createActorFor(endUserIdentity);
    const completeAuthResult = await endUserActor.complete_authorize(sessionId);
    expect(completeAuthResult).toHaveProperty('ok');

    // 2d. Extract authorization code from the final redirect
    if (!('ok' in completeAuthResult)) {
      throw new Error(`Authorization failed: ${completeAuthResult.err}`);
    }

    const finalRedirectUrl = new URL(completeAuthResult.ok);
    const authCode = finalRedirectUrl.searchParams.get('code');
    expect(authCode).toBeDefined();

    // 3a. Exchange authorization code for a token
    const tokenUrl = new URL(`${replicaUrl}/token`);
    tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'https://jwt.io',
        client_id: dcrResponse.client_id,
        client_secret: dcrResponse.client_secret,
        code_verifier: pkce.verifier,
        resource: 'https://some-oauth-resource-server.com', // Include the resource
      }),
    });

    expect(tokenResponse.status).toBe(200);
    const tokenData = await tokenResponse.json();
    expect(tokenData.access_token).toBeDefined();
    expect(tokenData.token_type).toBe('Bearer');

    // 4. Verify the JWT
    const jwksUrl = new URL(`${replicaUrl}/.well-known/jwks.json`);
    jwksUrl.searchParams.set('canisterId', backendCanisterId.toText());
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

  describe('Security and Failure Cases', () => {
    // Helper function to run the auth flow up to getting a valid code
    const getValidAuthCode = async () => {
      const pkce = await generatePkce();
      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', dcrResponse.client_id);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set('code_challenge', pkce.challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      authUrl.searchParams.set('state', 'a-random-state-string-123');

      const authResponse = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });
      const location = new URL(authResponse.headers.get('location'));
      const sessionId = location.searchParams.get('session_id');

      const endUserIdentity = Secp256k1KeyIdentity.generate();
      const endUserActor = createActorFor(endUserIdentity);
      const completeAuthResult =
        await endUserActor.complete_authorize(sessionId);
      if (!('ok' in completeAuthResult))
        throw new Error('Failed to get auth code');
      const finalRedirectUrl = new URL(completeAuthResult.ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      return { authCode, pkce };
    };

    test('should reject /authorize request without a state parameter', async () => {
      const pkce = await generatePkce();
      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', dcrResponse.client_id);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set('code_challenge', pkce.challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      // Missing 'state' parameter

      const response = await fetch(authUrl.toString());
      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain('state is required');
    });

    test('should reject client registration with an empty redirect_uris array', async () => {
      const registerResponse = await fetch(
        `${replicaUrl}/register?canisterId=${backendCanisterId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'Empty URI App',
            redirect_uris: [], // Invalid empty array
          }),
        },
      );

      expect(registerResponse.status).toBe(400);
      const errorJson = await registerResponse.json();
      expect(errorJson.error).toBe('invalid_redirect_uri');
    });

    test('should reject a reused authorization code', async () => {
      // Arrange: Get a valid authorization code
      const { authCode, pkce } = await getValidAuthCode();

      // Act 1: Use the code successfully once
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const firstResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com', // Include the resource
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
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: pkce.verifier,
        }),
      });

      // Assert: The second request must fail with a 400 Bad Request
      expect(secondResponse.status).toBe(400);
      const errorJson = await secondResponse.json();
      expect(errorJson.error).toBe('invalid_grant');
    });

    test('should reject a request with an incorrect code_verifier', async () => {
      // Arrange: Get a valid authorization code
      const { authCode, pkce } = await getValidAuthCode();

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
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: 'this-is-the-wrong-verifier-12345',
          resource: 'https://some-oauth-resource-server.com', // Include the resource
        }),
      });

      // Assert: The request must be rejected
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    });

    test('should reject a request with a mismatched redirect_uri', async () => {
      // Arrange: Get a valid authorization code
      const { authCode, pkce } = await getValidAuthCode();

      // Act: Attempt to exchange the code with a different redirect_uri
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://evil-site.com', // Mismatched URI
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com', // Include the resource
        }),
      });

      // Assert: The request must be rejected
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    });

    // This test assumes your auth code expires in 60 seconds. Adjust if needed.
    test('should reject an expired authorization code', async () => {
      // Arrange: Get a valid authorization code
      const { authCode, pkce } = await getValidAuthCode();

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
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com', // Include the resource
        }),
      });

      // Assert: The request must be rejected
      expect(response.status).toBe(400);
      const errorJson = await response.json();
      expect(errorJson.error).toBe('invalid_grant');
    }, 70000); // Increase timeout for this specific test
  });

  describe('Refresh Token Flow', () => {
    let initialRefreshToken: string;
    let initialAccessToken: string;
    let endUserIdentity: Identity;

    // Helper to perform the initial login and get the first set of tokens
    const performInitialLogin = async () => {
      const pkce = await generatePkce();
      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', dcrResponse.client_id);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set('code_challenge', pkce.challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      authUrl.searchParams.set(
        'state',
        'a-random-state-string-for-failure-tests',
      );

      const authResponse = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });
      const location = new URL(authResponse.headers.get('location'));
      const sessionId = location.searchParams.get('session_id');

      endUserIdentity = Secp256k1KeyIdentity.generate();
      const endUserActor = createActorFor(endUserIdentity);
      const completeAuthResult =
        await endUserActor.complete_authorize(sessionId);
      if (!('ok' in completeAuthResult))
        throw new Error('Failed to get auth code');
      const finalRedirectUrl = new URL(completeAuthResult.ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const tokenResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'https://jwt.io',
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
          code_verifier: pkce.verifier,
          resource: 'https://some-oauth-resource-server.com', // Include the resource
        }),
      });

      return await tokenResponse.json();
    };

    test('should successfully exchange a refresh token for a new set of tokens', async () => {
      // Arrange: Get the initial set of tokens
      const initialTokenData = await performInitialLogin();
      expect(initialTokenData.refresh_token).toBeDefined();
      initialRefreshToken = initialTokenData.refresh_token;
      initialAccessToken = initialTokenData.access_token;

      // Act: Use the refresh token to get a new set of tokens
      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const refreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: initialRefreshToken,
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
        }),
      });

      // Assert: The request was successful
      expect(refreshResponse.status).toBe(200);
      const refreshedTokenData = await refreshResponse.json();

      // Assert: We received a new access token and a new refresh token
      expect(refreshedTokenData.access_token).toBeDefined();
      expect(refreshedTokenData.refresh_token).toBeDefined();
      expect(refreshedTokenData.access_token).not.toEqual(initialAccessToken);
      expect(refreshedTokenData.refresh_token).not.toEqual(initialRefreshToken);

      // Assert: The new access token is valid
      const jwksUrl = new URL(`${replicaUrl}/.well-known/jwks.json`);
      jwksUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const remoteJwks = jose.createRemoteJWKSet(new URL(jwksUrl.toString()));
      console.log('token:', refreshedTokenData.access_token);
      const { payload } = await jose.jwtVerify(
        refreshedTokenData.access_token,
        remoteJwks,
        {
          issuer: `http://${backendCanisterId.toText()}.127.0.0.1:4943`,
          audience: 'https://some-oauth-resource-server.com',
        },
      );
      expect(payload.sub).toBe(endUserIdentity.getPrincipal().toText());
    });

    test('should reject a reused (rotated) refresh token', async () => {
      // Arrange: Get an initial token, then use the refresh token once to rotate it.
      const initialTokenData = await performInitialLogin();
      const firstRefreshToken = initialTokenData.refresh_token;

      const tokenUrl = new URL(`${replicaUrl}/token`);
      tokenUrl.searchParams.set('canisterId', backendCanisterId.toText());
      const firstRefreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: firstRefreshToken,
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
        }),
      });
      expect(firstRefreshResponse.status).toBe(200); // First refresh is successful

      // Act: Try to use the *original* refresh token again
      const secondRefreshResponse = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: firstRefreshToken, // Using the old, rotated token
          client_id: dcrResponse.client_id,
          client_secret: dcrResponse.client_secret,
        }),
      });

      // Assert: The second request must fail
      expect(secondRefreshResponse.status).toBe(400);
      const errorJson = await secondRefreshResponse.json();
      expect(errorJson.error).toBe('invalid_grant');
      expect(errorJson.error_description).toContain('revoked');
    });
  });
});
