import {
  getServerCanisterId,
  getExternalBinding,
  provisionInstance,
  type AppVersionSummary,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Principal } from '@icp-sdk/core/principal';
import useMutation from './useMutation';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

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
 *
 * Identity is optional:
 *   - For #global apps, `get_canister_id` returns the shared canister regardless
 *     of caller, so we want this to work for logged-out visitors too.
 *   - For #provisioned apps, `get_canister_id` keys on the caller, so anonymous
 *     callers correctly receive null.
 */
export const useGetCanisterId = (namespace?: string, wasmId?: string) => {
  const { identity } = useInternetIdentity();

  return useQuery<Principal | null>({
    // Identity is included in the key so the cached result refreshes when the
    // user logs in/out (e.g. provisioned apps become visible after login).
    queryKey: [
      'serverCanisterId',
      namespace,
      wasmId,
      identity?.getPrincipal().toText() ?? 'anonymous',
    ],
    queryFn: async (): Promise<Principal | null> => {
      if (!namespace || !wasmId) {
        return null;
      }

      const result = await getServerCanisterId(identity, namespace, wasmId);
      // Explicitly convert undefined to null for React Query
      return result ?? null;
    },
    enabled: !!namespace && !!wasmId,
    // Provide a placeholder to prevent undefined issues during initialization
    placeholderData: null,
  });
};

/**
 * React Query hook to fetch canister IDs for all versions of an MCP server.
 * Returns an array of Principal IDs for all versions that have been provisioned.
 * Identity is optional for the same reason as useGetCanisterId above.
 */
export const useGetAllVersionCanisterIds = (
  namespace?: string,
  allVersions?: AppVersionSummary[],
) => {
  const { identity } = useInternetIdentity();
  const principalText = identity?.getPrincipal().toText() ?? 'anonymous';

  const queries = useQueries({
    queries: (allVersions ?? []).map((version) => ({
      queryKey: [
        'serverCanisterId',
        namespace,
        version.wasmId,
        principalText,
      ],
      queryFn: async (): Promise<Principal | null> => {
        if (!namespace || !version.wasmId) {
          return null;
        }
        try {
          const id = await getServerCanisterId(
            identity,
            namespace,
            version.wasmId,
          );
          return id ?? null;
        } catch {
          return null;
        }
      },
      enabled: !!namespace && !!version.wasmId,
    })),
    combine: (results) => {
      return {
        data: results.map((r) => r.data),
        pending: results.some((r) => r.isPending),
      };
    },
  });

  // Extract all valid canister IDs
  const canisterIds = useMemo(() => {
    return queries.data.filter(
      (id): id is Principal => id !== null && id !== undefined,
    );
  }, [queries.data]);

  return {
    canisterIds,
    isPending: queries.pending,
  };
};

/**
 * React Query hook to fetch the canister ID for a BYOC (external) app.
 * Uses the registry's external binding lookup instead of the orchestrator.
 * Returns a Principal if the binding exists, null otherwise.
 */
export const useGetExternalCanisterId = (namespace?: string) => {
  return useQuery<Principal | null>({
    queryKey: ['externalCanisterId', namespace],
    queryFn: async (): Promise<Principal | null> => {
      if (!namespace) return null;
      const binding = await getExternalBinding(namespace);
      if (!binding) return null;
      return Principal.fromText(binding.canisterId);
    },
    enabled: !!namespace,
    placeholderData: null,
  });
};
