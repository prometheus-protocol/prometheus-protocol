// packages/hooks/src/useBounties.ts

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
  listBounties,
  AuditBounty,
  AuditBountyWithDetails,
  getAuditBounty,
  getBounty,
  reserveBounty,
  AttestationData,
  fileAttestation,
  claimBounty,
  createBounty,
  Token,
  Tokens,
  getCanisterId,
  getAllowance,
  approveAllowance,
  getVerifierProfile,
  listPendingVerifications,
  listAllVerificationRequests,
  listPendingJobs,
  submitDivergence,
  depositStake,
  sponsorBountiesForWasm,
  ProcessedVerificationRecord,
  getSponsoredAuditTypes,
  getCompletedAuditTypes,
  getBountiesForWasm,
  getBountiesForJob,
  getBountiesWithLocksForJob,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import useMutation from './useMutation';
import { Principal } from '@icp-sdk/core/principal';
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
 * React Query hook to fetch bounties for a specific WASM ID.
 * When jobKey is provided, returns both bounties and locks in a single efficient query.
 */
export const useGetBountiesForWasm = (
  wasmId: string | undefined,
  auditType?: string,
  jobKey?: string | null,
  options?: { refetchInterval?: number | false },
) => {
  return useQuery<AuditBounty[]>({
    queryKey: ['auditBounties', 'wasm', wasmId, auditType, jobKey],
    queryFn: async () => {
      // If jobKey is provided, use the optimized single-query function
      if (jobKey) {
        const { bounties } = await getBountiesWithLocksForJob(jobKey);
        return bounties;
      }

      // Otherwise fall back to filtering by WASM ID and audit type
      if (!wasmId) return [];
      const bounties = await getBountiesForWasm(wasmId);

      // Filter by audit type if provided
      return auditType
        ? bounties.filter((b) => b.challengeParameters.audit_type === auditType)
        : bounties;
    },
    enabled: !!wasmId || !!jobKey,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: options?.refetchInterval,
  });
};

/**
 * React Query hook to fetch bounties with their locks for a specific job.
 * Single efficient query that returns both bounties and locks.
 */
export const useGetBountiesWithLocksForJob = (
  jobKey: string | null,
  options?: { refetchInterval?: number | false },
) => {
  return useQuery({
    queryKey: ['bountiesWithLocks', 'job', jobKey],
    queryFn: async () => {
      if (!jobKey) return { bounties: [], locks: new Map() };
      return getBountiesWithLocksForJob(jobKey);
    },
    enabled: !!jobKey,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: options?.refetchInterval,
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
    queryFn: async (): Promise<AuditBountyWithDetails | null> => {
      if (bountyId === undefined) {
        return null;
      }
      // Pass identity (which can be undefined) - the API handles it
      return getAuditBounty(identity, BigInt(bountyId));
    },
    // The query should only execute when we have a valid bountyId.
    // Remove identity requirement so logged-out users can view bounties
    enabled: !!bountyId,
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

      // Step 2: For now, we use USDC as the token for all audit types
      // In the future, different audit types might use different tokens
      const tokenId = Tokens.USDC.canisterId.toText();

      // Step 3: Call the canister to reserve the bounty
      await reserveBounty(identity, {
        bounty_id: bountyId,
        token_id: tokenId,
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
  auditTypes: string[];
  verificationRequest: ProcessedVerificationRecord;
}

// Define the possible states for the multi-step mutation
type SponsorStatus = 'Idle' | 'Sponsoring bounties...';

/**
 * A React Query mutation hook for sponsoring audit bounties via the bounty_sponsor canister.
 * The bounty_sponsor canister will create 9 bounties (one for each verifier) for each audit type.
 */
export const useSponsorBounty = () => {
  const { identity } = useInternetIdentity();
  const [status, setStatus] = useState<SponsorStatus>('Idle');

  const mutation = useMutation<
    SponsorBountyArgs,
    { bounty_ids: bigint[]; total_sponsored: number }
  >({
    mutationFn: async ({ wasmId, auditTypes, verificationRequest }) => {
      if (!identity)
        throw new Error('You must be logged in to sponsor bounties.');

      setStatus('Sponsoring bounties...');
      const result = await sponsorBountiesForWasm(identity, {
        wasm_id: wasmId,
        audit_types: auditTypes,
        verification_request: verificationRequest,
      });
      setStatus('Idle');

      return result;
    },
    successMessage: 'Bounties sponsored successfully!',
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
      // Use USDC token ID for profile queries
      const tokenId = Tokens.USDC.canisterId.toText();
      return getVerifierProfile(identity, tokenId);
    },
    enabled: !!principal,
  });
};

export const useListPendingVerifications = () => {
  return useQuery({
    queryKey: ['pendingVerifications'],
    queryFn: listPendingVerifications,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};

/**
 * Hook to fetch all verification requests with optional pagination
 */
export const useListAllVerificationRequests = (
  offset?: number,
  limit?: number,
) => {
  return useQuery({
    queryKey: ['allVerificationRequests', offset, limit],
    queryFn: () => listAllVerificationRequests(offset, limit),
  });
};

export const useListPendingJobs = (offset?: number, limit?: number) => {
  return useQuery({
    queryKey: ['pendingJobs', offset, limit],
    queryFn: () => listPendingJobs(offset, limit),
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
};

/**
 * Hook to fetch audit types that have been sponsored by the bounty_sponsor canister.
 * The bounty_sponsor pays for the first round of bounties.
 * Any subsequent sponsorships must be paid by users.
 */
export const useSponsoredAuditTypes = (wasmId: string) => {
  return useQuery({
    queryKey: ['sponsoredAuditTypes', wasmId],
    queryFn: () => getSponsoredAuditTypes(wasmId),
    enabled: !!wasmId,
    refetchOnMount: true, // Always refetch when component mounts
  });
};

/**
 * Hook to fetch audit types that have been completed (reached consensus) for a WASM.
 * An audit type is completed when it has enough successful attestations.
 */
export const useCompletedAuditTypes = (wasmId: string) => {
  return useQuery({
    queryKey: ['completedAuditTypes', wasmId],
    queryFn: () => getCompletedAuditTypes(wasmId),
    enabled: !!wasmId,
    staleTime: 0,
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

/**
 * Hook to deposit USDC stake into the verifier's account.
 * This performs a two-step process:
 * 1. Approves the Audit Hub to spend USDC
 * 2. Deposits the stake into the verifier's account
 */
export const useDepositStake = () => {
  const { identity } = useInternetIdentity();

  return useMutation({
    mutationFn: async (amount: bigint) => {
      if (!identity) {
        throw new Error('Must be logged in to deposit stake');
      }

      await depositStake(identity, amount, Tokens.USDC);
    },

    successMessage: 'Stake deposited successfully!',

    queryKeysToRefetch: [
      ['tokenBalance', identity?.getPrincipal().toText()],
      ['verifierProfile'],
    ],
  });
};
