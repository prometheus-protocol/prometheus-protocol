import {
  getServerCanisterId,
  provisionInstance,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Principal } from '@icp-sdk/core/principal';
import useMutation from './useMutation';
import { useQuery } from '@tanstack/react-query';

/**
 * React Query mutation hook to provision a new instance of an MCP server.
 * This is used for "provisioned" apps where users get their own private instance.
 * For existing instances, this will upgrade them to the new WASM version.
 */
export const useProvisionInstance = (namespace?: string) => {
  const { identity } = useInternetIdentity();

  return useMutation<{ namespace: string; wasmId: string }, Principal>({
    mutationFn: async ({ namespace, wasmId }) => {
      if (!identity) {
        throw new Error('User must be authenticated to provision an instance');
      }
      return provisionInstance(identity, namespace, wasmId);
    },
    successMessage:
      'Operation completed successfully! Your private canister is ready.',
    errorMessage: 'Failed to complete operation',
    queryKeysToRefetch: [
      ['appDetails', namespace],
      ['serverCanisterId', namespace],
      ['canisterWasmHash'], // This will be supplemented by specific invalidation in the component
    ],
  });
};

/**
 * React Query hook to fetch the canister ID for a specific MCP server instance.
 * Returns null if the canister ID is not available.
 */
export const useGetCanisterId = (namespace?: string, wasmId?: string) => {
  const { identity } = useInternetIdentity();

  return useQuery<Principal | null>({
    // The query is public, but we include the principal to maintain a consistent
    // pattern and ensure reactivity if the identity changes.
    queryKey: ['serverCanisterId', namespace, wasmId],
    queryFn: async (): Promise<Principal | null> => {
      if (!namespace || !wasmId || !identity) {
        return null;
      }

      const result = await getServerCanisterId(identity, namespace, wasmId);
      // Explicitly convert undefined to null for React Query
      return result ?? null;
    },
    enabled: !!namespace && !!wasmId && !!identity,
    // Provide a placeholder to prevent undefined issues during initialization
    placeholderData: null,
  });
};
