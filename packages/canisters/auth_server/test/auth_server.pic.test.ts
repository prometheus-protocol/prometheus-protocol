// packages/canisters/auth_server/test/auth_server.pic.test.ts

import path from 'node:path';
import { Principal } from '@dfinity/principal';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
  beforeEach,
  afterEach,
  inject,
} from 'vitest';
import { toNullable } from '@dfinity/utils';
import * as jose from 'jose';

// Import from the auth_server's declarations
import { idlFactory as authServerIdlFactory } from '@declarations/auth_server';
import {
  type _SERVICE as AuthService,
  HttpRequest,
  ResourceServer,
  UpdateResourceServerArgs,
} from '@declarations/auth_server/auth_server.did.js';
import { Identity } from '@dfinity/agent';

const AUTH_SERVER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auth_server/auth_server.wasm',
);

export const generatePkce = async () => {
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

describe('Auth Server Canister (Isolated Tests)', () => {
  let pic: PocketIc;
  let authActor: Actor<AuthService>;
  let authCanisterId: Principal;
  let clientId: string;
  let resourceServerId: string;
  const resourceServerUri = 'https://auth-flow.uri/api';

  // Identities
  let developerIdentity: Identity = createIdentity('developer');
  let hackerIdentity: Identity = createIdentity('hacker');

  beforeAll(async () => {
    pic = await PocketIc.create(inject('PIC_URL'));
    await pic.setTime(new Date());

    developerIdentity = createIdentity('developer');
    hackerIdentity = createIdentity('hacker');

    const fixture = await pic.setupCanister<AuthService>({
      idlFactory: authServerIdlFactory,
      wasm: AUTH_SERVER_WASM_PATH,
    });
    authActor = fixture.actor;
    authCanisterId = fixture.canisterId;

    // --- Create one client and one resource server for all tests to share ---
    // 1. Register a client
    const dcrRequest: HttpRequest = {
      method: 'POST',
      url: '/register',
      headers: [['Content-Type', 'application/json']],
      body: new TextEncoder().encode(
        JSON.stringify({
          client_name: 'Global Test Client',
          redirect_uris: ['https://jwt.io'],
        }),
      ),
    };
    authActor.setPrincipal(Principal.anonymous());
    const dcrResponse = await authActor.http_request_update(dcrRequest);
    clientId = JSON.parse(
      new TextDecoder().decode(dcrResponse.body as Uint8Array),
    ).client_id;

    // 2. Register a resource server
    authActor.setIdentity(developerIdentity);
    const rsResult = await authActor.register_resource_server({
      name: 'Global Resource Server',
      logo_uri: '',
      uris: [resourceServerUri],
      initial_service_principal: Principal.fromText('aaaaa-aa'),
      scopes: [
        ['openid', '...'],
        ['prometheus:charge', 'Allow charging your account'],
      ],
      accepted_payment_canisters: [
        Principal.fromText('aaaaa-aa'), // Replace with actual ICRC2 canister ID
      ],
      frontend_host: toNullable('http://localhost:3000'),
    });
    if ('err' in rsResult)
      throw new Error('Global setup failed to register RS');
    resourceServerId = rsResult.ok.resource_server_id;
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  describe('Dynamic Client Registration (DCR)', () => {
    it('should allow a client to dynamically register', async () => {
      // Arrange: Create the HttpRequest object matching the Candid type
      const request: HttpRequest = {
        method: 'POST',
        url: '/register',
        headers: [['Content-Type', 'application/json']],
        body: new TextEncoder().encode(
          JSON.stringify({
            client_name: 'E2E Test App',
            redirect_uris: ['https://jwt.io'],
          }),
        ),
      };

      // Act: Call the http_request_update method directly on the actor
      authActor.setPrincipal(Principal.anonymous());
      const response = await authActor.http_request_update(request);

      // Assert
      expect(response.status_code).toBe(201);
      const dcrResponse = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );
      expect(dcrResponse.client_id).toBeDefined();
    });

    it('should reject client registration with an empty redirect_uris array', async () => {
      // Arrange
      const request: HttpRequest = {
        method: 'POST',
        url: '/register',
        headers: [['Content-Type', 'application/json']],
        body: new TextEncoder().encode(
          JSON.stringify({
            client_name: 'Empty URI App',
            redirect_uris: [],
          }),
        ),
      };

      // Act
      authActor.setPrincipal(Principal.anonymous());
      const response = await authActor.http_request_update(request);

      // Assert
      expect(response.status_code).toBe(400);
      const errorJson = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );
      expect(errorJson.error).toBe('invalid_redirect_uri');
    });
  });

  describe('Resource Server Management', () => {
    let resourceServerId: string | undefined;

    beforeEach(async () => {
      authActor.setIdentity(developerIdentity);
      const result = await authActor.register_resource_server({
        name: 'Original Test Server',
        logo_uri: 'original_logo.png',
        uris: ['https://original.uri/api'],
        initial_service_principal: Principal.fromText('aaaaa-aa'),
        scopes: [['read', 'Read access']],
        accepted_payment_canisters: [],
        frontend_host: toNullable('http://localhost:3000'),
      });

      if ('err' in result) throw new Error(`Failed to register: ${result.err}`);
      resourceServerId = result.ok.resource_server_id;
    });

    afterEach(async () => {
      if (resourceServerId) {
        authActor.setIdentity(developerIdentity);
        await authActor.delete_resource_server(resourceServerId);
        resourceServerId = undefined;
      }
    });

    it('should allow the owner to update their resource server', async () => {
      // Arrange
      authActor.setIdentity(developerIdentity);
      const updates: UpdateResourceServerArgs = {
        resource_server_id: resourceServerId!,
        name: toNullable('Updated Test Server'),
        logo_uri: toNullable('updated_logo.png'),
        uris: toNullable(['https://new.uri/api']),
        scopes: toNullable([['write', 'Write access']]),
        service_principals: toNullable([]),
        accepted_payment_canisters: toNullable([]),
        frontend_host: toNullable('http://localhost:4000'),
      };

      // Act
      const updateResult = await authActor.update_resource_server(updates);

      // Assert
      expect(updateResult).toHaveProperty('ok');
      const getResult = await authActor.get_my_resource_server_details(
        resourceServerId!,
      );
      const serverDetails = (getResult as { ok: ResourceServer }).ok;
      expect(serverDetails.name).toBe('Updated Test Server');
    });

    it('should prevent a different identity from updating the resource server', async () => {
      // Arrange
      authActor.setIdentity(hackerIdentity); // Use the hacker identity
      const updates: UpdateResourceServerArgs = {
        resource_server_id: resourceServerId!,
        name: toNullable('Hacked Name'),
        logo_uri: toNullable(''),
        uris: toNullable(),
        scopes: toNullable(),
        service_principals: toNullable(),
        accepted_payment_canisters: toNullable(),
        frontend_host: toNullable(),
      };

      // Act
      const updateResult = await authActor.update_resource_server(updates);

      // Assert
      expect(updateResult).toHaveProperty('err');
      expect((updateResult as { err: string }).err).toContain('Unauthorized');
    });
  });

  describe('Metadata Endpoints', () => {
    it('should return correct server metadata from /.well-known/oauth-authorization-server', async () => {
      const request: HttpRequest = {
        method: 'GET',
        url: '/.well-known/oauth-authorization-server',
        headers: [],
        body: new Uint8Array(),
      };
      const response = await authActor.http_request_update(request);
      const metadata = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );

      expect(response.status_code).toBe(200);
      const expectedIssuer = `http://${authCanisterId.toText()}.127.0.0.1:4943`;
      expect(metadata.issuer).toBe(expectedIssuer);
      expect(metadata.authorization_endpoint).toBe(
        `${expectedIssuer}/authorize`,
      );
      expect(metadata.token_endpoint).toBe(`${expectedIssuer}/token`);
    });

    it('should return a valid JWKS from /.well-known/jwks.json', async () => {
      const request: HttpRequest = {
        method: 'GET',
        url: '/.well-known/jwks.json',
        headers: [],
        body: new Uint8Array(),
      };
      const response = await authActor.http_request_update(request);
      const jwks = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );

      expect(response.status_code).toBe(200);
      expect(jwks.keys.length).toBe(1);
      const key = jwks.keys[0];
      expect(key.kty).toBe('EC');
      expect(key.kid).toBe(authCanisterId.toText());
    });
  });

  describe('Authorization Flow & Token Exchange', () => {
    it('should exchange a valid auth code for a valid JWT', async () => {
      // Arrange: Execute the full login flow to get a valid code
      const pkce = await generatePkce();
      const endUserIdentity = createIdentity('end-user');

      // 1. Start flow
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');
      expect(sessionId).toBeDefined();

      // 2. Complete flow
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId!);
      const finalAuthResult = await authActor.complete_authorize(sessionId!);
      expect(finalAuthResult).toHaveProperty('ok');
      const finalRedirectUrl = new URL((finalAuthResult as { ok: string }).ok);
      const authCode = finalRedirectUrl.searchParams.get('code');
      expect(authCode).toBeDefined();

      // Act: Exchange authorization code for a token
      const tokenRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode!,
            redirect_uri: 'https://jwt.io',
            client_id: clientId,
            code_verifier: pkce.verifier,
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const tokenResponse = await authActor.http_request_update(tokenRequest);

      // Assert: Token exchange is successful
      expect(tokenResponse.status_code).toBe(200);
      const tokenData = JSON.parse(
        new TextDecoder().decode(tokenResponse.body as Uint8Array),
      );
      expect(tokenData.access_token).toBeDefined();

      // Assert: JWT is valid
      const jwksRequest: HttpRequest = {
        method: 'GET',
        url: '/.well-known/jwks.json',
        headers: [],
        body: new Uint8Array(),
      };
      const jwksResponse = await authActor.http_request(jwksRequest);
      const jwks = JSON.parse(
        new TextDecoder().decode(jwksResponse.body as Uint8Array),
      );
      const localJwks = jose.createLocalJWKSet(jwks);

      const { payload } = await jose.jwtVerify(
        tokenData.access_token,
        localJwks,
      );
      expect(payload.sub).toBe(endUserIdentity.getPrincipal().toText());
    });

    it('should reject a reused authorization code', async () => {
      // Arrange: Execute the full login flow to get a valid code
      const pkce = await generatePkce();
      const endUserIdentity = createIdentity('end-user-reuse');

      // 1. Start flow
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');

      // 2. Complete flow
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId!);
      const finalAuthResult = await authActor.complete_authorize(sessionId!);
      const finalRedirectUrl = new URL((finalAuthResult as { ok: string }).ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      // Act 1: Use the code successfully once
      const tokenRequestParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode!,
        redirect_uri: 'https://jwt.io',
        client_id: clientId,
        code_verifier: pkce.verifier,
      }).toString();
      const tokenRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(tokenRequestParams),
      };
      authActor.setPrincipal(Principal.anonymous());
      const firstResponse = await authActor.http_request_update(tokenRequest);
      expect(firstResponse.status_code).toBe(200); // The first use succeeds

      // Act 2: Try to use the same code again
      const secondResponse = await authActor.http_request_update(tokenRequest);

      // Assert: The second request must fail with an invalid_grant error
      expect(secondResponse.status_code).toBe(400);
      const errorJson = JSON.parse(
        new TextDecoder().decode(secondResponse.body as Uint8Array),
      );
      expect(errorJson.error).toBe('invalid_grant');
    });

    it('should reject a request with an incorrect code_verifier', async () => {
      // Arrange: Execute the full login flow to get a valid code
      const pkce = await generatePkce(); // We get a real verifier, but won't use it
      const endUserIdentity = createIdentity('code-verifier-user');

      // 1. Start flow
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');

      // 2. Complete flow
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId!);
      const finalAuthResult = await authActor.complete_authorize(sessionId!);
      const finalRedirectUrl = new URL((finalAuthResult as { ok: string }).ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      // Act: Attempt to exchange the code with a *wrong* verifier
      const tokenRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode!,
            redirect_uri: 'https://jwt.io',
            client_id: clientId,
            code_verifier: 'this-is-the-wrong-verifier-and-must-be-rejected',
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const response = await authActor.http_request_update(tokenRequest);

      // Assert: The request must be rejected
      expect(response.status_code).toBe(400);
      const errorJson = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );
      expect(errorJson.error).toBe('invalid_grant');
    });

    it('should reject session fixation attempts', async () => {
      const pkce = await generatePkce();
      // Arrange: Start a flow to get a session ID
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');
      expect(sessionId).toBeDefined();

      // Arrange: Create two distinct users
      const userA_Identity = createIdentity('user-a-victim');
      const userB_Attacker_Identity = createIdentity('user-b-attacker');

      // Act 1: User A (the legitimate user) confirms their login, binding their Principal to the session.
      authActor.setIdentity(userA_Identity);
      const confirmResult = await authActor.confirm_login(sessionId!);
      expect(confirmResult).toHaveProperty('ok'); // This should succeed

      // Act 2 (The Attack): User B (the attacker) tries to complete the next step of the flow.
      authActor.setIdentity(userB_Attacker_Identity);
      const attackResult = await authActor.complete_authorize(sessionId!);

      // Assert: The call from the attacker MUST fail because their Principal does not match the one bound to the session.
      expect(attackResult).toHaveProperty('err');
      const error = (attackResult as { err: string }).err;
      expect(error).toContain('Caller does not match session owner');
    });

    it('should reject an /authorize request with an unregistered scope', async () => {
      // Arrange: Construct an /authorize URL with a mix of valid and invalid scopes.
      // The space in 'openid god_mode' must be URL encoded as %20.
      const pkce = await generatePkce();
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid%20god_mode&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}&state=a-random-state-string-123`,
        headers: [],
        body: new Uint8Array(),
      };

      // Act: Make the request
      authActor.setPrincipal(Principal.anonymous());
      const response = await authActor.http_request_update(authRequest);

      // Assert: The request must be rejected with a 400 status and a specific error.
      expect(response.status_code).toBe(400);
      const error = new TextDecoder().decode(response.body as Uint8Array);

      expect(error).toBe(
        "Invalid Request: invalid_scope: The scope 'god_mode' is not supported by this resource server.",
      );
    });
  });

  describe('Resource URI with Query Parameters', () => {
    it('should succeed when the resource URI contains a query parameter', async () => {
      // ARRANGE

      // 1. Define a resource URI that includes a query parameter, mimicking local dev.
      const resourceUriWithQuery =
        'http://127.0.0.1:4943/?canisterId=x4hhs-wh777-77774-qaaka-cai';

      // 2. Register a new resource server specifically for this test case.
      authActor.setIdentity(developerIdentity);
      const rsResult = await authActor.register_resource_server({
        name: 'Local Dev Test Server',
        logo_uri: '',
        uris: [resourceUriWithQuery],
        initial_service_principal: Principal.fromText('aaaaa-aa'),
        scopes: [['openid', '...']],
        accepted_payment_canisters: [],
        frontend_host: toNullable('http://localhost:3000'),
      });
      if ('err' in rsResult) {
        throw new Error(
          `Test setup failed to register RS with query: ${rsResult.err}`,
        );
      }

      // 3. Prepare the authorization request.
      const pkce = await generatePkce();

      // CRITICAL: The `resource` parameter's value must be URL-encoded to be safely
      // transmitted as part of the parent URL's query string. This is the correct
      // client behavior.
      const encodedResource = encodeURIComponent(resourceUriWithQuery);

      const authUrl = `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${encodedResource}`;

      const authRequest: HttpRequest = {
        method: 'GET',
        url: authUrl,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };

      // ACT: Make the /authorize request.
      // This is the call that is currently failing.
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);

      // ASSERT: A successful validation should result in a 302 redirect to the login page.
      // If we get a 400, it means the resource URI validation failed.
      expect(authResponse.status_code).toBe(302);

      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      expect(locationHeader).toBeDefined();
      expect(locationHeader).toContain('/login'); // Or whatever your login path is
    });
  });

  describe('Refresh Token Grant', () => {
    // Helper to perform a full login flow and return the first set of tokens
    const getInitialTokens = async () => {
      const pkce = await generatePkce();
      const endUserIdentity = createIdentity('refresh-user');

      // 1. Start flow
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');

      // 2. Complete flow
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId!);
      const finalAuthResult = await authActor.complete_authorize(sessionId!);
      const finalRedirectUrl = new URL((finalAuthResult as { ok: string }).ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      // 3. Exchange code for tokens
      const tokenRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode!,
            redirect_uri: 'https://jwt.io',
            client_id: clientId,
            code_verifier: pkce.verifier,
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const tokenResponse = await authActor.http_request_update(tokenRequest);
      return JSON.parse(
        new TextDecoder().decode(tokenResponse.body as Uint8Array),
      );
    };

    it('should successfully exchange a refresh token for a new set of tokens', async () => {
      // Arrange: Get the initial set of tokens
      const initialTokenData = await getInitialTokens();
      const initialRefreshToken = initialTokenData.refresh_token;
      const initialAccessToken = initialTokenData.access_token;
      expect(initialRefreshToken).toBeDefined();

      // Act: Use the refresh token to get a new set of tokens
      const refreshRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: initialRefreshToken,
            client_id: clientId,
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const refreshResponse =
        await authActor.http_request_update(refreshRequest);

      // Assert: The refresh is successful and tokens are rotated
      expect(refreshResponse.status_code).toBe(200);
      const refreshedTokenData = JSON.parse(
        new TextDecoder().decode(refreshResponse.body as Uint8Array),
      );
      expect(refreshedTokenData.access_token).toBeDefined();
      expect(refreshedTokenData.refresh_token).toBeDefined();
      expect(refreshedTokenData.access_token).not.toEqual(initialAccessToken);
      expect(refreshedTokenData.refresh_token).not.toEqual(initialRefreshToken);
    });

    it('should reject a reused (rotated) refresh token', async () => {
      // Arrange: Get an initial token, then use the refresh token once to rotate it.
      const initialTokenData = await getInitialTokens();
      const firstRefreshToken = initialTokenData.refresh_token;

      const refreshRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: firstRefreshToken,
            client_id: clientId,
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const firstRefreshResponse =
        await authActor.http_request_update(refreshRequest);
      expect(firstRefreshResponse.status_code).toBe(200); // First use is successful

      // Act: Try to use the *original* refresh token again
      const secondRefreshResponse =
        await authActor.http_request_update(refreshRequest);

      // Assert: The second request must fail
      expect(secondRefreshResponse.status_code).toBe(400);
      const errorJson = JSON.parse(
        new TextDecoder().decode(secondRefreshResponse.body as Uint8Array),
      );
      expect(errorJson.error).toBe('invalid_grant');
      expect(errorJson.error_description).toContain('revoked');
    });

    it('should reject an expired authorization code', async () => {
      // Arrange: Get a valid authorization code
      const pkce = await generatePkce();
      const endUserIdentity = createIdentity('expired-user');

      // 1. Start and complete the flow to get a code
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId!);
      const finalAuthResult = await authActor.complete_authorize(sessionId!);
      const finalRedirectUrl = new URL((finalAuthResult as { ok: string }).ok);
      const authCode = finalRedirectUrl.searchParams.get('code');

      // Act 1: Instantly advance the IC's clock by 61 seconds, causing the code to expire.
      // This is the magic of PocketIC - no waiting required!
      await pic.advanceTime(61 * 1000); // 61 seconds in milliseconds

      // Act 2: Attempt to exchange the now-expired code
      const tokenRequest: HttpRequest = {
        method: 'POST',
        url: '/token',
        headers: [['Content-Type', 'application/x-www-form-urlencoded']],
        body: new TextEncoder().encode(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode!,
            redirect_uri: 'https://jwt.io',
            client_id: clientId,
            code_verifier: pkce.verifier,
          }).toString(),
        ),
      };
      authActor.setPrincipal(Principal.anonymous());
      const response = await authActor.http_request_update(tokenRequest);

      // Assert: The request must be rejected
      expect(response.status_code).toBe(400);
      const errorJson = JSON.parse(
        new TextDecoder().decode(response.body as Uint8Array),
      );
      expect(errorJson.error).toBe('invalid_grant');
    });
  });

  describe('Grant Management', () => {
    let endUserIdentity: Identity = createIdentity('grant-user');

    // Helper to perform a full login and create a grant
    const createGrant = async (scope: string) => {
      const pkce = await generatePkce();

      // 1. Start flow
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=${scope}&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');
      if (!sessionId) throw new Error('Failed to get session ID');

      // 2. Complete flow
      authActor.setIdentity(endUserIdentity);
      await authActor.confirm_login(sessionId);
      const finalAuthResult = await authActor.complete_authorize(sessionId);
      if ('err' in finalAuthResult) throw new Error('Auth flow failed');
    };

    it('should create, list, and revoke a grant through the full user lifecycle', async () => {
      // Arrange: The user has no grants initially
      authActor.setIdentity(endUserIdentity);
      const grantsBefore = await authActor.get_my_grants();
      expect(grantsBefore).toEqual([]);

      // Act 1: Perform a full, successful authorization flow to create the grant
      await createGrant('openid');

      // Assert 2: Verify the grant was created
      const grantsAfterCreate = await authActor.get_my_grants();
      expect(grantsAfterCreate).toHaveLength(1);
      expect(grantsAfterCreate[0]).toBe(resourceServerId);

      // Act 3: Revoke the grant
      const revokeResult = await authActor.revoke_grant(resourceServerId);
      expect(revokeResult).toHaveProperty('ok');
      expect((revokeResult as { ok: string }).ok).toContain('revoked');

      // Assert 4: Verify the grant was deleted
      const grantsAfterRevoke = await authActor.get_my_grants();
      expect(grantsAfterRevoke).toEqual([]);
    });
  });

  describe('Conditional Payment Flow', () => {
    it('should go directly to consent if `prometheus:charge` scope is NOT requested', async () => {
      const pkce = await generatePkce();
      const scope = 'openid';

      // Arrange: Start a flow without the charge scope
      const authRequest: HttpRequest = {
        method: 'GET',
        url: `/authorize?response_type=code&client_id=${clientId}&redirect_uri=https%3A%2F%2Fjwt.io&scope=${scope}&code_challenge=${pkce.challenge}&code_challenge_method=S256&resource=${resourceServerUri}`,
        headers: [['Host', authCanisterId.toText()]],
        body: new Uint8Array(),
      };
      authActor.setPrincipal(Principal.anonymous());
      const authResponse = await authActor.http_request_update(authRequest);
      const locationHeader =
        authResponse.headers.find(
          (h) => h[0].toLowerCase() === 'location',
        )?.[1] ?? '';
      const sessionId = new URL(locationHeader).searchParams.get('session_id');

      // Act: Confirm the login with a new user
      const endUserIdentity = createIdentity('end-user-consent');
      authActor.setIdentity(endUserIdentity);
      const confirmResult = await authActor.confirm_login(sessionId!);

      // Assert: The backend should direct the frontend to the #consent step
      expect(confirmResult).toHaveProperty('ok');
      const resultData = (confirmResult as { ok: any }).ok;
      expect(resultData.next_step).toEqual({ consent: null });
    });
  });
});
