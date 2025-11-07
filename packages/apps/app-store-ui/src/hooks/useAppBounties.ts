// packages/hooks/src/useBounties.ts

import { useQuery } from '@tanstack/react-query';
import {
  getAllAppBounties,
  getAppBounty,
  AppBounties,
} from '@prometheus-protocol/ic-js';

/**
 * React Query hook to fetch the list of all public app bounties.
 * This is used for the main bounty board page.
 */
export const useGetAllAppBounties = () => {
  return useQuery<AppBounties.Bounty[]>({
    // A simple, unique key for this query.
    queryKey: ['appBounties'],
    queryFn: async () => {
      return getAllAppBounties();
    },
  });
};

/**
 * React Query hook to fetch the full details for a single app bounty,
 * identified by its unique ID.
 * @param bountyId The ID of the bounty as a bigint.
 */
export const useGetAppBounty = (bountyId: bigint | undefined) => {
  return useQuery<AppBounties.Bounty | null>({
    // The query key includes the specific ID to ensure uniqueness per bounty.
    queryKey: ['appBounty', bountyId],
    queryFn: async (): Promise<AppBounties.Bounty | null> => {
      if (!bountyId) {
        return null;
      }
      return getAppBounty(bountyId);
    },
    // The query should only execute when we have a valid bountyId.
    enabled: !!bountyId,
    // Provide placeholder to prevent undefined issues
    placeholderData: null,
  });
};
