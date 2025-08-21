import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import {
  Registry,
  Orchestrator,
  Ledger,
  Credentials,
  Auth,
} from '@prometheus-protocol/declarations';

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

// --- STEP 2: Create a helper to get canister IDs from a reliable source ---
// This is much better than relying on dfx's process.env injection.
const getCanisterId = (name: string): string => {
  const canisterId =
    process.env[`PROMETHEUS_CANISTER_ID_${name.toUpperCase()}`] ??
    process.env[`CANISTER_ID_${name.toUpperCase()}`]; // Support dfx's default for local dev

  if (!canisterId) {
    throw new Error(
      `Cannot find canister ID for '${name}'. Please set the 'CANISTER_ID_${name.toUpperCase()}' environment variable.`,
    );
  }
  return canisterId;
};

// --- STEP 3: Re-implement your actor getters to use the new system ---
// This is now clean, explicit, and fully controlled by you.

export const getRegistryActor = (identity?: Identity) => {
  return createActor<Registry._SERVICE>(
    Registry.idlFactory,
    getCanisterId('mcp_registry'),
    identity,
  );
};

export const getOrchestratorActor = (identity?: Identity) => {
  return createActor<Orchestrator._SERVICE>(
    Orchestrator.idlFactory,
    getCanisterId('mcp_orchestrator'),
    identity,
  );
};

export const getAuthActor = (identity?: Identity) => {
  return createActor<Auth._SERVICE>(
    Auth.idlFactory,
    getCanisterId('auth_server'),
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
    getCanisterId('auditor_credentials'),
    identity,
  );
};
