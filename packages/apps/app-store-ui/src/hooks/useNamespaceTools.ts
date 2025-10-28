import { getNamespaceTools, UsageTracker } from '@prometheus-protocol/ic-js';
import { useQuery } from '@tanstack/react-query';

/**
 * React Query hook to fetch tool-level invocation metrics aggregated at the namespace level.
 * This shows tool usage across all WASM versions and all user instances.
 */
export const useNamespaceTools = (namespace?: string) => {
  return useQuery<UsageTracker.ToolMetrics[]>({
    queryKey: namespace
      ? ['namespaceTools', namespace]
      : ['namespaceTools', 'no-namespace'],
    queryFn: async () => {
      if (!namespace) {
        return [];
      }

      try {
        const tools = await getNamespaceTools(namespace);
        return tools ?? [];
      } catch (error) {
        console.error('Error fetching namespace tools:', error);
        return [];
      }
    },
    enabled: !!namespace,
  });
};
