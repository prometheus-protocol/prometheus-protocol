import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import {
  Registry,
  Orchestrator,
  Ledger,
  Credentials,
  Auth,
} from '@prometheus-protocol/declarations';
import { getCanisterId } from './config';

// --- STEP 1: Create a generic, robust Actor Factory ---
// This single function replaces ALL the dfx-generated `createActor` helpers.
const createActor = <T>(
  idlFactory: any,
  canisterId: string,
  identity?: Identity,
): T => {
  const agent = new HttpAgent({
    host:
      process.env.DFX_NETWORK === 'ic'
        ? 'https://icp-api.io'
        : 'http://127.0.0.1:4943',
    identity,
  });

  // Only fetch the root key for local development
  if (process.env.DFX_NETWORK !== 'ic') {
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

// --- STEP 3: Re-implement your actor getters to use the new system ---
// This is now clean, explicit, and fully controlled by you.

export const getRegistryActor = (identity?: Identity) => {
  return createActor<Registry._SERVICE>(
    Registry.idlFactory,
    getCanisterId('MCP_REGISTRY'),
    identity,
  );
};

export const getOrchestratorActor = (identity?: Identity) => {
  return createActor<Orchestrator._SERVICE>(
    Orchestrator.idlFactory,
    getCanisterId('MCP_ORCHESTRATOR'),
    identity,
  );
};

export const getAuthActor = (identity?: Identity) => {
  return createActor<Auth._SERVICE>(
    Auth.idlFactory,
    getCanisterId('AUTH_SERVER'),
    identity,
  );
};

export const getIcrcActor = (canisterId: Principal, identity?: Identity) => {
  return createActor<Ledger._SERVICE>(
    Ledger.idlFactory,
    canisterId.toText(),
    identity,
  );
};

export const getCredentialsActor = (identity?: Identity) => {
  return createActor<Credentials._SERVICE>(
    Credentials.idlFactory,
    getCanisterId('AUDITOR_CREDENTIALS'),
    identity,
  );
};
