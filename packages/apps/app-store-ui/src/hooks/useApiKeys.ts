// src/hooks/useApiKeyManager.ts

import { Principal } from '@icp-sdk/core/principal';
import { useQuery } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import useMutation from './useMutation'; // Your custom mutation hook
import {
  createMyApiKey,
  listMyApiKeys,
  revokeMyApiKey,
} from '@prometheus-protocol/ic-js';

/**
 * A React Query hook to fetch the current user's API keys for a specific MCP server.
 *
 * @param serverPrincipal The Principal of the MCP server to query.
 */
export const useListApiKeys = (serverPrincipal?: Principal) => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    // The query key is unique for the user and the specific server.
    queryKey: ['apiKeys', principal?.toText(), serverPrincipal?.toText()],
    queryFn: async () => {
      if (!identity || !serverPrincipal) {
        throw new Error('User or server principal is not available.');
      }
      // Uses the generic `listMyApiKeys` function from the API layer.
      return listMyApiKeys(identity, serverPrincipal);
    },
    // The query is only enabled when all dependencies are defined.
    enabled: !!principal && !!serverPrincipal,
  });
};

/**
 * Arguments for the useCreateApiKey mutation.
 */
interface CreateApiKeyArgs {
  serverPrincipal: Principal;
  name: string;
}

/**
 * A mutation hook for creating a new API key for the current user.
 */
export const useCreateApiKey = () => {
  const { identity } = useInternetIdentity();

  return useMutation<CreateApiKeyArgs, { raw_key: string }>({
    mutationFn: async (args: CreateApiKeyArgs) => {
      if (!identity) {
        throw new Error('User is not authenticated');
      }
      // Perform the creation using the shared library function.
      return await createMyApiKey(identity, args.serverPrincipal, args.name);
    },
    // This is the key to making the UI reactive. After a key is created,
    // we invalidate and refetch the list of keys for that user.
    queryKeysToRefetch: [['apiKeys', identity?.getPrincipal().toText()]],
    // We don't show a generic success message here because the UI needs to
    // handle the raw key securely. The onSuccess callback is better.
  });
};

/**
 * Arguments for the useRevokeApiKey mutation.
 */
interface RevokeApiKeyArgs {
  serverPrincipal: Principal;
  hashedKey: string;
}

/**
 * A mutation hook for revoking one of the user's API keys.
 */
export const useRevokeApiKey = () => {
  const { identity } = useInternetIdentity();

  return useMutation<RevokeApiKeyArgs, void>({
    mutationFn: async (args: RevokeApiKeyArgs) => {
      if (!identity) {
        throw new Error('User is not authenticated');
      }
      // Perform the revocation using the shared library function.
      return await revokeMyApiKey(
        identity,
        args.serverPrincipal,
        args.hashedKey,
      );
    },
    successMessage: 'API Key revoked successfully!',
    // After revoking, we must also refetch the list of keys.
    queryKeysToRefetch: [['apiKeys', identity?.getPrincipal().toText()]],
  });
};
