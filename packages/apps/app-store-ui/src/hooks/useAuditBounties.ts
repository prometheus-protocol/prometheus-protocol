// packages/hooks/src/useBounties.ts

import { useQuery } from '@tanstack/react-query';
import {
  listBounties,
  getBounty,
  AuditBounty,
} from '@prometheus-protocol/ic-js';

/**
 * React Query hook to fetch the list of all public app bounties.
 * This is used for the main bounty board page.
 */
export const useGetAllAuditBounties = () => {
  return useQuery<AuditBounty[]>({
    // A simple, unique key for this query.
    queryKey: ['auditBounties'],
    queryFn: async () => {
      return listBounties({});
    },
  });
};

/**
 * React Query hook to fetch the full details for a single app bounty,
 * identified by its unique ID.
 * @param bountyId The ID of the bounty as a bigint.
 */
export const useGetAuditBounty = (bountyId: bigint | undefined) => {
  return useQuery<AuditBounty | undefined>({
    // The query key includes the specific ID to ensure uniqueness per bounty.
    queryKey: ['auditBounties', bountyId],
    queryFn: async () => {
      if (!bountyId) {
        // This should not be called if bountyId is undefined due to the `enabled` flag,
        // but we add it for type safety and robustness.
        throw new Error('Bounty ID is not available');
      }
      return getBounty(bountyId);
    },
    // The query should only execute when we have a valid bountyId.
    enabled: !!bountyId,
  });
};
