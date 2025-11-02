import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import {
  Registry,
  Orchestrator,
  Ledger,
  AuditHub,
  Auth,
  AppBounties,
  Leaderboard,
  McpServer,
  SearchIndex,
  UsageTracker,
  TokenWatchlist,
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
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  // In v3, use HttpAgent.createSync with shouldFetchRootKey for local development
  // This will fetch the root key before the first request is made
  const agent = HttpAgent.createSync({
    host,
    identity,
    shouldFetchRootKey: isLocal,
  });

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
export const getAuditHubActor = (identity?: Identity) => {
  return createActor<AuditHub._SERVICE>(
    AuditHub.idlFactory,
    getCanisterId('AUDIT_HUB'),
    identity,
  );
};

/**
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getAppBountiesActor = (identity?: Identity) => {
  return createActor<AppBounties._SERVICE>(
    AppBounties.idlFactory,
    getCanisterId('APP_BOUNTIES'),
    identity,
  );
};

export const getLeaderboardActor = (identity?: Identity) => {
  return createActor<Leaderboard._SERVICE>(
    Leaderboard.idlFactory,
    getCanisterId('LEADERBOARD'),
    identity,
  );
};

/**
 * @param canisterId The canister ID of the MCP Server canister to connect to
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getMcpServerActor = (
  canisterId: Principal,
  identity?: Identity,
) => {
  return createActor<McpServer._SERVICE>(
    McpServer.idlFactory,
    canisterId.toText(),
    identity,
  );
};

/**
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getSearchIndexActor = (identity?: Identity) => {
  return createActor<SearchIndex._SERVICE>(
    SearchIndex.idlFactory,
    getCanisterId('SEARCH_INDEX'),
    identity,
  );
};

/**
 * @param identity Optional identity to use for the actor
 * @returns
 */
export const getUsageTrackerActor = (identity?: Identity) => {
  return createActor<UsageTracker._SERVICE>(
    UsageTracker.idlFactory,
    getCanisterId('USAGE_TRACKER'),
    identity,
  );
};

export const getTokenWatchlistActor = (identity: Identity) => {
  return createActor<TokenWatchlist._SERVICE>(
    TokenWatchlist.idlFactory,
    getCanisterId('TOKEN_WATCHLIST'),
    identity,
  );
};
