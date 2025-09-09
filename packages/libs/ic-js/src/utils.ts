import { Bounty } from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import { AuditBounty } from './api';
import { fromNullable } from '@dfinity/utils';
import { deserializeFromIcrc16Map, deserializeIcrc16Value } from './index.js';

/** * Converts a nanosecond timestamp to a JavaScript Date object.
 * This is useful for converting timestamps from the Internet Computer's
 * nanosecond precision to JavaScript's millisecond precision.
 * @param ns The timestamp in nanoseconds.
 * @returns A Date object representing the same point in time.
 */
export function nsToDate(ns: bigint): Date {
  return new Date(Number(ns / 1_000_000n));
}

// The string literal type for our security tier. This provides excellent type safety.
export type SecurityTier = 'Gold' | 'Silver' | 'Bronze' | 'Unranked';

/**
 * Calculates the security tier based on a list of completed audit types.
 * This logic is a direct TypeScript port of the Motoko canister's calculation
 * to ensure consistency between the app listings and the app details pages.
 * @param completedAudits An array of strings, e.g., ['app_info_v1', 'build_reproducibility_v1'].
 * @returns The calculated SecurityTier.
 */
export function calculateSecurityTier(completedAudits: string[]): SecurityTier {
  // Helper to check if a specific audit is present.
  // `Array.prototype.includes` is the direct equivalent of the Motoko `find` check.
  const hasAudit = (auditType: string): boolean => {
    return completedAudits.includes(auditType);
  };

  // Check for tiers in descending order of prestige.
  // Gold: Requires everything, including a security audit.
  if (
    hasAudit('app_info_v1') &&
    hasAudit('build_reproducibility_v1') &&
    hasAudit('tools_v1') &&
    hasAudit('security_v1')
  ) {
    return 'Gold';
  }

  // Silver: App info, build is reproducible, and tools are verified.
  if (
    hasAudit('app_info_v1') &&
    hasAudit('build_reproducibility_v1') &&
    hasAudit('tools_v1')
  ) {
    return 'Silver';
  }

  // Bronze: App info is present and the build is reproducible. The foundation of trust.
  if (hasAudit('app_info_v1') && hasAudit('build_reproducibility_v1')) {
    return 'Bronze';
  }

  // If it has app_info but doesn't meet Bronze, it's Unranked.
  if (hasAudit('app_info_v1')) {
    return 'Unranked';
  }

  // Default fallback.
  return 'Unranked';
}

export function processBounty(bounty: Bounty): AuditBounty {
  const claimedDateNs = fromNullable(bounty.claimed_date);
  const timeoutDateNs = fromNullable(bounty.timeout_date);

  return {
    id: bounty.bounty_id,
    creator: bounty.creator,
    created: nsToDate(bounty.created),
    tokenAmount: bounty.token_amount,
    tokenCanisterId: bounty.token_canister_id,
    validationCanisterId: bounty.validation_canister_id,
    validationCallTimeout: bounty.validation_call_timeout,
    payoutFee: bounty.payout_fee,
    claims: bounty.claims,
    metadata: deserializeFromIcrc16Map(bounty.bounty_metadata),
    challengeParameters: deserializeIcrc16Value(bounty.challenge_parameters),
    claimedTimestamp: fromNullable(bounty.claimed),
    claimedDate: claimedDateNs ? nsToDate(claimedDateNs) : undefined,
    timeoutDate: timeoutDateNs ? nsToDate(timeoutDateNs) : undefined,
  };
}
