import { useQuery } from '@tanstack/react-query';
import {
  getBountiesForWasm,
  getVerificationProgress,
  getDivergenceProgress,
} from '@prometheus-protocol/ic-js';
import type { AuditBounty } from '@prometheus-protocol/ic-js';
import {
  WasmVerification,
  groupBountiesByWasm,
  createWasmVerification,
} from '@/types/verification';

/**
 * Custom hook to fetch all bounties and group them by WASM with progress data
 */
export function useGetWasmVerifications(bounties: AuditBounty[] | undefined) {
  return useQuery({
    queryKey: ['wasmVerifications', bounties?.length],
    queryFn: async (): Promise<WasmVerification[]> => {
      if (!bounties || bounties.length === 0) {
        return [];
      }

      // Group bounties by WASM ID and audit type
      const groupedMap = groupBountiesByWasm(bounties);

      // For each WASM+audit_type group, fetch progress data
      const verifications = await Promise.all(
        Array.from(groupedMap.entries()).map(
          async ([groupKey, wasmBounties]) => {
            // Extract wasmId from the composite key (format: "wasmId::auditType")
            const wasmId = groupKey.split('::')[0];

            try {
              const [attestationIds, divergenceIds] = await Promise.all([
                getVerificationProgress(wasmId),
                getDivergenceProgress(wasmId),
              ]);

              return createWasmVerification(
                wasmId,
                wasmBounties,
                attestationIds,
                divergenceIds,
              );
            } catch (error) {
              console.error(
                `Error fetching progress for WASM ${wasmId}:`,
                error,
              );
              // Return verification with zero progress on error
              return createWasmVerification(wasmId, wasmBounties, [], []);
            }
          },
        ),
      );

      // Sort by most recent bounty creation date (newest first)
      return verifications.sort((a, b) => {
        const aNewestDate = Math.max(
          ...a.bounties.map((b) => b.created.getTime()),
        );
        const bNewestDate = Math.max(
          ...b.bounties.map((b) => b.created.getTime()),
        );
        return bNewestDate - aNewestDate; // Newest first
      });
    },
    enabled: !!bounties && bounties.length > 0,
  });
}

/**
 * Custom hook to fetch verification data for a single WASM
 * More efficient than useGetWasmVerifications when you only need one WASM
 */
export function useGetSingleWasmVerification(
  wasmId: string | undefined,
  bounties: AuditBounty[] | undefined,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: ['wasmVerification', wasmId],
    queryFn: async (): Promise<WasmVerification | null> => {
      console.log('Fetching verification progress for', wasmId);
      if (!wasmId || !bounties || bounties.length === 0) {
        return null;
      }

      // Filter bounties for this specific WASM
      const wasmBounties = bounties.filter((b) => b.wasmHashHex === wasmId);

      if (wasmBounties.length === 0) {
        return null;
      }

      try {
        const [attestationIds, divergenceIds] = await Promise.all([
          getVerificationProgress(wasmId),
          getDivergenceProgress(wasmId),
        ]);

        return createWasmVerification(
          wasmId,
          wasmBounties,
          attestationIds,
          divergenceIds,
        );
      } catch (error) {
        console.error(`Error fetching progress for WASM ${wasmId}:`, error);
        return createWasmVerification(wasmId, wasmBounties, [], []);
      }
    },
    enabled: !!wasmId && !!bounties && bounties.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data as WasmVerification | null;

      // Stop refetching only if:
      // 1. Consensus has been reached (verified/rejected) AND
      // 2. All 9 verifiers have participated (filed attestation or divergence)
      if (data) {
        const isConsensusReached =
          data.status === 'verified' || data.status === 'rejected';
        const totalParticipated =
          data.attestationBountyIds.length + data.divergenceBountyIds.length;
        const allVerifiersParticipated = totalParticipated >= 9;

        if (isConsensusReached && allVerifiersParticipated) {
          return false; // Stop polling
        }
      }

      return options?.refetchInterval ?? false;
    },
    refetchIntervalInBackground: true,
  });
}
