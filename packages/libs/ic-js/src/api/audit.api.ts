/**
 * @file This file contains the API for interacting with the audit and bounty
 *       systems of the Prometheus Protocol. It includes functions for managing
 *       ICRC-127 bounties, ICRC-126 attestations, and interacting with the
 *       Audit Hub canister for staking and reservations.
 */

import { Identity } from '@icp-sdk/core/agent';
import {
  getRegistryActor,
  getAuditHubActor,
  getAppBountiesActor,
  getLeaderboardActor,
  getIcrcActor,
  getBountySponsorActor,
} from '../actors.js';
import { AuditHub, Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@icp-sdk/core/principal';
import { ICRC16Map } from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import {
  BountyListingRequest,
  CreateBountyRequest,
  BountySubmissionRequest,
} from '@prometheus-protocol/declarations/audit_hub/audit_hub.did.js';
import {
  hexToUint8Array,
  nsToDate,
  processAuditRecord,
  processBounty,
  processVerificationRecord,
  processVerificationRequest,
  SecurityTier,
  uint8ArrayToHex,
} from '../utils.js';
import { fromNullable, toNullable } from '@dfinity/utils';
import { deserializeFromIcrc16Map, serializeToIcrc16Map } from '../icrc16.js';
import { Token } from '../tokens.js';
import { AppVersionSummary } from './registry.api.js';
import { approveAllowance } from './payment.api.js';
import { getCanisterId } from '../config.js';

// --- TYPES ---

export type { AuditHub };

export interface ProcessedAttestation {
  audit_type: string;
  timestamp: bigint;
  auditor: Principal;
  payload: Record<string, any>; // The deserialized metadata
}

export interface AuditBounty {
  id: bigint;
  creator: Principal;
  created: Date;
  tokenAmount: bigint;
  tokenCanisterId: Principal;
  metadata: Record<string, any>;
  challengeParameters: Record<string, any>;
  validationCanisterId: Principal;
  validationCallTimeout: bigint;
  payoutFee: bigint;
  claims: any[];
  claimedTimestamp?: bigint;
  claimedDate?: Date;
  timeoutDate?: Date;
  wasmHashHex?: string; // Hex string of the WASM hash for easy grouping
}

export interface ProcessedVerificationRequest {
  repo: string;
  commit_hash: string;
  wasm_hash: string;
  metadata: Record<string, any>;
}

export interface ProcessedVerificationRecord {
  repo: string;
  commit_hash: string;
  wasm_hash: string;
  requester: Principal;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ProcessedAttestationRecord {
  type: 'attestation'; // The discriminator
  auditor: Principal;
  audit_type: string;
  metadata: Record<string, any>;
  timestamp: bigint;
}

export interface ProcessedDivergenceRecord {
  type: 'divergence'; // The discriminator
  reporter: Principal;
  report: string;
  metadata: Record<string, any>;
  timestamp: bigint;
}

export type ProcessedAuditRecord =
  | ProcessedAttestationRecord
  | ProcessedDivergenceRecord;

export interface VerificationStatus {
  isVerified: boolean;
  verificationRequest: ProcessedVerificationRequest | null;
  auditRecords: ProcessedAuditRecord[];
  bounties: AuditBounty[];
}

export interface ServerTool {
  name: string;
  description: string;
  cost: string;
  tokenSymbol: string;
}

export interface DataSafetyPoint {
  title: string;
  description: string;
}

export interface ServerSecurityIssue {
  severity: string;
  description: string;
}

export type BountyStatusInput = 'Open' | 'Claimed';
export type BountyFilterInput =
  | { status: BountyStatusInput }
  | { audit_type: string }
  | { creator: Principal };

export interface ListBountiesRequest {
  filter?: BountyFilterInput[];
  take?: bigint;
  prev?: bigint;
}

export interface CreateBountyArgs {
  wasm_id: string;
  audit_type: string;
  amount: bigint;
  token: Token;
  timeout_date: bigint;
  validation_canister_id: Principal;
}

export interface ReserveBountyArgs {
  bounty_id: bigint;
  token_id: string;
}

export interface ClaimBountyArgs {
  bounty_id: bigint;
  wasm_id: string;
}

// --- FUNCTIONS ---
/**
 * Fetches and assembles the complete verification status for a single WASM.
 * This orchestrates multiple canister calls to build a complete, UI-friendly object.
 *
 * @param wasmId The lowercase hex string ID of the WASM to fetch.
 * @returns A complete VerificationStatus object.
 */
export const getVerificationStatus = async (
  wasmId: string,
): Promise<VerificationStatus> => {
  const registryActor = getRegistryActor();
  const bountySponsorActor = getBountySponsorActor();

  // 1. Fetch all data in parallel. Renamed for clarity.
  const [
    isVerifiedResult,
    verificationResult,
    auditRecordsResult, // <-- Renamed from attestationsResult
    bountiesResult,
  ] = await Promise.all([
    registryActor.is_wasm_verified(wasmId),
    registryActor.get_verification_request(wasmId),
    registryActor.get_audit_records_for_wasm(wasmId), // This now fetches both types
    bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId),
  ]);

  const verificationRequest =
    fromNullable<Registry.VerificationRequest>(verificationResult);
  const processedRequest: ProcessedVerificationRequest | null =
    verificationRequest
      ? processVerificationRequest(verificationRequest)
      : null;

  // --- 2. Process the audit records using a type guard ---
  // The result is now an array of our discriminated union type.
  const processedAuditRecords: ProcessedAuditRecord[] =
    auditRecordsResult.map(processAuditRecord);

  const processedBounties: AuditBounty[] = bountiesResult.map(processBounty);

  // 3. Return the final object with the corrected property name and data.
  return {
    isVerified: isVerifiedResult,
    verificationRequest: processedRequest,
    auditRecords: processedAuditRecords, // <-- Use the new name and the processed data
    bounties: processedBounties,
  };
};

/**
 * Creates a new ICRC-127 tokenized bounty for a specific WASM and audit type.
 *
 * IMPORTANT: The caller's identity must have already called `icrc2_approve` on the
 * `token_canister_id`, granting the registry canister permission to spend `amount` + fee.
 *
 * @returns The ID of the newly created bounty.
 */
export const createBounty = async (
  identity: Identity,
  args: CreateBountyArgs,
): Promise<bigint> => {
  // Destructure the arguments, including the new wasm_id (string)
  const { wasm_id, audit_type, amount, token, timeout_date } = args;

  // 1. Convert the hex string `wasm_id` into a Uint8Array (blob).
  // The 'hex' encoding tells Buffer how to interpret the input string.
  const wasm_hash_blob = hexToUint8Array(wasm_id);

  const auditHubActor = getAuditHubActor(identity);

  const request: CreateBountyRequest = {
    bounty_id: [],
    validation_canister_id: args.validation_canister_id,
    timeout_date: timeout_date,
    start_date: [],
    challenge_parameters: {
      Map: [
        // 2. Use the converted blob in the request payload.
        ['wasm_hash', { Blob: wasm_hash_blob }],
        ['audit_type', { Text: audit_type }],
      ],
    },
    bounty_metadata: [
      ['icrc127:reward_canister', { Principal: token.canisterId }],
      ['icrc127:reward_amount', { Nat: amount }],
    ],
  };

  const result = await auditHubActor.icrc127_create_bounty(request);

  if ('Error' in result) {
    throw new Error(`Failed to create bounty: ${JSON.stringify(result.Error)}`);
  }

  return result.Ok.bounty_id;
};

export interface SponsorBountiesArgs {
  wasm_id: string;
  audit_types: string[];
  verification_request: ProcessedVerificationRecord;
}

/**
 * Adds a verification job to the audit hub.
 * This creates the job that verifiers will pick up and work on.
 *
 * @param identity - The user's identity
 * @param args - Job creation parameters
 * @returns Promise that resolves when the job is created
 */
export const addVerificationJob = async (
  identity: Identity,
  args: {
    wasm_id: string;
    repo: string;
    commit_hash: string;
    build_config: Array<[string, any]>;
    audit_type: string;
    required_verifiers: bigint;
  },
): Promise<void> => {
  const auditHubActor = getAuditHubActor(identity);

  const result = await auditHubActor.add_verification_job(
    args.wasm_id,
    args.repo,
    args.commit_hash,
    args.build_config,
    args.audit_type,
    args.required_verifiers,
    [], // Empty bounty_ids - bounties will auto-attach via metadata
  );

  if ('err' in result) {
    throw new Error(`Failed to create verification job: ${result.err}`);
  }
};

/**
 * Sponsors bounties for a WASM using the bounty_sponsor canister.
 * This will create 9 bounties (one for each verifier) for each audit type specified.
 * The bounty_sponsor canister holds the funds and manages the sponsorship.
 *
 * @returns The result containing bounty IDs and total sponsored count
 */
export const sponsorBountiesForWasm = async (
  identity: Identity,
  args: SponsorBountiesArgs,
): Promise<{ bounty_ids: bigint[]; total_sponsored: number }> => {
  const { wasm_id, audit_types, verification_request } = args;

  // Convert hex wasm_id to Blob
  const wasm_hash_blob = hexToUint8Array(wasm_id);

  // Convert metadata to ICRC16 format using the serialization utility
  const build_config = verification_request.metadata
    ? serializeToIcrc16Map(verification_request.metadata)
    : [];

  // Step 1: Create verification jobs for each audit type BEFORE sponsoring bounties
  for (const audit_type of audit_types) {
    await addVerificationJob(identity, {
      wasm_id,
      repo: verification_request.repo,
      commit_hash: verification_request.commit_hash,
      build_config,
      audit_type,
      required_verifiers: BigInt(9), // Hardcoded to 9 for now
    });
  }

  // Step 2: Sponsor the bounties (which will auto-attach to the jobs we just created)
  const bountySponsorActor = getBountySponsorActor(identity);

  const result = await bountySponsorActor.sponsor_bounties_for_wasm(
    wasm_id,
    wasm_hash_blob,
    audit_types,
    verification_request.repo,
    verification_request.commit_hash,
    build_config,
    BigInt(9), // required_verifiers - hardcoded to 9 for now
  );

  if ('err' in result) {
    throw new Error(`Failed to sponsor bounties: ${result.err}`);
  }

  if (!result.ok) {
    throw new Error(
      'Failed to sponsor bounties: Invalid response from canister',
    );
  }

  return {
    bounty_ids: result.ok.bounty_ids,
    total_sponsored: Number(result.ok.total_sponsored),
  };
};

/**
 * Gets the audit types that have been sponsored by the bounty_sponsor canister for a given WASM.
 * The bounty_sponsor pays for the first round of bounties for each audit type.
 * Subsequent sponsorships must be paid by users.
 *
 * @param wasmId - The WASM ID to check
 * @returns Array of audit types that have been sponsored by the bounty_sponsor
 */
export const getSponsoredAuditTypes = async (
  wasmId: string,
): Promise<string[]> => {
  const bountySponsorActor = getBountySponsorActor();

  // The bounty_sponsor canister has a dedicated method that returns audit types
  return await bountySponsorActor.get_sponsored_audit_types_for_wasm(wasmId);
};

export interface AppInfoAttestationData {
  '126:audit_type': 'app_info_v1';
  name: string;
  publisher: string;
  canister_id: string;
  mcp_path: string;
  category: string;
  icon_url: string;
  banner_url: string;
  gallery_images: string[];
  description: string;
  key_features: string[];
  why_this_app: string;
  tags: string[];
}

// Define the structure of attestation data for type safety
export interface DataSafetyAttestationData {
  '126:audit_type': 'data_safety_v1';
  summary: string;
  overall_description: string;
  data_points: { category: string; description: string; title: string }[];
}

export interface ToolsAttestationData {
  '126:audit_type': 'tools_v1';
  tools: { name: string; description: string; cost: number; token: string }[];
}

export interface BuildReproducibilityAttestationData {
  '126:audit_type': 'build_reproducibility_v1';
  // V2 fields
  verifier_version?: string;
  build_timestamp?: bigint;
  build_duration_seconds?: bigint;
  build_log_excerpt?: string;
  bounty_id?: bigint;
  git_commit?: string;
  repo_url?: string;
  // Legacy v1 fields (kept for backward compatibility)
  status?: 'success' | 'failure';
  failure_reason?: string;
}

export type AttestationData =
  | AppInfoAttestationData
  | DataSafetyAttestationData
  | ToolsAttestationData
  | BuildReproducibilityAttestationData
  | Record<string, unknown>; // Fallback for unknown types

// Define the core audits that determine security tiers.
export const CORE_AUDIT_TYPES = [
  'build_reproducibility_v1',
  'tools_v1',
  // Not yet implemented:
  // 'app_info_v1',
  // 'data_safety_v1',
];

/**
 * Gets the audit types that have been completed (reached consensus and been finalized) for a WASM.
 * For build_reproducibility_v1, checks if the WASM has been verified (ICRC-126 verified status).
 * For other audit types, checks if there are at least 9 successful attestations.
 */
export const getCompletedAuditTypes = async (
  wasmId: string,
): Promise<string[]> => {
  const REQUIRED_ATTESTATIONS = 9;
  const completedTypes: string[] = [];

  for (const auditType of CORE_AUDIT_TYPES) {
    if (auditType === 'build_reproducibility_v1') {
      // For build reproducibility, check if the WASM has been verified (ICRC-126)
      try {
        const registryActor = getRegistryActor();
        const isVerified = await registryActor.is_wasm_verified(wasmId);
        if (isVerified) {
          completedTypes.push(auditType);
        }
      } catch (error) {
        console.error('Error checking WASM verification status:', error);
      }
    } else {
      // For other audit types, check attestation count
      const attestationBountyIds = await getVerificationProgress(
        wasmId,
        auditType,
      );
      if (attestationBountyIds.length >= REQUIRED_ATTESTATIONS) {
        completedTypes.push(auditType);
      }
    }
  }

  return completedTypes;
};

export interface AuditBountyWithDetails {
  id: bigint;
  projectName: string;
  auditType: string;
  reward: bigint;
  stake: bigint;
  status: 'Open' | 'Claimed' | 'In Prog' | 'Completed' | 'AwaitingClaim';
  claimedBy?: { toText: () => string };
  completedDate?: Date;
  results?: AuditResults;
  repo: string;
  commitHash: string;
  lockExpiresAt?: Date;
}

/**
 * Fetches and assembles all data for a single audit bounty.
 * This is the primary data source for the Audit Details page. It orchestrates
 * calls to the registry and audit hub to build a complete, UI-friendly object.
 *
 * @param bountyId The ID of the bounty to fetch.
 * @returns A complete AuditBounty object, or null if not found.
 */
/**
 * Fetches and assembles all data for a single audit bounty.
 * This is the primary data source for the Audit Details page.
 */
export const getAuditBounty = async (
  identity: Identity | undefined,
  bountyId: bigint,
): Promise<AuditBountyWithDetails | null> => {
  const registryActor = getRegistryActor();
  const auditHubActor = getAuditHubActor();

  // 1. Fetch the core ICRC-127 bounty record from audit_hub.
  const rawBountyOpt = await auditHubActor.icrc127_get_bounty(bountyId);
  if (rawBountyOpt.length === 0) return null;

  const rawBounty = rawBountyOpt[0];

  // Skip old bounties that don't have challenge_parameters (legacy data)
  if (!rawBounty.challenge_parameters) {
    console.warn(
      `Bounty ${bountyId} is missing challenge_parameters - skipping (legacy bounty)`,
    );
    return null;
  }

  const processed = processBounty(rawBounty);

  // Get wasm_id from challenge parameters (it's a hex string)
  const wasmId =
    processed.challengeParameters?.wasm_id || processed.wasmHashHex;
  if (!wasmId) {
    console.error(
      'Failed to extract wasm_id. Challenge params:',
      processed.challengeParameters,
      'wasmHashHex:',
      processed.wasmHashHex,
    );
    throw new Error('Bounty missing wasm_id in challenge parameters');
  }

  // 2. Fetch ancillary data, using the unified audit records endpoint.
  const [
    verificationRequest,
    allAuditRecords, // <-- CORRECTLY NAMED: This contains both attestations and divergences
    bountyLockOpt,
    bountyStakeOpt,
  ] = await Promise.all([
    registryActor.get_verification_request(wasmId),
    getAuditRecordsForWasm(wasmId), // <-- CORRECT: Using the unified fetcher
    auditHubActor.get_bounty_lock(bountyId),
    auditHubActor.get_stake_requirement(
      processed.challengeParameters.audit_type,
    ),
  ]);

  const bountyLock: AuditHub.BountyLock | undefined =
    fromNullable(bountyLockOpt);
  const bountyStakeResult = fromNullable(bountyStakeOpt);
  const bountyStake: bigint | undefined = bountyStakeResult
    ? (bountyStakeResult as [any, bigint])[1]
    : undefined;

  // 3. Determine the final status by finding the matching audit record (of any type).
  let status: AuditBountyWithDetails['status'] = 'Open';
  let results: AuditResults | undefined;
  let completedDate: Date | undefined;
  let lockExpiresAt: Date | undefined;

  // --- KEY CHANGE #1: Find the matching record by checking metadata correctly for each type ---
  const matchingRecord = allAuditRecords.find(
    (record: ProcessedAuditRecord) => {
      // The metadata, which contains the bounty_id, is in a different place for each type.
      const meta = record.metadata;
      return meta.bounty_id === bountyId;
    },
  );

  if (matchingRecord) {
    status = 'Completed';
    completedDate = new Date(Number(matchingRecord.timestamp / 1_000_000n));

    // --- KEY CHANGE #2: Use the discriminated union 'type' to set the results ---
    if (matchingRecord.type === 'attestation') {
      results = {
        type: 'success',
        data: matchingRecord.metadata as AttestationData,
        auditor: matchingRecord.auditor,
      };
    } else {
      // type is 'divergence'
      results = {
        type: 'failure',
        reason: matchingRecord.report,
      };
    }
  } else if (bountyLock) {
    status = 'In Prog';
    lockExpiresAt = nsToDate(bountyLock.expires_at);
  }

  // --- KEY CHANGE #3: The "Awaiting Claim" check must also handle the union type ---
  if (identity && status === 'Completed') {
    const currentUserPrincipal = identity.getPrincipal();
    // Find if the current user submitted the record for THIS bounty.
    const userSubmission = allAuditRecords.find(
      (record: ProcessedAuditRecord) => {
        if (record.metadata.bounty_id !== bountyId) return false;

        const author =
          record.type === 'attestation' ? record.auditor : record.reporter;
        return author.compareTo(currentUserPrincipal) === 'eq';
      },
    );

    if (userSubmission && processed.claims.length === 0) {
      status = 'AwaitingClaim';
    }
  }

  if (!fromNullable(verificationRequest)) {
    return null;
  }
  const processedRequest = processVerificationRequest(
    fromNullable(verificationRequest)!,
  );

  // Get claimedBy from the claims array, not the lock
  const claimedBy =
    processed.claims.length > 0 ? processed.claims[0].claimer : undefined;

  // 4. Assemble and return the final object.
  return {
    id: processed.id,
    projectName: wasmId,
    auditType: processed.challengeParameters.audit_type,
    reward: processed.tokenAmount,
    stake: bountyStake ?? 0n,
    status,
    claimedBy,
    completedDate,
    lockExpiresAt,
    results, // <-- This now holds the correctly typed result
    repo: processedRequest.repo,
    commitHash: processedRequest.commit_hash,
  };
};

/**
 * Fetches the full record for a single ICRC-127 bounty.
 * @param bounty_id The ID of the bounty to fetch.
 * @returns The full Bounty record, or undefined if not found.
 */
export const getBounty = async (
  bounty_id: bigint,
): Promise<AuditBounty | undefined> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.icrc127_get_bounty(bounty_id);
  return result.length > 0
    ? processBounty(result[0] as Registry.Bounty)
    : undefined;
};

export const getBountyLock = async (
  bounty_id: bigint,
): Promise<AuditHub.BountyLock | undefined> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.get_bounty_lock(bounty_id);
  return fromNullable(result);
};

/**
 * Get the required stake amount for a specific audit type from the Audit Hub.
 * @param audit_type The audit type to check (e.g., "app_info_v1").
 * @returns The required stake amount, or undefined if no requirement is set.
 */
export const getStakeRequirement = async (
  audit_type: string,
): Promise<bigint | undefined> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.get_stake_requirement(audit_type);
  const tuple = fromNullable(result);
  // Result is [TokenId, Balance] tuple - we want the Balance (second element)
  if (tuple && Array.isArray(tuple) && tuple.length === 2) {
    return tuple[1];
  }
  return undefined;
};

export interface ReserveBountyArgs {
  bounty_id: bigint; // The ID of the bounty to reserve
  token_id: string; // e.g., "app_info_v1"
}

/**
 * Stakes reputation tokens to reserve an exclusive lock on a bounty.
 * This is the mandatory first step for an auditor before filing an attestation.
 *
 * @throws If the reservation fails (e.g., insufficient stake, already reserved).
 */
export const reserveBounty = async (
  identity: Identity,
  args: ReserveBountyArgs,
): Promise<void> => {
  const { bounty_id, token_id } = args;
  const auditHubActor = getAuditHubActor(identity);

  const result = await auditHubActor.reserve_bounty(bounty_id, token_id);

  if ('err' in result) {
    throw new Error(`Failed to reserve bounty: ${JSON.stringify(result.err)}`);
  }
};

export interface ReserveBountyWithApiKeyArgs {
  api_key: string; // The verifier's API key
  bounty_id: bigint; // The ID of the bounty to reserve
  token_id: string; // e.g., "build_reproducibility_v1"
}

/**
 * Reserves a bounty using an API key instead of wallet authentication.
 * This is the preferred method for automated verifier bots.
 *
 * @throws If the reservation fails (e.g., insufficient stake, invalid API key, already reserved).
 */
export const reserveBountyWithApiKey = async (
  args: ReserveBountyWithApiKeyArgs,
): Promise<void> => {
  const { api_key, bounty_id, token_id } = args;
  const auditHubActor = getAuditHubActor(); // Anonymous actor - no identity needed

  const result = await auditHubActor.reserve_bounty_with_api_key(
    api_key,
    bounty_id,
    token_id,
  );

  if ('err' in result) {
    throw new Error(`Failed to reserve bounty: ${JSON.stringify(result.err)}`);
  }
};

export interface ClaimBountyArgs {
  bounty_id: bigint;
  wasm_id: string; // The lowercase hex string ID of the WASM
}

/**
 * Claims an open bounty by linking it to an existing attestation.
 * The attestation is identified by the combination of the caller's identity (the auditor)
 * and the wasm_id.
 *
 * @returns The ID of the newly created claim.
 */
export const claimBounty = async (
  identity: Identity,
  args: ClaimBountyArgs,
): Promise<bigint> => {
  const { bounty_id, wasm_id } = args;
  const auditHubActor = getAuditHubActor(identity);

  const request: BountySubmissionRequest = {
    account: [
      {
        owner: identity.getPrincipal(),
        subaccount: [],
      },
    ],
    bounty_id: bounty_id,
    submission: {
      Map: [['wasm_id', { Text: wasm_id }]],
    },
  };

  const result = await auditHubActor.icrc127_submit_bounty(request);

  if ('Error' in result) {
    throw new Error(`Failed to claim bounty: ${JSON.stringify(result.Error)}`);
  }

  return result.Ok.claim_id;
};

export interface FileAttestationArgs {
  wasm_id: string; // Use wasm_id (hex string) for consistency
  bounty_id: bigint;
  attestationData: AttestationData; // Accept the structured data object
}

/**
 * Files a new attestation for a specific WASM hash.
 * This function serializes the provided data into ICRC-16 format before sending.
 */
export const fileAttestation = async (
  identity: Identity,
  args: FileAttestationArgs,
): Promise<void> => {
  const { wasm_id, bounty_id, attestationData } = args;
  const registryActor = getRegistryActor(identity);

  // Serialize the structured data into the required on-chain format.
  const metadata = serializeToIcrc16Map(attestationData);

  const result = await registryActor.icrc126_file_attestation({
    wasm_id: wasm_id,
    metadata: [
      ...metadata,
      ['bounty_id', { Nat: bounty_id }], // Ensure the bounty_id is included
    ],
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to file attestation: ${JSON.stringify(result.Error)}`,
    );
  }
};

/**
 * The server url is the url of the canister, with the app_info.path appended.
 * We should handle local development and mainnet URLs.
 */
export function buildServerUrl(canisterId: Principal, path: string): string {
  const isLocal = process.env.DFX_NETWORK !== 'ic';
  const baseUrl = isLocal
    ? `http://localhost:4943/?canisterId=${canisterId.toText()}`
    : `https://${canisterId.toText()}.icp0.io`;

  // Create a URL object from the base URL to safely manipulate its parts.
  const url = new URL(baseUrl);

  // Set the pathname. This is the key fix.
  // It correctly preserves the existing query string for the local environment
  // and adds the path for the mainnet environment.
  url.pathname = path;

  return url.toString();
}

export interface BuildInfo {
  status: 'success' | 'failure' | 'unknown';
  gitCommit?: string;
  repoUrl?: string;
  failureReason?: string;
}

export type AuditResults =
  | { type: 'success'; data: Record<string, any>; auditor: Principal }
  | { type: 'failure'; reason: string };

export type DataSafetyInfo = {
  overallDescription: string;
  dataPoints: DataSafetyPoint[];
};

// A comprehensive object containing all details for a single, specific version.
export interface AppVersionDetails {
  wasmId: string;
  versionString: string;
  deploymentType?: string;
  status: 'Rejected' | 'Verified' | 'Pending';
  securityTier: SecurityTier;
  buildInfo: BuildInfo;
  tools: ServerTool[];
  dataSafety: DataSafetyInfo;
  bounties: AuditBounty[];
  auditRecords: ProcessedAuditRecord[];
  results?: AuditResults;
  created: bigint; // Timestamp in nanoseconds since epoch
}

// The new, primary data structure for the App Details page.
export interface AppStoreDetails {
  // --- Stable App Identity ---
  // These properties describe the app as a whole and rarely change.
  namespace: string; // The new, stable, primary identifier.
  name: string;
  path: string; // The MCP path, e.g., "/my-app"
  publisher: string;
  deploymentType: string;
  category: string;
  iconUrl: string;
  bannerUrl: string;
  galleryImages: string[];
  description: string;
  keyFeatures: string[];
  whyThisApp: string;
  tags: string[];
  reviews: any[]; // Reviews are for the app, not a specific version.

  // --- Version-Specific Information ---
  // This object contains the full details for the version being viewed (e.g., the latest).
  latestVersion: AppVersionDetails;

  // A list of all other available versions to populate the version selector dropdown.
  allVersions: AppVersionSummary[];
}

/**
 * Request parameters for the new list_bounties canister endpoint.
 */
export interface ListBountiesRequest {
  filter?: BountyFilterInput[];
  take?: bigint;
  prev?: bigint; // The bounty_id of the last item from the previous page
}

/**
 * Fetches a paginated and filtered list of all bounties from the registry.
 * This function processes the raw canister data into a clean, developer-friendly format.
 * @param identity The identity to use for the call (can be anonymous).
 * @param request The filter and pagination options for the query.
 */
export const listBounties = async (
  request: ListBountiesRequest,
): Promise<AuditBounty[]> => {
  const auditHubActor = getAuditHubActor();
  try {
    // 2. Transform the user-friendly request object into the format Candid expects.
    const requestFilters =
      request.filter?.map((f) => {
        if ('status' in f) {
          // We explicitly create the correct object shape in each branch.
          // The compiler can now correctly infer the type.
          let statusVariant;
          if (f.status === 'Open') {
            statusVariant = { Open: null };
          } else {
            // It must be 'Claimed'
            statusVariant = { Claimed: null };
          }
          return { status: statusVariant };
        }
        if ('audit_type' in f) {
          return { audit_type: f.audit_type };
        }
        if ('creator' in f) {
          return { creator: f.creator };
        }
        throw new Error(`Invalid filter provided: ${JSON.stringify(f)}`);
      }) || [];

    const candidRequest: BountyListingRequest = {
      filter: toNullable(requestFilters),
      take: toNullable(request.take),
      prev: toNullable(request.prev),
    };

    // 3. Call the new canister endpoint.
    const result = await auditHubActor.list_bounties(candidRequest);

    // 4. Handle the Result<> type returned by the canister.
    if ('err' in result) {
      // If the canister returns an error, throw it to be caught by the catch block.
      throw new Error(`Canister returned an error: ${result.err}`);
    }
    const rawBounties = result.ok;

    // 5. The processing logic remains the same, but now operates on the successful result.
    return rawBounties.map(processBounty);
  } catch (error) {
    console.error('Error fetching bounties:', error);
    return [];
  }
};

// 1. Define the new, complete, and ergonomic interface.
//    We use Maps for easy lookups in the frontend.
export interface VerifierProfile {
  total_verifications: bigint;
  reputation_score: bigint;
  total_earnings: bigint;
}

export interface PaymentTokenConfig {
  ledger_id: [] | [Principal];
  symbol: string;
  decimals: number;
}

/**
 * Fetches the complete profile for the current user's principal from the Audit Hub.
 *
 * @param identity The user's identity.
 * @param tokenId The token ID (ledger canister principal) to query balances for.
 * @returns The user's complete verifier profile.
 */
export const getVerifierProfile = async (
  identity: Identity,
  tokenId: string,
): Promise<VerifierProfile> => {
  const auditHubActor = getAuditHubActor(identity);
  const principal = identity.getPrincipal();

  const profile = await auditHubActor.get_verifier_profile(principal, tokenId);

  return profile;
};

/**
 * Fetches the available balance for a specific audit type.
 *
 * @param identity The user's identity.
 * @param auditType The audit type (e.g., "build_reproducibility_v1", "tools_v1").
 * @returns The available balance in atomic units.
 */
export const getAvailableBalanceByAuditType = async (
  identity: Identity,
  auditType: string,
): Promise<bigint> => {
  const auditHubActor = getAuditHubActor(identity);
  const principal = identity.getPrincipal();

  const balance = await auditHubActor.get_available_balance_by_audit_type(
    principal,
    auditType,
  );

  return balance;
};

/**
 * Fetches the staked balance for a specific token.
 *
 * @param identity The user's identity.
 * @param tokenId The token ID (ledger canister principal).
 * @returns The staked balance in atomic units.
 */
export const getStakedBalance = async (
  identity: Identity,
  tokenId: string,
): Promise<bigint> => {
  const auditHubActor = getAuditHubActor(identity);
  const principal = identity.getPrincipal();

  const balance = await auditHubActor.get_staked_balance(principal, tokenId);

  return balance;
};

/** Fetches a list of all pending verification requests from the registry.
 * Each request is fully processed and deserialized for easy consumption.
 * @returns An array of processed verification requests.
 */

/**
 * Lists all verification requests from the registry with optional pagination.
 *
 * @param offset - Starting index for pagination (default: 0)
 * @param limit - Maximum number of results to return (default: all)
 * @returns Object containing paginated requests and total count
 */
export const listAllVerificationRequests = async (
  offset?: number,
  limit?: number,
): Promise<{
  requests: ProcessedVerificationRecord[];
  total: number;
}> => {
  try {
    const registryActor = getRegistryActor();
    const result = await registryActor.list_all_verification_requests(
      offset !== undefined ? [BigInt(offset)] : [],
      limit !== undefined ? [BigInt(limit)] : [],
    );

    return {
      requests: result.requests.map(processVerificationRecord),
      total: Number(result.total),
    };
  } catch (error) {
    console.error('Error listing all verification requests:', error);
    return { requests: [], total: 0 };
  }
};

export const listPendingVerifications = async (): Promise<
  ProcessedVerificationRecord[]
> => {
  const registryActor = getRegistryActor();

  const requests = await registryActor.list_pending_verifications();

  return requests.map(processVerificationRecord);
};

export interface SubmitDivergenceArgs {
  bountyId: bigint;
  wasmId: string;
  reason: string;
  auditType?: string;
}

/**
 * Submits a divergence report for a failed build verification.
 * @param args - The arguments for the divergence report.
 * @returns The result from the canister.
 */
export const submitDivergence = async (
  identity: Identity,
  { bountyId, wasmId, reason, auditType }: SubmitDivergenceArgs,
) => {
  const actor = getRegistryActor(identity);

  // The canister requires the bounty_id and audit_type in the metadata for authorization.
  const metadata: ICRC16Map = [['bounty_id', { Nat: bountyId }]];

  if (auditType) {
    metadata.push(['126:audit_type', { Text: auditType }]);
  }

  const result = await actor.icrc126_file_divergence({
    wasm_id: wasmId,
    divergence_report: reason,
    metadata: [metadata], // Note: metadata is optional, so it's wrapped in an array
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to submit divergence: ${Object.keys(result.Error)[0]}`,
    );
  }

  return result.Ok;
};

/**
 * Submits a divergence report using an API key for authentication.
 * This is used by verifier bots that authenticate with API keys instead of identities.
 * @param apiKey - The verifier's API key
 * @param args - The arguments for the divergence report
 * @returns The result from the canister
 */
export const submitDivergenceWithApiKey = async (
  apiKey: string,
  { bountyId, wasmId, reason, auditType }: SubmitDivergenceArgs,
) => {
  const actor = getRegistryActor();

  const metadata: ICRC16Map = [['bounty_id', { Nat: bountyId }]];

  if (auditType) {
    metadata.push(['126:audit_type', { Text: auditType }]);
  }

  const result = await actor.icrc126_file_divergence_with_api_key(apiKey, {
    wasm_id: wasmId,
    divergence_report: reason,
    metadata: [metadata],
  });

  if ('Error' in result) {
    const errorType = Object.keys(result.Error)[0];
    const errorValue = result.Error[errorType as keyof typeof result.Error];
    const errorMsg = typeof errorValue === 'string' ? errorValue : errorType;
    throw new Error(`Failed to submit divergence: ${errorMsg}`);
  }

  return result.Ok;
};

export interface FileAttestationWithApiKeyArgs {
  wasm_id: string;
  bounty_id: bigint;
  attestationData: AttestationData;
}

/**
 * Files an attestation for a successful build verification using an API key.
 * This is used by verifier bots that authenticate with API keys instead of identities.
 * @param apiKey - The verifier's API key
 * @param args - The arguments for the attestation
 * @returns The result from the canister
 */
export const fileAttestationWithApiKey = async (
  apiKey: string,
  args: FileAttestationWithApiKeyArgs,
): Promise<void> => {
  const { wasm_id, bounty_id, attestationData } = args;
  const actor = getRegistryActor();

  // Serialize the structured data into the required on-chain format
  const metadata = serializeToIcrc16Map(attestationData);

  const result = await actor.icrc126_file_attestation_with_api_key(apiKey, {
    wasm_id: wasm_id,
    metadata: [...metadata, ['bounty_id', { Nat: bounty_id }]],
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to file attestation: ${JSON.stringify(result.Error)}`,
    );
  }

  return result.Ok;
};

export interface ClaimBountyWithApiKeyArgs {
  bounty_id: bigint;
  wasm_id: string;
}

/**
 * Claims a bounty after successfully filing an attestation using an API key.
 * This links the bounty to the verifier's attestation and triggers payout.
 * @param apiKey - The verifier's API key
 * @param args - The bounty_id and wasm_id for the claim
 * @returns The claim ID
 */
export const claimBountyWithApiKey = async (
  apiKey: string,
  args: ClaimBountyWithApiKeyArgs,
): Promise<bigint> => {
  const { bounty_id, wasm_id } = args;
  const auditHubActor = getAuditHubActor();

  // Validate the API key and get the verifier's principal
  const validateResult = await auditHubActor.validate_api_key(apiKey);
  if ('err' in validateResult) {
    throw new Error(`Invalid API key: ${validateResult.err}`);
  }
  const verifierPrincipal = validateResult.ok;

  const request: BountySubmissionRequest = {
    account: [
      {
        owner: verifierPrincipal,
        subaccount: [],
      },
    ],
    bounty_id: bounty_id,
    submission: {
      Map: [['wasm_id', { Text: wasm_id }]],
    },
  };

  const result = await auditHubActor.icrc127_submit_bounty(request);

  if ('Error' in result) {
    throw new Error(`Failed to claim bounty: ${JSON.stringify(result.Error)}`);
  }

  return result.Ok.claim_id;
};

/**
 * Fetches the complete audit history (attestations and divergences) for a given WASM ID.
 */
export const getAuditRecordsForWasm = async (
  wasmId: string,
): Promise<ProcessedAuditRecord[]> => {
  const actor = getRegistryActor();
  const rawRecords = await actor.get_audit_records_for_wasm(wasmId);

  return rawRecords.map((record: Registry.AuditRecord) => {
    if ('Attestation' in record) {
      const att = record.Attestation;
      return {
        type: 'attestation',
        auditor: att.auditor,
        audit_type: att.audit_type,
        metadata: deserializeFromIcrc16Map(att.metadata),
        timestamp: att.timestamp,
      };
    } else {
      // 'Divergence' in record
      const div = record.Divergence;
      return {
        type: 'divergence',
        reporter: div.reporter,
        report: div.report,
        metadata:
          div.metadata.length > 0
            ? deserializeFromIcrc16Map(div.metadata[0]!)
            : {},
        timestamp: div.timestamp,
      };
    }
  });
};

/**
 * Helper function to get bounties for a specific WASM ID.
 * Used by the verifier bot to check if a pending verification has a bounty.
 */
export const getBountiesForWasm = async (
  wasmId: string,
): Promise<AuditBounty[]> => {
  const auditHubActor = getAuditHubActor();

  // Use the list_bounties method with wasm_id filter
  const result = await auditHubActor.list_bounties({
    filter: [[{ wasm_id: wasmId }]],
    take: [],
    prev: [],
  });

  if ('err' in result) {
    throw new Error(`Failed to get bounties for WASM: ${result.err}`);
  }

  return result.ok.map(processBounty);
};

/**
 * Helper function to check if a specific principal has already participated
 * in the verification of a WASM by checking all recorded bounty locks.
 * Used by the verifier bot to avoid attempting duplicate participation.
 *
 * @param wasmId The WASM ID to check
 * @param apiKey The verifier's API key (will be used to determine the principal)
 */
export const hasVerifierParticipatedWithApiKey = async (
  wasmId: string,
  apiKey: string,
): Promise<boolean> => {
  const bountySponsorActor = getBountySponsorActor();
  const auditHubActor = getAuditHubActor();

  // First, validate the API key and get the verifier's principal
  const validateResult = await auditHubActor.validate_api_key(apiKey);
  if ('err' in validateResult) {
    throw new Error(`Invalid API key: ${validateResult.err}`);
  }
  const verifierPrincipal = validateResult.ok;

  // Get all bounties for this WASM from bounty_sponsor
  const rawBounties =
    await bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId);
  const bounties = rawBounties.map(processBounty);

  // Check each bounty to see if our verifier has claimed it (and lock is not expired)
  for (const bounty of bounties) {
    const lock = await auditHubActor.get_bounty_lock(bounty.id);
    const bountyLock: AuditHub.BountyLock | undefined = fromNullable(lock);

    if (
      bountyLock &&
      bountyLock.claimant.compareTo(verifierPrincipal) === 'eq'
    ) {
      // Check if the lock is expired
      const currentTime = BigInt(Date.now()) * 1_000_000n; // Convert to nanoseconds
      const isExpired = currentTime > bountyLock.expires_at;

      if (!isExpired) {
        return true; // This verifier has an active (non-expired) lock
      }
      // If expired, continue checking other bounties
    }
  }

  return false;
};

/**
 * Gets the specific bounty that a verifier has locked for a given WASM.
 * Returns the bounty object if found, null otherwise.
 */
export const getLockedBountyForVerifier = async (
  wasmId: string,
  apiKey: string,
): Promise<AuditBounty | null> => {
  const bountySponsorActor = getBountySponsorActor();
  const auditHubActor = getAuditHubActor();

  // First, validate the API key and get the verifier's principal
  const validateResult = await auditHubActor.validate_api_key(apiKey);
  if ('err' in validateResult) {
    throw new Error(`Invalid API key: ${validateResult.err}`);
  }
  const verifierPrincipal = validateResult.ok;

  // Get all bounties for this WASM from bounty_sponsor
  const rawBounties =
    await bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId);
  const bounties = rawBounties.map(processBounty);

  // Check each bounty to see if our verifier has claimed it
  for (const bounty of bounties) {
    const lock = await auditHubActor.get_bounty_lock(bounty.id);
    const bountyLock: AuditHub.BountyLock | undefined = fromNullable(lock);

    if (
      bountyLock &&
      bountyLock.claimant.compareTo(verifierPrincipal) === 'eq'
    ) {
      return bounty; // Found the bounty this verifier has locked
    }
  }

  return null; // Verifier has not locked any bounty for this WASM
};

/**
 * Gets the verification progress (attestation count) for a specific WASM and audit type.
 * Returns array of bounty IDs that have filed successful attestations.
 */
export const getVerificationProgress = async (
  wasmId: string,
  auditType: string,
): Promise<bigint[]> => {
  const registryActor = getRegistryActor();
  return await registryActor.get_verification_progress(wasmId, auditType);
};

/**
 * Gets the divergence progress (divergence report count) for a specific WASM and audit type.
 * Returns array of bounty IDs that have filed divergence reports.
 */
export const getDivergenceProgress = async (
  wasmId: string,
  auditType: string,
): Promise<bigint[]> => {
  const registryActor = getRegistryActor();
  return await registryActor.get_divergence_progress(wasmId, auditType);
};

/**
 * Deposits USDC stake into the verifier's account.
 * This function performs a two-step process:
 * 1. Approves the Audit Hub canister to spend USDC on behalf of the user (ICRC-2 approve)
 * 2. Calls deposit_stake on the Audit Hub to transfer and credit the stake
 *
 * The deposited amount goes into the verifier's available balance pool and can be used
 * to reserve bounties or generate API keys.
 *
 * @param identity The verifier's identity
 * @param amount The amount to deposit in smallest units (e.g., 1 USDC = 1_000_000 units)
 * @param token The payment token object with canister ID and conversion methods
 */
export const depositStake = async (
  identity: Identity,
  amount: bigint,
  token: Token,
): Promise<void> => {
  const auditHubCanisterId = Principal.fromText(getCanisterId('AUDIT_HUB'));

  console.log('[depositStake] Input values:', {
    amount: amount.toString(),
    tokenFee: token.fee,
    tokenDecimals: token.decimals,
  });

  // Step 1: Approve the Audit Hub to spend USDC on behalf of the user
  // We need to approve amount + fee so the transfer has enough allowance
  const feeBigInt = BigInt(token.fee);
  const approvalAmount = amount + feeBigInt;

  console.log('[depositStake] Approval calculation:', {
    feeBigInt: feeBigInt.toString(),
    approvalAmount: approvalAmount.toString(),
  });

  // approveAllowance expects a number but just does BigInt(amount) without conversion
  // So we pass the atomic amount as a number directly
  const approvalAmountNumber = Number(approvalAmount);

  console.log('[depositStake] Calling approveAllowance with:', {
    approvalAmountNumber,
    spender: auditHubCanisterId.toText(),
  });

  await approveAllowance(
    identity,
    token,
    auditHubCanisterId,
    approvalAmountNumber,
  );

  console.log('[depositStake] Approval successful, calling deposit_stake');

  // Step 2: Call deposit_stake which will transfer from user to audit hub
  const auditHubActor = getAuditHubActor(identity);
  const result = await auditHubActor.deposit_stake(
    token.canisterId.toText(),
    amount,
  );

  if ('err' in result) {
    throw new Error(result.err);
  }

  console.log('[depositStake] Deposit successful');
};

/**
 * Withdraws USDC stake from the verifier's account back to their wallet.
 * Only available balance (not staked in active bounties) can be withdrawn.
 *
 * @param identity The verifier's identity
 * @param amount The amount to withdraw in smallest units (e.g., 1 USDC = 1_000_000 units)
 * @param tokenId The token ID (ledger canister principal as text)
 */
export const withdrawStake = async (
  identity: Identity,
  amount: bigint,
  tokenId: string,
): Promise<void> => {
  const auditHubActor = getAuditHubActor(identity);
  const result = await auditHubActor.withdraw_stake(tokenId, amount);

  if ('err' in result) {
    throw new Error(result.err);
  }
};

/**
 * Generates a new API key for the verifier.
 * Returns the newly created API key string.
 *
 * @param identity The verifier's identity
 * @returns The generated API key (starts with "vr_")
 */
export const generateApiKey = async (identity: Identity): Promise<string> => {
  const auditHubActor = getAuditHubActor(identity);
  const result = await auditHubActor.generate_api_key();

  if ('err' in result) {
    throw new Error(result.err);
  }

  return result.ok;
};

/**
 * Revokes an existing API key.
 *
 * @param identity The verifier's identity
 * @param apiKey The API key to revoke
 */
export const revokeApiKey = async (
  identity: Identity,
  apiKey: string,
): Promise<void> => {
  const auditHubActor = getAuditHubActor(identity);
  const result = await auditHubActor.revoke_api_key(apiKey);

  if ('err' in result) {
    throw new Error(result.err);
  }
};

/**
 * Lists all API keys for the authenticated verifier.
 *
 * @param identity The verifier's identity
 * @returns Array of API credentials with creation date, last used, and active status
 */
export const listApiKeys = async (
  identity: Identity,
): Promise<AuditHub.ApiCredential[]> => {
  const auditHubActor = getAuditHubActor(identity);
  return await auditHubActor.list_api_keys();
};

/**
 * Requests a verification job assignment from the audit hub job queue.
 * This is the new request-based flow that eliminates race conditions.
 * The audit hub atomically assigns a unique job to this verifier.
 *
 * @param apiKey The verifier's API key
 * @returns Verification job assignment with bounty_id, wasm_id, repo, commit, etc.
 * @throws Error if no jobs available or verifier already has an active assignment
 */
export interface VerificationJobAssignment {
  bounty_id: bigint;
  wasm_id: string;
  repo: string;
  commit_hash: string;
  build_config: Array<[string, any]>;
  expires_at: bigint;
}

/**
 * Check if verification jobs are available (FREE query call).
 * Use this to poll frequently without burning cycles.
 * Only call requestVerificationJob() when this returns true.
 *
 * @param apiKey The verifier's API key
 * @returns true if jobs are available for this verifier
 */
export const hasAvailableJobs = async (apiKey: string): Promise<boolean> => {
  const auditHubActor = getAuditHubActor();
  return await auditHubActor.has_available_jobs(apiKey);
};

export const requestVerificationJob = async (
  apiKey: string,
): Promise<VerificationJobAssignment | null> => {
  const auditHubActor = getAuditHubActor();
  const result =
    await auditHubActor.request_verification_job_with_api_key(apiKey);

  if ('err' in result) {
    // No jobs available is expected, not an error
    if (result.err.includes('No verification jobs available')) {
      return null;
    }
    throw new Error(`Failed to request verification job: ${result.err}`);
  }

  const job = result.ok;
  return {
    bounty_id: job.bounty_id,
    wasm_id: job.wasm_id,
    repo: job.repo,
    commit_hash: job.commit_hash,
    build_config: job.build_config,
    expires_at: job.expires_at,
  };
};

/**
 * Releases a job assignment when verification is complete or expired.
 *
 * @param apiKey The verifier's API key
 * @param bountyId The bounty ID to release
 */
export const releaseJobAssignment = async (
  apiKey: string,
  bountyId: bigint,
): Promise<void> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.release_job_assignment(bountyId);

  if ('err' in result) {
    throw new Error(`Failed to release job assignment: ${result.err}`);
  }
};

export interface PendingJob {
  queueKey: string;
  wasmId: string;
  repo: string;
  commitHash: string;
  auditType: string;
  requiredVerifiers: number;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  bountyIds: bigint[];
  createdAt: Date;
}

/**
 * Lists all pending verification jobs from the audit hub with pagination.
 * This is more efficient than fetching individual bounties.
 *
 * @param offset - Starting index for pagination (optional)
 * @param limit - Maximum number of results to return (optional)
 * @returns Object with paginated jobs array and total count
 */
export const listPendingJobs = async (
  offset?: number,
  limit?: number,
): Promise<{ jobs: PendingJob[]; total: number }> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.list_pending_jobs(
    offset !== undefined ? [BigInt(offset)] : [],
    limit !== undefined ? [BigInt(limit)] : [],
  );

  const jobs = result.jobs.map(([queueKey, job]: [string, any]) => ({
    queueKey,
    wasmId: job.wasm_id,
    repo: job.repo,
    commitHash: job.commit_hash,
    auditType: job.audit_type,
    requiredVerifiers: Number(job.required_verifiers),
    assignedCount: Number(job.assigned_count),
    inProgressCount: Number(job.in_progress_count),
    completedCount: Number(job.completed_count),
    bountyIds: job.bounty_ids,
    createdAt: nsToDate(job.created_at),
  }));

  return {
    jobs,
    total: Number(result.total),
  };
};

/**
 * Get a specific pending job by its queue key.
 * Much more efficient than listing all jobs when you need one specific job.
 */
export const getPendingJob = async (
  queueKey: string,
): Promise<PendingJob | null> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.get_pending_job(queueKey);

  if (result.length === 0) {
    return null;
  }

  const job = result[0];
  return {
    queueKey,
    wasmId: job.wasm_id,
    repo: job.repo,
    commitHash: job.commit_hash,
    auditType: job.audit_type,
    requiredVerifiers: Number(job.required_verifiers),
    assignedCount: Number(job.assigned_count),
    inProgressCount: Number(job.in_progress_count),
    completedCount: Number(job.completed_count),
    bountyIds: job.bounty_ids,
    createdAt: nsToDate(job.created_at),
  };
};

/**
 * Get all bounties for a specific job by its queue key.
 * Most efficient way to fetch bounties for a job - single query, pre-filtered.
 */
export const getBountiesForJob = async (
  queueKey: string,
): Promise<AuditBounty[]> => {
  const auditHubActor = getAuditHubActor();
  const bounties = await auditHubActor.get_bounties_for_job(queueKey);
  return bounties.map(processBounty);
};

/**
 * Get all bounties and their locks for a specific job by its queue key.
 * Single query that returns both bounties and locks - much more efficient than N separate lock requests.
 */
export const getBountiesWithLocksForJob = async (
  queueKey: string,
): Promise<{
  bounties: AuditBounty[];
  locks: Map<string, AuditHub.BountyLock>;
}> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.get_bounties_with_locks_for_job(queueKey);

  const bounties: AuditBounty[] = [];
  const locks = new Map<string, AuditHub.BountyLock>();

  for (const [bounty, lock] of result) {
    const processedBounty = processBounty(bounty);
    bounties.push(processedBounty);

    if (lock.length > 0) {
      locks.set(processedBounty.id.toString(), lock[0]);
    }
  }

  return { bounties, locks };
};
