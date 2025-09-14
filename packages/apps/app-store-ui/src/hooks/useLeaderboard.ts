// packages/hooks/src/useLeaderboard.ts

import { useQuery } from '@tanstack/react-query';
import {
  getUserLeaderboard,
  getServerLeaderboard,
  Leaderboard,
  getToolInvocationsForServer,
} from '@prometheus-protocol/ic-js';
import { Principal } from '@dfinity/principal';

/**
 * React Query hook to fetch the ranked list of top users.
 * This is used for the "Top Users" tab on the leaderboard page.
 */
export const useGetUserLeaderboard = () => {
  return useQuery<Leaderboard.UserLeaderboardEntry[]>({
    // A simple, unique key for this query.
    queryKey: ['userLeaderboard'],
    queryFn: async () => {
      return getUserLeaderboard();
    },
  });
};

/**
 * React Query hook to fetch the ranked list of top servers.
 * This is used for the "Top Servers" tab on the leaderboard page.
 */
export const useGetServerLeaderboard = () => {
  return useQuery<Leaderboard.ServerLeaderboardEntry[]>({
    // A unique key for the server leaderboard query.
    queryKey: ['serverLeaderboard'],
    queryFn: async () => {
      return getServerLeaderboard();
    },
  });
};

/**
 * A React Query hook to fetch tool invocation counts for a specific server.
 * @param canisterId The Principal of the server canister. Can be null if not yet known.
 */
export const useGetToolInvocations = (canisterId: Principal | null) => {
  return useQuery({
    // The query key includes the canisterId to ensure data is cached per-server.
    queryKey: ['toolInvocations', canisterId?.toText()],
    queryFn: () => {
      if (!canisterId) {
        // If there's no canisterId, we can't fetch, so return an empty map.
        return new Map<string, bigint>();
      }
      return getToolInvocationsForServer(canisterId);
    },
    // This query is only enabled if the canisterId is actually provided.
    enabled: !!canisterId,
  });
};
