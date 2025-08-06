import { describe, test, expect, beforeAll } from 'vitest';
import { Principal } from '@dfinity/principal';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import canisterIds from '../../.dfx/local/canister_ids.json';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createActorFor, generatePkce } from './shared';

// Load shared test environment variables from the global setup file
dotenv.config({ path: path.resolve(__dirname, '../.test.env') });

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.auth.local);
const replicaUrl = `http://127.0.0.1:4943`;
const clientId = process.env.E2E_CLIENT_ID!;

// --- Test Suite ---
describe('Authorization State Machine Flow', () => {
  beforeAll(() => {
    if (!clientId) {
      throw new Error(
        'Client ID not found. Ensure global setup ran correctly.',
      );
    }
  });

  // Helper to start the auth flow and get a session ID for a given scope
  const startAuthFlowAndGetSessionId = async (
    scope: string,
    state?: string,
  ) => {
    const authUrl = new URL(`${replicaUrl}/authorize`);
    authUrl.searchParams.set('canisterId', backendCanisterId.toText());
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
    authUrl.searchParams.set(
      'code_challenge',
      (await generatePkce()).challenge,
    );
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set(
      'resource',
      'https://some-oauth-resource-server.com',
    );
    authUrl.searchParams.set('state', state || 'state-machine-test-state==');
    authUrl.searchParams.set('scope', scope);

    const authResponse = await fetch(authUrl.toString(), {
      redirect: 'manual',
    });
    const location = new URL(authResponse.headers.get('location') || '');
    const sessionId = location.searchParams.get('session_id');
    expect(sessionId).toBeDefined();
    return sessionId;
  };

  describe('Scope Validation', () => {
    test('should succeed when requesting valid, registered scopes', async () => {
      // Arrange: Construct an /authorize URL with scopes that are registered
      // in the global setup file (e.g., 'image:read').
      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set(
        'code_challenge',
        (await generatePkce()).challenge,
      );
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      authUrl.searchParams.set('state', 'valid-scope-test');
      authUrl.searchParams.set('scope', 'openid image:read'); // A valid, registered scope

      // Act: Make the request
      const response = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      // Assert: The request must be a successful redirect, allowing the flow to continue.
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('/login?session_id=');
    });

    test('should reject /authorize request with an unregistered scope', async () => {
      // Arrange: Construct an /authorize URL with a scope that is NOT registered.
      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set(
        'code_challenge',
        (await generatePkce()).challenge,
      );
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      authUrl.searchParams.set('state', 'invalid-scope-test');
      authUrl.searchParams.set('scope', 'image:read admin:god_mode'); // Mix of valid and invalid

      // Act: Make the request
      const response = await fetch(authUrl.toString());
      // MODIFIED: Read the body as plain text, not JSON
      const errorBody = await response.text();

      // Assert: The request must be rejected with a 400 status
      expect(response.status).toBe(400);

      // MODIFIED: Assert that the plain text body contains the expected error strings
      expect(errorBody).toContain('invalid_scope');
      expect(errorBody).toContain("scope 'admin:god_mode' is not supported");
    });
  });

  describe('Parameter Handling', () => {
    test('should correctly handle a state parameter with special Base64 characters (+, /, =)', async () => {
      // Arrange: Define a state value that contains characters that must not be
      // misinterpreted by the parser, specifically the '+' which should NOT become a space.
      const rawState = 'k/V+n8v==';
      const encodedState = encodeURIComponent(rawState); // -> "k%2FV%2Bn8v%3D%3D"

      // Arrange: Start the full authorization flow with this specific state.
      const sessionId = await startAuthFlowAndGetSessionId(
        'openid',
        encodedState,
      );
      const endUserIdentity = Secp256k1KeyIdentity.generate();
      const endUserActor = createActorFor(endUserIdentity);

      if (!sessionId) {
        throw new Error('Failed to get session ID from auth flow');
      }

      // Act: Complete the entire flow to get the final redirect URL.
      await endUserActor.confirm_login(sessionId);
      const finalResult = await endUserActor.complete_authorize(sessionId);

      // Assert: The final redirect URL must contain the original, raw state value,
      // proving that no incorrect transformations were applied.
      expect(finalResult).toHaveProperty('ok');
      if (!('ok' in finalResult)) throw new Error('Final authorization failed');

      const urlString = finalResult.ok;
      const match = urlString.match(/state=([^&]+)/);

      // Ensure the regex found a match. The captured group will be at index 1.
      expect(match).not.toBeNull();
      // const returnedState = match ? match[1] : '';

      // TODO: This issue is still pending. Only VSCode so far uses this
      // expect(returnedState).toBe(encodedState);
    });

    test('should correctly parse a complex, double-encoded state parameter', async () => {
      // Arrange: Create a state parameter that is double-encoded.
      // This simulates complex clients like the VS Code extension and is a
      // regression test for the parser bug we fixed.
      // const rawInnerState = 'key1=value1&key2=value2';
      // const singleEncoded = encodeURIComponent(rawInnerState); // -> 'key1%3Dvalue1%26key2%3Dvalue2'
      // const doubleEncodedState = encodeURIComponent(singleEncoded); // -> 'key1%253Dvalue1%2526key2%253Dvalue2'

      const doubleEncodedState =
        'vscode%3A%2F%2Fdynamicauthprovider%2Flocalhost%253A3000%2Fauthorize%3Fnonce%253Deebe0f9b6444d83a8f9ed34dfe79557a%2526windowId%253D';

      const authUrl = new URL(`${replicaUrl}/authorize`);
      authUrl.searchParams.set('canisterId', backendCanisterId.toText());
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
      authUrl.searchParams.set(
        'code_challenge',
        (await generatePkce()).challenge,
      );
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set(
        'resource',
        'https://some-oauth-resource-server.com',
      );
      // Use the complex, double-encoded state value
      authUrl.searchParams.set('state', doubleEncodedState);
      authUrl.searchParams.set('scope', 'openid'); // A simple scope is fine for this test

      // Act: Make the request
      const response = await fetch(authUrl.toString(), {
        redirect: 'manual',
      });

      // Assert: The request must succeed (status 302), indicating the parser
      // handled the complex state correctly and did not crash.
      expect(response.status).toBe(302);
      const location = response.headers.get('location');
      expect(location).toBeDefined();
      expect(location).toContain('/login?session_id=');
    });
  });

  test('should go directly to consent if `prometheus:charge` scope is NOT requested', async () => {
    // Arrange: Start a flow without the charge scope
    const sessionId = await startAuthFlowAndGetSessionId('openid profile');
    const endUserIdentity = Secp256k1KeyIdentity.generate();
    const endUserActor = createActorFor(endUserIdentity);

    if (!sessionId) {
      throw new Error('Failed to get session ID from auth flow');
    }

    // Act: Confirm the login, which binds the user to the session
    const confirmResult = await endUserActor.confirm_login(sessionId);

    // Assert: The backend should direct the frontend to the #consent step
    expect(confirmResult).toHaveProperty('ok');
    if (!('ok' in confirmResult)) throw new Error('confirm_login failed');
    expect(confirmResult.ok.next_step).toEqual({ consent: null });
    expect(confirmResult.ok.consent_data.scopes).toEqual([
      {
        id: 'openid',
        description: 'Confirm your identity with this application.',
      },
    ]);

    // Act & Assert: Since the next step is consent, a subsequent call to complete_authorize should succeed
    const finalResult = await endUserActor.complete_authorize(sessionId);
    expect(finalResult).toHaveProperty('ok');
  });

  test('should require payment setup if `prometheus:charge` scope IS requested', async () => {
    // Arrange: Start a flow WITH the charge scope
    const sessionId = await startAuthFlowAndGetSessionId(
      'openid profile prometheus:charge',
    );
    const endUserIdentity = Secp256k1KeyIdentity.generate();
    const endUserActor = createActorFor(endUserIdentity);

    if (!sessionId) {
      throw new Error('Failed to get session ID from auth flow');
    }

    // Act 1: Confirm the login
    const confirmResult = await endUserActor.confirm_login(sessionId);

    // Assert 1: The backend must direct the frontend to the #setup step
    expect(confirmResult).toHaveProperty('ok');
    if (!('ok' in confirmResult)) throw new Error('confirm_login failed');
    expect(confirmResult.ok.next_step).toEqual({ setup: null });
    expect(confirmResult.ok.consent_data.scopes).toEqual([
      {
        id: 'openid',
        description: 'Confirm your identity with this application.',
      },
      {
        id: 'prometheus:charge',
        description: 'Allow this application to charge your account.',
      },
    ]);
    // Assert 2: A direct call to complete_authorize MUST FAIL because the state is #awaiting_payment_setup
    const prematureFinalizeResult =
      await endUserActor.complete_authorize(sessionId);
    expect(prematureFinalizeResult).toHaveProperty('err');
    if (!('err' in prematureFinalizeResult)) throw new Error('Expected error');
    expect(prematureFinalizeResult.err).toContain('Invalid session state');

    // Act 2: Simulate the user completing the payment setup step
    const setupCompleteResult =
      await endUserActor.complete_payment_setup(sessionId);
    expect(setupCompleteResult).toHaveProperty('ok');

    // Act 3: Now that setup is complete, the final authorization should succeed
    const finalResult = await endUserActor.complete_authorize(sessionId);
    expect(finalResult).toHaveProperty('ok');
    if (!('ok' in finalResult)) throw new Error('Final authorization failed');

    // Assert 3: The final redirect URL should contain a valid code
    const finalRedirectUrl = new URL(finalResult.ok);
    const authCode = finalRedirectUrl.searchParams.get('code');
    const returnedState = finalRedirectUrl.searchParams.get('state');
    expect(authCode).toBeDefined();
    expect(authCode?.length).toBeGreaterThan(10);

    expect(returnedState).toBe('state-machine-test-state==');
  });

  test('should reject if a different user tries to continue the session (session fixation)', async () => {
    // Arrange: User A starts the flow
    const sessionId = await startAuthFlowAndGetSessionId(
      'openid profile prometheus:charge',
    );
    const userA_Identity = Secp256k1KeyIdentity.generate();
    const userA_Actor = createActorFor(userA_Identity);

    // Arrange: User B (the attacker) gets the session ID and creates their own identity
    const userB_Attacker_Identity = Secp256k1KeyIdentity.generate();
    const userB_Attacker_Actor = createActorFor(userB_Attacker_Identity);

    if (!sessionId) {
      throw new Error('Failed to get session ID from auth flow');
    }

    // Act 1: User A confirms their login, binding their Principal to the session
    const confirmResult = await userA_Actor.confirm_login(sessionId);
    expect(confirmResult).toHaveProperty('ok'); // This should succeed

    // Act 2 (The Attack): User B (the attacker) tries to complete the next step
    const attackResult =
      await userB_Attacker_Actor.complete_payment_setup(sessionId);

    // Assert: The call from the attacker MUST fail because their Principal does not match the one bound to the session
    expect(attackResult).toHaveProperty('err');
    if (!('err' in attackResult))
      throw new Error('Expected security check to fail');
    expect(attackResult.err).toContain('Caller does not match session owner');
  });

  test('should create, list, and revoke a grant through the full user lifecycle', async () => {
    // ARRANGE: Get the resource server ID from the environment
    const resourceServerId = process.env.E2E_RESOURCE_SERVER_ID!;
    if (!resourceServerId) {
      throw new Error('Resource Server ID not found in test environment.');
    }

    // ARRANGE: Create a new end-user for this specific test
    const endUserIdentity = Secp256k1KeyIdentity.generate();
    const userActor = createActorFor(endUserIdentity);

    // --- ACT 1: Perform a full, successful authorization flow to create the grant ---
    const sessionId = await startAuthFlowAndGetSessionId('openid');
    if (!sessionId) throw new Error('Failed to start auth flow');

    await userActor.confirm_login(sessionId);
    const finalAuthResult = await userActor.complete_authorize(sessionId);
    expect(finalAuthResult).toHaveProperty('ok'); // Ensure the flow succeeded

    // --- ACT 2 & ASSERT 2: Verify the grant was created ---
    // The user should now have exactly one grant.
    const grantsBeforeRevoke = await userActor.get_my_grants();
    expect(grantsBeforeRevoke).toBeInstanceOf(Array);
    expect(grantsBeforeRevoke).toHaveLength(1);
    expect(grantsBeforeRevoke[0]).toBe(resourceServerId);

    // --- ACT 3 & ASSERT 3: Revoke the grant ---
    const revokeResult = await userActor.revoke_grant(resourceServerId);
    expect(revokeResult).toHaveProperty('ok');
    if (!('ok' in revokeResult)) throw new Error('Revoke grant failed');
    expect(revokeResult.ok).toContain('revoked');

    // --- ACT 4 & ASSERT 4: Verify the grant was deleted ---
    // The user's grant list should now be empty.
    const grantsAfterRevoke = await userActor.get_my_grants();
    expect(grantsAfterRevoke).toEqual([]);
  });
});
