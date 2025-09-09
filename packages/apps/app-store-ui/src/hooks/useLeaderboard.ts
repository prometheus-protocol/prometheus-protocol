// packages/hooks/src/useLeaderboard.ts

import { useQuery } from '@tanstack/react-query';
import {
  getUserLeaderboard,
  getServerLeaderboard,
  Leaderboard,
} from '@prometheus-protocol/ic-js';

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
