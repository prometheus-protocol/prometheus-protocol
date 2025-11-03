import { Principal } from '@icp-sdk/core/principal';
import { getAppMetrics, UsageTracker } from '@prometheus-protocol/ic-js';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Aggregated metrics that combine data across all WASM versions of an app
 */
export interface AggregatedAppMetrics {
  authenticated_unique_users: bigint;
  anonymous_invocations: bigint;
  total_tools: bigint;
  total_invocations: bigint;
}

/**
 * React Query hook to fetch and aggregate usage metrics across all WASM versions
 * of an app. Since metrics are currently tracked per-canister (WASM), this hook
 * fetches metrics for each canister and combines them.
 *
 * @param canisterIds - Array of canister IDs (one per WASM version)
 * @returns Aggregated metrics across all versions, or null if no data
 */
export const useAggregatedAppMetrics = (
  canisterIds: Principal[] | undefined,
): {
  data: AggregatedAppMetrics | null;
  isLoading: boolean;
  isError: boolean;
} => {
  // Use useQueries to fetch metrics for all canisters in parallel
  const metricsQueries = useQueries({
    queries: (canisterIds ?? []).filter(Boolean).map((canisterId) => ({
      queryKey: ['appMetrics', canisterId?.toText()],
      queryFn: async (): Promise<UsageTracker.AppMetrics | null> => {
        const metrics = await getAppMetrics(canisterId);
        return metrics ?? null;
      },
      enabled: !!canisterId,
    })),
  });

  // Aggregate the results
  const aggregatedData = useMemo(() => {
    // If no canisters provided, return null
    if (!canisterIds || canisterIds.length === 0) {
      return null;
    }

    // If any query is still loading, we're not ready yet
    const isLoading = metricsQueries.some((q) => q.isLoading);
    if (isLoading) {
      return null;
    }

    // Collect all successful metric results
    const allMetrics = metricsQueries
      .map((q) => q.data)
      .filter((data): data is UsageTracker.AppMetrics => data !== null);

    // If we have no data at all, return null
    if (allMetrics.length === 0) {
      return null;
    }

    // Aggregate the metrics
    // Note: For unique users, we're summing across versions which may count
    // the same user multiple times if they used different versions.
    // This is a limitation until backend tracks at namespace level.
    const aggregated: AggregatedAppMetrics = {
      authenticated_unique_users: allMetrics.reduce(
        (sum, m) => sum + m.authenticated_unique_users,
        0n,
      ),
      anonymous_invocations: allMetrics.reduce(
        (sum, m) => sum + m.anonymous_invocations,
        0n,
      ),
      total_tools: allMetrics.reduce((sum, m) => sum + m.total_tools, 0n),
      total_invocations: allMetrics.reduce(
        (sum, m) => sum + m.total_invocations,
        0n,
      ),
    };

    return aggregated;
  }, [canisterIds, metricsQueries]);

  const isLoading = metricsQueries.some((q) => q.isLoading);
  const isError = metricsQueries.some((q) => q.isError);

  return {
    data: aggregatedData,
    isLoading,
    isError,
  };
};
