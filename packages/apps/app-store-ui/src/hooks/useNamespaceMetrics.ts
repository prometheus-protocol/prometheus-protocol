import { getNamespaceMetrics, UsageTracker } from '@prometheus-protocol/ic-js';
import { useQuery } from '@tanstack/react-query';

// Temporary type until we regenerate declarations
export interface NamespaceMetrics {
  namespace: string;
  total_invocations: bigint;
  total_tools: bigint;
  authenticated_unique_users: bigint;
  anonymous_invocations: bigint;
  total_instances: bigint;
}

/**
 * React Query hook to fetch usage metrics aggregated at the namespace level.
 * This shows total usage across all WASM versions and all user instances.
 */
export const useNamespaceMetrics = (namespace?: string) => {
  return useQuery<NamespaceMetrics | null>({
    queryKey: namespace
      ? ['namespaceMetrics', namespace]
      : ['namespaceMetrics', 'no-namespace'],
    queryFn: async (): Promise<NamespaceMetrics | null> => {
      if (!namespace) {
        return null;
      }

      try {
        const metrics = await getNamespaceMetrics(namespace);
        return (metrics as unknown as NamespaceMetrics) ?? null;
      } catch (error) {
        console.error('Error fetching namespace metrics:', error);
        return null;
      }
    },
    enabled: !!namespace,
    // Provide placeholder to prevent undefined issues
    placeholderData: null,
  });
};
