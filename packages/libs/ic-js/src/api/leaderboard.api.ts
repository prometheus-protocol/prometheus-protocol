// packages/ic-js/src/leaderboard.api.ts

import { Identity } from '@dfinity/agent';
import { getLeaderboardActor } from '../actors.js';
import { Leaderboard } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';
import { processToolInvocation } from '../utils.js';

export type { Leaderboard };

/**
 * Fetches the ranked list of top users by total invocations.
 * This is a public, unauthenticated call that reads from the pre-computed state.
 * @returns An array of UserLeaderboardEntry objects, sorted by rank.
 */
export const getUserLeaderboard = async (): Promise<
  Leaderboard.UserLeaderboardEntry[]
> => {
  // Note: This actor does not require an identity for public query calls.
  const leaderboardActor = getLeaderboardActor();
  const result = await leaderboardActor.get_user_leaderboard();
  return result;
};

/**
 * Fetches the ranked list of top servers by total invocations.
 * This is a public, unauthenticated call that reads from the pre-computed state.
 * @returns An array of ServerLeaderboardEntry objects, sorted by rank.
 */
export const getServerLeaderboard = async (): Promise<
  Leaderboard.ServerLeaderboardEntry[]
> => {
  const leaderboardActor = getLeaderboardActor();
  const result = await leaderboardActor.get_server_leaderboard();
  return result;
};

/**
 * Fetches the timestamp of the last successful leaderboard aggregation.
 * This is a public, unauthenticated call.
 * @returns A bigint representing the timestamp in nanoseconds.
 */
export const getLastUpdated = async (): Promise<bigint> => {
  const leaderboardActor = getLeaderboardActor();
  const result = await leaderboardActor.get_last_updated();
  return result;
};

/**
 * Manually triggers the aggregation process on the canister.
 * This will cause the leaderboard canister to fetch the latest data from the
 * usage_tracker and re-compute the rankings.
 * Requires an owner identity.
 * @param identity The owner's identity.
 */
export const triggerManualUpdate = async (
  identity: Identity,
): Promise<void> => {
  const leaderboardActor = getLeaderboardActor(identity);
  const result = await leaderboardActor.trigger_manual_update();

  if ('err' in result) {
    throw new Error(`Failed to trigger update: ${result.err}`);
  }
};

// Define the shape of the returned data
export interface ToolInvocationRecord {
  toolName: string;
  count: bigint;
}

/**
 * Fetches the invocation counts for all tools of a specific server canister.
 * @param wasmId The Principal of the server canister.
 * @returns A map of tool names to their invocation counts.
 */
export const getToolInvocationsForServer = async (
  wasmId: string,
): Promise<Map<string, bigint>> => {
  const actor = getLeaderboardActor();
  const records = await actor.get_tool_invocations_for_server(wasmId);

  const invocationMap = new Map<string, bigint>();
  for (const [toolName, count] of records) {
    invocationMap.set(toolName, count);
  }

  return invocationMap;
};
