import {
  getServerCanisterId,
  provisionInstance,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Principal } from '@dfinity/principal';
import useMutation from './useMutation';
import { useQuery } from '@tanstack/react-query';

/**
 * React Query mutation hook to provision a new instance of an MCP server.
 * This is used for "provisioned" apps where users get their own private instance.
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
      'Instance provisioned successfully! Your private canister is ready.',
    errorMessage: 'Failed to provision instance',
    queryKeysToRefetch: [
      ['appDetails', namespace],
      ['serverCanisterId', namespace],
    ],
  });
};

/**
 * React Query hook to fetch the list of all app store listings.
 * This is used for the main discovery/landing page.
 */
export const useGetCanisterId = (namespace?: string, wasmId?: string) => {
  const { identity } = useInternetIdentity();

  return useQuery<Principal | undefined>({
    // The query is public, but we include the principal to maintain a consistent
    // pattern and ensure reactivity if the identity changes.
    queryKey: ['serverCanisterId', namespace, wasmId],
    queryFn: async () => {
      if (!namespace || !wasmId || !identity) {
        throw new Error('Namespace and wasmId must be provided');
      }

      return getServerCanisterId(identity, namespace, wasmId);
    },
    enabled: !!namespace && !!wasmId && !!identity,
  });
};
