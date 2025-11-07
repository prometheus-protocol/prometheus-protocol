import { AuditBounty } from '@prometheus-protocol/ic-js';

/**
 * Represents a grouped verification process for a WASM.
 * Instead of showing individual bounties, we group all 9 bounties
 * for the same WASM and show consensus progress.
 */
export interface WasmVerification {
  /** The WASM hash (hex string) */
  wasmId: string;

  /** All bounties associated with this WASM (should be 9) */
  bounties: AuditBounty[];

  /** Number of successful attestations filed (progress toward 5/9 consensus) */
  attestationCount: number;

  /** Number of divergence reports filed */
  divergenceCount: number;

  /** Bounty IDs that have filed attestations */
  attestationBountyIds: bigint[];

  /** Bounty IDs that have filed divergences */
  divergenceBountyIds: bigint[];

  /** Total reward pool (sum of all bounties) */
  totalReward: bigint;

  /** Audit type (should be same for all bounties) */
  auditType: string;

  /** Status of the verification process */
  status: 'pending' | 'in_progress' | 'verified' | 'rejected';

  /** Number of bounties claimed (verifiers who have reserved) */
  claimedCount: number;

  /** Number of bounties still open for claiming */
  openCount: number;
}

/**
 * Helper to group bounties by WASM ID
 */
export function groupBountiesByWasm(
  bounties: AuditBounty[],
): Map<string, AuditBounty[]> {
  const grouped = new Map<string, AuditBounty[]>();

  for (const bounty of bounties) {
    // Use the hex-encoded wasm_hash from wasmHashHex or fall back to converting it
    const wasmId = bounty.wasmHashHex || '';
    if (!wasmId) continue; // Skip if no WASM hash available

    if (!grouped.has(wasmId)) {
      grouped.set(wasmId, []);
    }
    grouped.get(wasmId)!.push(bounty);
  }

  return grouped;
}

/**
 * Create a WasmVerification object from grouped bounties and progress data
 */
export function createWasmVerification(
  wasmId: string,
  bounties: AuditBounty[],
  attestationIds: bigint[],
  divergenceIds: bigint[],
): WasmVerification {
  const totalReward = bounties.reduce((sum, b) => sum + b.tokenAmount, 0n);
  const auditType = bounties[0]?.challengeParameters.audit_type || 'unknown';

  // Count bounties with active locks (claims array has items)
  const claimedCount = bounties.filter(
    (b) => b.claims && b.claims.length > 0,
  ).length;
  const openCount = bounties.length - claimedCount;

  // Determine status based on consensus
  let status: WasmVerification['status'] = 'pending';
  const attestationCount = attestationIds.length;
  const divergenceCount = divergenceIds.length;

  if (attestationCount >= 5) {
    status = 'verified'; // Reached majority consensus for verification
  } else if (divergenceCount >= 5) {
    status = 'rejected'; // Reached majority consensus for rejection
  } else if (attestationCount > 0 || divergenceCount > 0) {
    status = 'in_progress'; // Some attestations filed but no consensus yet
  }

  return {
    wasmId,
    bounties,
    attestationCount,
    divergenceCount,
    attestationBountyIds: attestationIds,
    divergenceBountyIds: divergenceIds,
    totalReward,
    auditType,
    status,
    claimedCount,
    openCount,
  };
}
