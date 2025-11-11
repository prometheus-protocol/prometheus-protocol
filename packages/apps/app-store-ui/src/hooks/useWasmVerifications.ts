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
            // Extract wasmId and auditType from the composite key (format: "wasmId::auditType")
            const [wasmId, auditType] = groupKey.split('::');

            try {
              const [attestationIds, divergenceIds] = await Promise.all([
                getVerificationProgress(wasmId, auditType),
                getDivergenceProgress(wasmId, auditType),
              ]);

              return createWasmVerification(
                wasmId,
                wasmBounties,
                attestationIds,
                divergenceIds,
              );
            } catch (error) {
              console.error(
                `Error fetching progress for WASM ${wasmId} (${auditType}):`,
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
  options?: {
    refetchInterval?: number | false;
    enabled?: boolean;
    auditType?: string;
  },
) {
  // Use audit type from options (URL params) or fall back to first bounty
  const auditType =
    options?.auditType ||
    bounties?.[0]?.challengeParameters.audit_type ||
    'build_reproducibility_v1';

  return useQuery({
    queryKey: ['wasmVerification', wasmId, auditType],
    queryFn: async (): Promise<WasmVerification | null> => {
      console.log('Fetching verification progress for', wasmId, auditType);
      if (!wasmId || !bounties || bounties.length === 0) {
        return null;
      }

      // Filter bounties for this specific WASM
      const wasmBounties = bounties.filter((b) => b.wasmHashHex === wasmId);

      if (wasmBounties.length === 0) {
        console.log('No bounties found for WASM', wasmId);
        return null;
      }

      // Extract audit_type from the first bounty (all bounties in this group should have the same type)
      const bountyAuditType =
        wasmBounties[0]?.challengeParameters.audit_type || 'unknown';

      try {
        const [attestationIds, divergenceIds] = await Promise.all([
          getVerificationProgress(wasmId, bountyAuditType),
          getDivergenceProgress(wasmId, bountyAuditType),
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
    enabled:
      !!wasmId &&
      !!bounties &&
      bounties.length > 0 &&
      options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
  });
}
