import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import {
  Registry,
  Orchestrator,
  Ledger,
  Credentials,
  Auth,
} from '@prometheus-protocol/declarations';
import { getCanisterId, getHost } from './config.js';

/**
 * A generic function to create an actor for any canister.
 * @param idlFactory The IDL factory for the canister
 * @param canisterId The canister ID to connect to
 * @param identity Optional identity to use for the actor
 * @returns An actor instance for the specified canister
 */
const createActor = <T>(
  idlFactory: any,
  canisterId: string,
  identity?: Identity,
): T => {
  const host = getHost();
  const agent = new HttpAgent({
    host,
    identity,
  });

  // Only fetch the root key for local development
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    agent.fetchRootKey().catch((err) => {
      console.warn(
        'Unable to fetch root key. Check to ensure that your local replica is running',
      );
      console.error(err);
    });
  }

  return Actor.createActor<T>(idlFactory, {
    agent,
    canisterId,
  });
};

/**
 * These functions create actors for each canister, using the generic factory above.
 */
export const getRegistryActor = (identity?: Identity) => {
  return createActor<Registry._SERVICE>(
    Registry.idlFactory,
    getCanisterId('MCP_REGISTRY'),
    identity,
  );
};

/**
 *
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getOrchestratorActor = (identity?: Identity) => {
  return createActor<Orchestrator._SERVICE>(
    Orchestrator.idlFactory,
    getCanisterId('MCP_ORCHESTRATOR'),
    identity,
  );
};

/**
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getAuthActor = (identity?: Identity) => {
  return createActor<Auth._SERVICE>(
    Auth.idlFactory,
    getCanisterId('AUTH_SERVER'),
    identity,
  );
};

/**
 * @param canisterId The canister ID of the Ledger canister to connect to
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getIcrcActor = (canisterId: Principal, identity?: Identity) => {
  return createActor<Ledger._SERVICE>(
    Ledger.idlFactory,
    canisterId.toText(),
    identity,
  );
};

/**
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getCredentialsActor = (identity?: Identity) => {
  return createActor<Credentials._SERVICE>(
    Credentials.idlFactory,
    getCanisterId('AUDIT_HUB'),
    identity,
  );
};
