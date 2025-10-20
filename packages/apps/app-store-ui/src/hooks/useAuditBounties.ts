// packages/hooks/src/useBounties.ts

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  listBounties,
  AuditBounty,
  AuditBountyWithDetails,
  getAuditBounty,
  getReputationBalance,
  getBounty,
  reserveBounty,
  AttestationData,
  fileAttestation,
  claimBounty,
  createBounty,
  Token,
  getCanisterId,
  getAllowance,
  approveAllowance,
  getAuditorProfile,
  listPendingVerifications,
  submitDivergence,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import useMutation from './useMutation';
import { Principal } from '@dfinity/principal';
import { useState } from 'react';

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
 * React Query infinite hook to fetch paginated bounties.
 * This enables efficient infinite scrolling without fetching all bounties at once.
 */
export const useGetAuditBountiesInfinite = (pageSize: number = 20) => {
  return useInfiniteQuery({
    queryKey: ['auditBounties', 'infinite', pageSize],
    queryFn: async ({ pageParam }: { pageParam?: number }) => {
      return listBounties({
        take: BigInt(pageSize),
        prev: pageParam ? BigInt(pageParam) : undefined,
      });
    },
    getNextPageParam: (lastPage: AuditBounty[]) => {
      // If we got a full page, there might be more
      // Return the ID of the last bounty as the cursor for the next page
      if (lastPage.length === pageSize && lastPage.length > 0) {
        const lastBounty = lastPage[lastPage.length - 1];
        return Number(lastBounty.id);
      }
      return undefined; // No more pages
    },
    initialPageParam: undefined as number | undefined,
  });
};

/**
 * React Query hook to fetch the full details for a single app bounty,
 * identified by its unique ID.
 * @param bountyId The ID of the bounty as a number.
 */
export const useGetAuditBounty = (bountyId: number | undefined) => {
  const { identity } = useInternetIdentity();
  return useQuery<AuditBountyWithDetails | null>({
    // The query key includes the specific ID to ensure uniqueness per bounty.
    queryKey: ['auditBounties', bountyId, identity?.getPrincipal().toText()],
    queryFn: async () => {
      if (bountyId === undefined) {
        // This should not be called if bountyId is undefined due to the `enabled` flag,
        // but we add it for type safety and robustness.
        throw new Error('Bounty ID is not available');
      }
      return getAuditBounty(identity, BigInt(bountyId));
    },
    // The query should only execute when we have a valid bountyId.
    enabled: bountyId !== undefined,
  });
};

export const useGetReputationBalance = (tokenId: string | undefined) => {
  const { identity } = useInternetIdentity();
  return useQuery<number>({
    queryKey: [
      'reputationBalance',
      identity?.getPrincipal().toString(),
      tokenId,
    ],
    queryFn: async () => {
      if (!identity || !tokenId) {
        throw new Error('Principal ID or Token ID is not available');
      }
      const balance = await getReputationBalance(identity, tokenId);
      return Number(balance) || 0;
    },
    enabled: !!identity && !!tokenId,
  });
};

/**
 * React Query mutation hook to reserve a bounty.
 * This involves staking the required tokens and marking the bounty as reserved
 * for the current user.
 * @param bountyId The ID of the bounty to reserve.
 */
export const useReserveAuditBounty = (bountyId?: bigint) => {
  const { identity } = useInternetIdentity();

  return useMutation<void, void>({
    // The mutation function replicates the logic from the CLI
    mutationFn: async () => {
      if (!identity) {
        throw new Error('You must be logged in to reserve a bounty.');
      }
      if (bountyId === undefined) {
        throw new Error('Bounty ID is not available.');
      }

      // Step 1: Fetch bounty details to get the required audit_type (token_id)
      const bounty = await getBounty(bountyId);
      if (!bounty) {
        throw new Error(`Bounty #${bountyId} not found.`);
      }

      const auditType = bounty.challengeParameters?.audit_type as string;
      if (!auditType) {
        throw new Error('Could not determine audit type from bounty details.');
      }

      // Step 2: Call the canister to reserve the bounty
      await reserveBounty(identity, {
        bounty_id: bountyId,
        token_id: auditType,
      });
    },

    // On success, display a confirmation message
    successMessage:
      'Bounty reserved successfully! You can now submit your attestation.',

    // On success, refetch the specific bounty details and the main bounty list
    queryKeysToRefetch: [
      ['auditBounties'], // Assuming this is the key for the main list
    ],
  });
};

interface SubmitAttestationArgs {
  bountyId: bigint;
  wasmId: string;
  attestationData: AttestationData;
}

/**
 * A React Query mutation hook for submitting a completed attestation.
 *
 * This hook serializes the form data into the ICRC-16 format and calls the
 * `fileAttestation` canister method. It handles optimistic updates and
 * query invalidation to ensure the UI reflects the new "Completed" state.
 */
export const useSubmitAttestation = () => {
  const { identity } = useInternetIdentity();

  return useMutation<SubmitAttestationArgs, void>({
    mutationFn: async ({ bountyId, wasmId, attestationData }) => {
      if (!identity) {
        throw new Error('You must be logged in to submit an attestation.');
      }

      // Step 1: File the attestation
      await fileAttestation(identity, {
        bounty_id: bountyId,
        wasm_id: wasmId,
        attestationData,
      });

      // Step 2: Immediately claim the bounty upon successful attestation
      await claimBounty(identity, {
        bounty_id: bountyId,
        wasm_id: wasmId,
      });
    },

    successMessage: 'Attestation submitted and bounty claimed successfully!',

    // When the submission is successful, we must refetch the audit details
    // to update the page from the form view to the results view.
    queryKeysToRefetch: [
      ['auditBounties'],
      ['appStoreListings'],
      ['appDetails'],
      ['balance', identity?.getPrincipal().toText()],
    ],
  });
};

interface ClaimBountyArgs {
  bountyId: bigint;
  wasmId: string;
}

/**
 * A React Query mutation hook specifically for claiming a bounty.
 * This is used to complete the process if `fileAttestation` succeeded
 * but the initial automatic claim failed.
 */
export const useClaimBounty = () => {
  const { identity } = useInternetIdentity();

  return useMutation<ClaimBountyArgs, void>({
    mutationFn: async ({ bountyId, wasmId }) => {
      if (!identity) {
        throw new Error('You must be logged in to claim a bounty.');
      }
      await claimBounty(identity, {
        bounty_id: bountyId,
        wasm_id: wasmId,
      });
    },
    successMessage:
      'Bounty claimed successfully! Your reward is being processed.',
    queryKeysToRefetch: [
      ['auditBounties'],
      ['balance', identity?.getPrincipal().toText()],
      ['auditorProfile', identity?.getPrincipal().toText()],
    ], // Refetch to show the final "Completed" state
  });
};

// Define the arguments for our new hook
interface SponsorBountyArgs {
  wasmId: string;
  auditType: string;
  paymentToken: Token;
  amount: number | string; // Human-readable amount
}

// Define the possible states for the multi-step mutation
type SponsorStatus =
  | 'Idle'
  | 'Checking allowance...'
  | 'Approving...'
  | 'Creating bounty...';

/**
 * A comprehensive mutation hook to handle the full bounty sponsorship flow.
 * It orchestrates checking allowance, approving, and creating the bounty.
 */
export const useSponsorBounty = () => {
  const { identity } = useInternetIdentity();
  const [status, setStatus] = useState<SponsorStatus>('Idle');

  const mutation = useMutation<SponsorBountyArgs, bigint>({
    mutationFn: async ({ wasmId, auditType, paymentToken, amount }) => {
      if (!identity)
        throw new Error('You must be logged in to sponsor a bounty.');

      const registryPrincipal = Principal.fromText(
        getCanisterId('MCP_REGISTRY'),
      );

      // Calculate the required amounts in atomic units
      const bountyAtomic = paymentToken.toAtomic(amount);
      const payoutFee = paymentToken.fee; // The fee for the final payout
      const amountToApprove =
        bountyAtomic + BigInt(paymentToken.fee) + BigInt(payoutFee);

      // 1. Check current allowance
      setStatus('Checking allowance...');
      const currentAllowance = await getAllowance(
        identity,
        paymentToken,
        registryPrincipal,
      );

      // 2. Approve if the current allowance is insufficient
      if (currentAllowance < amountToApprove) {
        setStatus('Approving...');
        await approveAllowance(
          identity,
          paymentToken,
          registryPrincipal,
          paymentToken.fromAtomic(amountToApprove),
        );
      }

      // 3. Create the bounty
      setStatus('Creating bounty...');
      const bountyId = await createBounty(identity, {
        wasm_id: wasmId,
        audit_type: auditType,
        amount: bountyAtomic, // The bounty itself is just the net amount
        token: paymentToken,
        // These would be passed in or configured elsewhere
        timeout_date:
          BigInt(Date.now() + 30 * 24 * 60 * 60 * 1000) * 1_000_000n,
        validation_canister_id: registryPrincipal,
      });
      setStatus('Idle');

      return bountyId;
    },
    successMessage: 'Bounty sponsored successfully!',
    queryKeysToRefetch: [
      ['auditBounties'],
      ['appDetails'],
      ['tokenBalance'],
      ['pendingVerifications'],
    ],
  });

  return {
    ...mutation,
    status,
  };
};

/**
 * A React Query hook to fetch the current user's auditor reputation.
 *
 * It transforms the raw canister data into a more UI-friendly Map.
 * @returns A query object with the user's reputation as a Map<string, number>.
 */
export const useAuditorProfile = () => {
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal();

  return useQuery({
    queryKey: ['auditorProfile', principal?.toString()],
    queryFn: async () => {
      if (!identity) {
        throw new Error('User is not authenticated.');
      }
      return getAuditorProfile(identity);
    },
    enabled: !!principal,
  });
};

export const useListPendingVerifications = () => {
  return useQuery({
    queryKey: ['pendingVerifications'],
    queryFn: listPendingVerifications,
  });
};

interface SubmitDivergenceArgs {
  bountyId: bigint;
  wasmId: string;
  reason: string;
}

/**
 * A React Query mutation hook for submitting a divergence report and claiming the bounty.
 *
 * This follows the same logic as submitting an attestation, as a successful
 * divergence report is considered a valid completion of the audit work.
 */
export const useSubmitDivergence = () => {
  const { identity } = useInternetIdentity();

  return useMutation<SubmitDivergenceArgs, void>({
    mutationFn: async ({ bountyId, wasmId, reason }) => {
      if (!identity) {
        throw new Error('You must be logged in to submit a report.');
      }

      // Step 1: File the divergence report
      await submitDivergence(identity, {
        bountyId,
        wasmId,
        reason,
      });

      // Step 2: Immediately claim the bounty upon successful submission
      await claimBounty(identity, {
        bounty_id: bountyId,
        wasm_id: wasmId,
      });
    },

    successMessage: 'Divergence report submitted and bounty claimed!',

    // The state changes are identical, so we refetch the same data.
    queryKeysToRefetch: [
      ['auditBounties'],
      ['appStoreListings'],
      ['appDetails'],
      ['balance', identity?.getPrincipal().toText()],
    ],
  });
};
