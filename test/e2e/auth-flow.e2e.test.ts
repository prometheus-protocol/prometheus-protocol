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
const backendCanisterId = Principal.fromText(canisterIds.oauth_backend.local);
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
  const startAuthFlowAndGetSessionId = async (scope: string) => {
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
    authUrl.searchParams.set('state', 'state-machine-test-state');
    authUrl.searchParams.set('scope', scope);

    const authResponse = await fetch(authUrl.toString(), {
      redirect: 'manual',
    });
    const location = new URL(authResponse.headers.get('location') || '');
    const sessionId = location.searchParams.get('session_id');
    expect(sessionId).toBeDefined();
    return sessionId;
  };

  test('should reject /authorize request without a state parameter', async () => {
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
    // 'state' parameter is intentionally omitted

    const response = await fetch(authUrl.toString());
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain('state is required');
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
    expect(confirmResult.ok.consent_data.scope).toBe('openid profile');

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
    expect(confirmResult.ok.consent_data.scope).toContain('prometheus:charge');

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
    expect(authCode).toBeDefined();
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
});
