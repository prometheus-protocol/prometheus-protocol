import { Principal } from '@icp-sdk/core/principal';
import { getAppMetrics, UsageTracker } from '@prometheus-protocol/ic-js';
import { useQuery } from '@tanstack/react-query';

/**
 * React Query hook to fetch usage metrics for a specific app by its canister ID.
 */
export const useGetAppMetrics = (canisterId?: Principal) => {
  return useQuery<UsageTracker.AppMetrics | null>({
    queryKey: canisterId
      ? ['appMetrics', canisterId]
      : ['appMetrics', 'no-canister'],
    queryFn: async () => {
      if (!canisterId) {
        // Return null when no canister ID is provided instead of throwing
        return null;
      }

      const metrics = await getAppMetrics(canisterId);
      // Return null instead of undefined to satisfy React Query
      return metrics ?? null;
    },
    enabled: !!canisterId,
  });
};
