import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  getMyGrants,
  getPublicResourceServer,
  PublicResourceServer,
  revokeGrant,
} from '@/api/grant.api';

/**
 * React Query hook to fetch the current user's list of granted resource server IDs.
 */
export const useMyGrantsQuery = () => {
  const { identity } = useInternetIdentity();

  return useQuery({
    queryKey: ['myGrants', identity?.getPrincipal().toText()],
    queryFn: async () => {
      if (!identity) throw new Error('Identity not available.');
      return getMyGrants(identity);
    },
    enabled: !!identity,
  });
};

/**
 * React Query hook to fetch the public details for a single resource server.
 */
export const usePublicResourceServerQuery = (
  resourceServerId: string | undefined,
) => {
  const { identity } = useInternetIdentity();

  return useQuery<PublicResourceServer>({
    queryKey: ['resourceServer', resourceServerId],
    queryFn: async () => {
      if (!identity || !resourceServerId) {
        throw new Error('Identity or resourceServerId not available');
      }
      return getPublicResourceServer(identity, resourceServerId);
    },
    enabled: !!identity && !!resourceServerId,
  });
};

/**
 * React Query mutation hook for revoking a grant.
 * Handles invalidating the grants list on success to trigger a UI update.
 */
export const useRevokeGrantMutation = () => {
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resourceServerId: string) => {
      if (!identity) throw new Error('Identity not available');
      return revokeGrant(identity, resourceServerId);
    },
    onSuccess: () => {
      // When a grant is revoked, invalidate the 'myGrants' query
      // to force a refetch of the updated list.
      queryClient.invalidateQueries({
        queryKey: ['myGrants', identity?.getPrincipal().toText()],
      });
    },
  });
};
