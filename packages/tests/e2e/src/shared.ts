import { HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import * as jose from 'jose';
import canisterIds from '../../../../.dfx/local/canister_ids.json';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { createActor } from '@declarations/auth_server';

// --- Test Configuration ---
const backendCanisterId = Principal.fromText(canisterIds.auth_server.local);
const replicaUrl = `http://127.0.0.1:4943`;

// --- Helper Functions ---
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

// NEW: A robust helper to execute the entire state machine flow
export const executeFullLoginFlow = async (scope: string, clientId: string) => {
  // 1. Start the flow and get a session ID
  const pkce = await generatePkce();
  const authUrl = new URL(`${replicaUrl}/authorize`);
  authUrl.searchParams.set('canisterId', backendCanisterId.toText());
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', 'https://jwt.io');
  authUrl.searchParams.set('code_challenge', pkce.challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set(
    'resource',
    'https://some-oauth-resource-server.com',
  );
  authUrl.searchParams.set('state', 'a-random-state-string-123');
  authUrl.searchParams.set('scope', scope);

  const authResponse = await fetch(authUrl.toString(), { redirect: 'manual' });
  const location = new URL(authResponse.headers.get('location') || '');
  const sessionId = location.searchParams.get('session_id');
  if (!sessionId) throw new Error('Failed to get session ID');

  // 2. Simulate the user logging in and calling the state machine functions
  const endUserIdentity = Secp256k1KeyIdentity.generate();
  const endUserActor = createActorFor(endUserIdentity);

  // 2a. Confirm login
  const confirmResult = await endUserActor.confirm_login(sessionId);
  if ('err' in confirmResult)
    throw new Error(`confirm_login failed: ${confirmResult.err}`);

  // 2c. Complete the final authorization step
  const completeAuthResult = await endUserActor.complete_authorize(sessionId);
  if ('err' in completeAuthResult)
    throw new Error(`complete_authorize failed: ${completeAuthResult.err}`);

  // 3. Extract and return the auth code and other necessary data
  const finalRedirectUrl = new URL(completeAuthResult.ok);
  const authCode = finalRedirectUrl.searchParams.get('code');
  if (!authCode) throw new Error('Failed to get auth code from final redirect');

  return { authCode, pkce, endUserIdentity };
};

export const createActorFor = (identity: Identity) => {
  const agent = new HttpAgent({
    host: replicaUrl,
    identity,
  });
  return createActor(backendCanisterId, { agent });
};
