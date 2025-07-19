import { HttpAgent, Identity } from '@dfinity/agent';

// Import our backend's service definition and idlFactory
import { _SERVICE as AuthService } from '../../../declarations/oauth_backend/oauth_backend.did.js';
import { createActor as createOAuthActor } from '../../../declarations/oauth_backend/index.js';

// Import an ICRC token's service definition and idlFactory
import { _SERVICE as ICRCService } from '../../../declarations/icrc1_ledger/icrc1_ledger.did.js';
import { createActor as createIcrcActor } from '../../../declarations/icrc1_ledger/index.js';

const OAUTH_CANISTER_ID = process.env.CANISTER_ID_OAUTH_BACKEND;
const CKUSDC_CANISTER_ID = process.env.CANISTER_ID_ICRC1_LEDGER;

/**
 * Creates a typed actor for the Oauth Backend canister.
 * @param agent The agent (authenticated or unauthenticated) to use for creating the actor.
 * @returns A typed actor instance.
 */
export const getAuthActor = (identity: Identity): AuthService => {
  const agent = HttpAgent.createSync({
    host: process.env.IC_HOST,
    identity,
  });
  return createOAuthActor(OAUTH_CANISTER_ID, {
    agent,
  });
};

/**
 * Creates a typed actor for an ICRC-1 compliant token canister.
 * @param agent The agent to use for creating the actor.
 * @returns A typed actor instance for the ckUSDC ledger.
 */
export const getIcrcActor = (identity: Identity): ICRCService => {
  const agent = HttpAgent.createSync({
    host: process.env.IC_HOST,
    identity,
  });
  return createIcrcActor(CKUSDC_CANISTER_ID, {
    agent,
  });
};
