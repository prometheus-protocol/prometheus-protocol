import {
  AttestationRecord,
  AuditRecord,
  Bounty,
  VerificationRecord,
  VerificationRequest,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import {
  AuditBounty,
  ProcessedAttestation,
  ProcessedAuditRecord,
  ProcessedVerificationRecord,
  ProcessedVerificationRequest,
} from './api';
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
 * Calculates the security tier based on a definitive verification status and a list
 * of completed declarative audits.
 *
 * @param isBuildVerified A boolean indicating if the WASM has passed the ICRC-126 verification lifecycle.
 * @param completedDeclarativeAudits An array of audit type strings (e.g., ['app_info_v1', 'data_safety_v1']).
 * @returns The calculated SecurityTier.
 */
export function calculateSecurityTier(
  isBuildVerified: boolean,
  completedDeclarativeAudits: string[],
): SecurityTier {
  // Helper to check if a specific declarative audit is present in the array.
  const hasAudit = (auditType: string): boolean => {
    return completedDeclarativeAudits.includes(auditType);
  };

  // Gold: Requires a verified build AND all key declarative audits.
  if (
    isBuildVerified &&
    hasAudit('app_info_v1') &&
    hasAudit('tools_v1') &&
    hasAudit('data_safety_v1')
  ) {
    return 'Gold';
  }

  // Silver: Verified build, app info, and tools.
  if (isBuildVerified && hasAudit('app_info_v1') && hasAudit('tools_v1')) {
    return 'Silver';
  }

  // Bronze: The foundation of trust - a verified build and basic app info.
  if (isBuildVerified && hasAudit('app_info_v1')) {
    return 'Bronze';
  }

  // If none of the tiered conditions are met (e.g., build is not verified),
  // the app is considered Unranked. This correctly implements your rule.
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

export function processAttestation(
  attestation: AttestationRecord,
): ProcessedAttestation {
  return {
    audit_type: attestation.audit_type,
    timestamp: attestation.timestamp,
    auditor: attestation.auditor,
    payload: deserializeFromIcrc16Map(attestation.metadata),
  };
}

export function processVerificationRecord(
  request: VerificationRecord,
): ProcessedVerificationRecord {
  const processedRecord = {
    requester: request.requester,
    metadata: deserializeFromIcrc16Map(request.metadata),
    repo: request.repo,
    timestamp: new Date(Number(request.timestamp / 1_000_000n)),
    commit_hash: uint8ArrayToHex(request.commit_hash as Uint8Array),
    wasm_hash: uint8ArrayToHex(request.wasm_hash as Uint8Array),
  };

  return processedRecord;
}

export function processVerificationRequest(
  request: VerificationRequest,
): ProcessedVerificationRequest {
  const processedRequest = {
    repo: request.repo,
    commit_hash: uint8ArrayToHex(request.commit_hash as Uint8Array),
    wasm_hash: uint8ArrayToHex(request.wasm_hash as Uint8Array),
    metadata: deserializeFromIcrc16Map(request.metadata),
  };

  return processedRequest;
}

export function processToolInvocation(request: [string, bigint]): {
  toolName: string;
  invocationCount: bigint;
} {
  const [toolName, invocations] = request;
  return {
    toolName,
    invocationCount: invocations,
  };
}

export function processAuditRecord(record: AuditRecord): ProcessedAuditRecord {
  // This is the crucial type guard. We check which variant the record is.
  if ('Attestation' in record) {
    const att = record.Attestation;
    return {
      type: 'attestation',
      auditor: att.auditor,
      audit_type: att.audit_type,
      timestamp: att.timestamp,
      metadata: deserializeFromIcrc16Map(att.metadata),
    };
  } else {
    // 'Divergence' in record
    const div = record.Divergence;
    return {
      type: 'divergence',
      reporter: div.reporter,
      report: div.report,
      timestamp: div.timestamp,
      metadata:
        div.metadata.length > 0
          ? deserializeFromIcrc16Map(div.metadata[0]!)
          : {},
    };
  }
}

/**
 * Converts a Uint8Array to a hexadecimal string.
 * @param bytes The Uint8Array to convert.
 * @returns The hexadecimal string representation.
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 * @param hexString The hexadecimal string to convert.
 * @returns The corresponding Uint8Array.
 */
export function hexToUint8Array(hexString: string): Uint8Array {
  // Ensure the hex string has an even number of characters, remove 0x prefix if present
  const cleanHexString = hexString.startsWith('0x')
    ? hexString.slice(2)
    : hexString;
  if (cleanHexString.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters');
  }

  const bytes = new Uint8Array(cleanHexString.length / 2);
  for (let i = 0; i < cleanHexString.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHexString.substring(i, i + 2), 16);
  }
  return bytes;
}

// Truncate hex hash strings for display, e.g.:
// a1b2c3d4e5f6...y7z8a9b0c1d2
export function truncateHash(hash: string, length = 4): string {
  if (hash.length <= length * 2) {
    return hash; // No need to truncate
  }
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}
