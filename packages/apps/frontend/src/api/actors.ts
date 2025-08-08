import { HttpAgent, Identity } from '@dfinity/agent';

// Import our backend's service definition and idlFactory
import { _SERVICE as AuthService } from '@declarations/auth_server/auth_server.did.js';
import { createActor as createOAuthActor } from '@declarations/auth_server/index.js';

// Import an ICRC token's service definition and idlFactory
import { _SERVICE as ICRCService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import { createActor as createIcrcActor } from '@declarations/icrc1_ledger/index.js';
import { Principal } from '@dfinity/principal';

const OAUTH_CANISTER_ID = process.env.CANISTER_ID_AUTH!;

console.log('process.env.DFX_NETWORK:', process.env.DFX_NETWORK);

const isDevelopment = process.env.NODE_ENV !== 'production';

// The host should be the URL of your frontend, NOT the replica URL
const host = isDevelopment ? 'http://localhost:3000' : 'https://icp-api.io';

/**
 * Creates a typed actor for the Oauth Backend canister.
 * @param agent The agent (authenticated or unauthenticated) to use for creating the actor.
 * @returns A typed actor instance.
 */
export const getAuthActor = (identity: Identity): AuthService => {
  const agent = HttpAgent.createSync({
    host,
    identity,
  });
  return createOAuthActor(OAUTH_CANISTER_ID, {
    agent,
  });
};

/**
 * Creates a typed actor for an ICRC-1 compliant token canister.
 * @param agent The agent to use for creating the actor.
 * @param canisterId The Principal ID of the ICRC-1 token canister.
 * @returns A typed actor instance for the ckUSDC ledger.
 */
export const getIcrcActor = (
  identity: Identity,
  canisterId: Principal,
): ICRCService => {
  const agent = HttpAgent.createSync({
    host,
    identity,
  });
  return createIcrcActor(canisterId, {
    agent,
  });
};
