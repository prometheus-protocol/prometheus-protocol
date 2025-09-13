/**
 * @file This file contains the API for interacting with the audit and bounty
 *       systems of the Prometheus Protocol. It includes functions for managing
 *       ICRC-127 bounties, ICRC-126 attestations, and interacting with the
 *       Audit Hub canister for staking and reservations.
 */

import { Identity } from '@dfinity/agent';
import { getAuditHubActor, getRegistryActor } from '../actors.js';
import { AuditHub, Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';
import {
  AttestationRecord,
  BountyListingRequest,
  ICRC16Map,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import {
  calculateSecurityTier,
  hexToUint8Array,
  nsToDate,
  processAttestation,
  processBounty,
  processVerificationRecord,
  processVerificationRequest,
  uint8ArrayToHex,
} from '../utils.js';
import { fromNullable, toNullable } from '@dfinity/utils';
import {
  deserializeFromIcrc16Map,
  deserializeIcrc16Value,
  serializeToIcrc16Map,
} from '../icrc16.js';
import { Token } from '../tokens.js';

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

export type SecurityTier = 'Gold' | 'Silver' | 'Bronze' | 'Unranked';

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
    registryActor.get_bounties_for_wasm(wasmId),
  ]);

  const verificationRequest = fromNullable(verificationResult);
  const processedRequest: ProcessedVerificationRequest | null =
    verificationRequest
      ? processVerificationRequest(verificationRequest)
      : null;

  // --- 2. Process the audit records using a type guard ---
  // The result is now an array of our discriminated union type.
  const processedAuditRecords: ProcessedAuditRecord[] = auditRecordsResult.map(
    (record): ProcessedAuditRecord => {
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
    },
  );

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

  const registryActor = getRegistryActor(identity);

  const request: Registry.CreateBountyRequest = {
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

  const result = await registryActor.icrc127_create_bounty(request);

  if ('Error' in result) {
    throw new Error(`Failed to create bounty: ${JSON.stringify(result.Error)}`);
  }

  return result.Ok.bounty_id;
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
export interface SecurityAttestationData {
  '126:audit_type': 'security_v1';
  summary: string;
  issues_found: { severity: string; description: string }[];
}

export interface ToolsAttestationData {
  '126:audit_type': 'tools_v1';
  tools: { name: string; description: string; cost: number; token: string }[];
}

export interface BuildReproducibilityAttestationData {
  '126:audit_type': 'build_reproducibility_v1';
  status: 'success' | 'failure';
  git_commit: string;
  repo_url: string;
  failure_reason?: string;
}

export type AttestationData =
  | AppInfoAttestationData
  | SecurityAttestationData
  | ToolsAttestationData
  | BuildReproducibilityAttestationData
  | Record<string, unknown>; // Fallback for unknown types

// Define the core audits that determine security tiers.
export const CORE_AUDIT_TYPES = [
  'tools_v1',
  'build_reproducibility_v1',
  'app_info_v1',
  'data_safety_v1',
];

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

  // 1. Fetch the core ICRC-127 bounty record (unchanged).
  const rawBountyOpt = await registryActor.icrc127_get_bounty(bountyId);
  if (rawBountyOpt.length === 0) return null;
  const processed = processBounty(rawBountyOpt[0]);
  const wasmId = uint8ArrayToHex(processed.challengeParameters.wasm_hash);

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
  const bountyStake: bigint | undefined = fromNullable(bountyStakeOpt);

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
    const userSubmission = allAuditRecords.find((record) => {
      if (record.metadata.bounty_id !== bountyId) return false;

      const author =
        record.type === 'attestation' ? record.auditor : record.reporter;
      return author.compareTo(currentUserPrincipal) === 'eq';
    });

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

  // 4. Assemble and return the final object.
  return {
    id: processed.id,
    projectName: wasmId,
    auditType: processed.challengeParameters.audit_type,
    reward: processed.tokenAmount,
    stake: bountyStake ?? 0n,
    status,
    claimedBy: bountyLock?.claimant,
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
  const registryActor = getRegistryActor();
  const result = await registryActor.icrc127_get_bounty(bounty_id);
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
 * @param audit_type The audit type to check (e.g., "security_v1").
 * @returns The required stake amount, or undefined if no requirement is set.
 */
export const getStakeRequirement = async (
  audit_type: string,
): Promise<bigint | undefined> => {
  const auditHubActor = getAuditHubActor();
  const result = await auditHubActor.get_stake_requirement(audit_type);
  return fromNullable(result);
};

export interface ReserveBountyArgs {
  bounty_id: bigint; // The ID of the bounty to reserve
  token_id: string; // e.g., "security_v1"
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
  const registryActor = getRegistryActor(identity);

  const request: Registry.BountySubmissionRequest = {
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

  const result = await registryActor.icrc127_submit_bounty(request);

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
function buildServerUrl(canisterId: Principal, path: string): string {
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
  gitCommit: string | null;
  repoUrl: string | null;
  canisterId: string | null;
  failureReason: string | null;
}

export type AuditResults =
  | { type: 'success'; data: Record<string, any> }
  | { type: 'failure'; reason: string };

export interface AppStoreDetails {
  id: string;
  name: string;
  publisher: string;
  serverUrl: string;
  category: string;
  securityTier: SecurityTier;
  iconUrl: string;
  bannerUrl: string;
  galleryImages: string[];
  description: string;
  keyFeatures: string[];
  whyThisApp: string;
  tags: string[];
  tools: ServerTool[];
  dataSafety: {
    description: string;
    points: DataSafetyPoint[];
  };
  security: {
    summary: string;
    issuesFound: ServerSecurityIssue[];
  };
  reviews: any[]; // To be implemented later
  bounties: AuditBounty[];
  auditRecords: ProcessedAuditRecord[];
  results?: AuditResults;
  buildInfo: BuildInfo;
  status: 'Now Available' | 'Coming Soon';
}

/**
 * Fetches and assembles all on-chain data for a specific WASM hash.
 * This is the primary function for the App Details page.
 * @param wasmId The lowercase hex string ID of the WASM.
 */
export const getAppDetailsByHash = async (
  wasmId: string,
): Promise<AppStoreDetails> => {
  // Initialize a complete, type-safe default object.
  const details: AppStoreDetails = {
    id: wasmId,
    name: '',
    publisher: '',
    serverUrl: '',
    category: '',
    securityTier: 'Unranked', // Default to 'Unranked' if not set
    iconUrl: '',
    bannerUrl: '',
    galleryImages: [],
    description: '',
    keyFeatures: [],
    whyThisApp: '',
    tags: [],
    tools: [],
    dataSafety: {
      description: '',
      points: [],
    },
    security: {
      summary: '',
      issuesFound: [],
    },
    reviews: [],
    bounties: [],
    auditRecords: [],
    results: undefined,
    buildInfo: {
      // Initialize with default values
      status: 'unknown',
      gitCommit: null,
      repoUrl: null,
      canisterId: null,
      failureReason: null,
    },
    status: 'Coming Soon', // Default to 'Coming Soon'
  };

  const registryActor = getRegistryActor();

  try {
    // 1. Fetch all necessary data in parallel, including the definitive verification status.
    const [
      isVerifiedResult,
      auditRecordsResult,
      bountiesResult,
      verificationRequestResult,
    ] = await Promise.all([
      registryActor.is_wasm_verified(wasmId),
      getAuditRecordsForWasm(wasmId),
      registryActor.get_bounties_for_wasm(wasmId),
      registryActor.get_verification_request(wasmId),
    ]);

    details.bounties = bountiesResult.map(processBounty);
    const allAuditRecords = auditRecordsResult; // This now contains both types

    // 2. Find and process the specific Build Reproducibility record first.
    const buildRecord = allAuditRecords.find(
      (record) =>
        (record.type === 'attestation' &&
          record.audit_type === 'build_reproducibility_v1') ||
        record.type === 'divergence', // In our system, divergence is only for build failures
    );

    if (buildRecord) {
      if (buildRecord.type === 'attestation') {
        const payload = buildRecord.metadata;
        details.buildInfo = {
          status: 'success',
          gitCommit: payload.git_commit || null,
          repoUrl: payload.repo_url || null,
          canisterId: payload.canister_id || null,
          failureReason: null,
        };
      } else {
        // It's a divergence record
        details.buildInfo = {
          status: 'failure',
          // For now, we get the reason. We can enrich this later if needed.
          failureReason: buildRecord.report,
          gitCommit: null, // Not available in divergence report
          repoUrl: null, // Not available in divergence report
          canisterId: null, // Not available in divergence report
        };
      }
    }

    // 3. Process all OTHER (declarative) attestations to populate app info.
    const declarativeAttestations = allAuditRecords.filter(
      (record): record is ProcessedAttestationRecord =>
        record.type === 'attestation' &&
        record.audit_type !== 'build_reproducibility_v1',
    );

    const appInfoAttestation = declarativeAttestations.find(
      (att) => att.audit_type === 'app_info_v1',
    );

    if (appInfoAttestation) {
      // --- PATH A: APP IS FULLY LISTED ---
      // We have an app_info_v1 attestation, so it's the source of truth.
      const payload = appInfoAttestation.metadata;
      const serverUrl = buildServerUrl(
        Principal.fromText(payload.canister_id),
        payload.mcp_path || '',
      );
      details.name = payload.name || '';
      details.publisher = payload.publisher || '';
      details.serverUrl = serverUrl;
      details.category = payload.category || '';
      details.iconUrl = payload.icon_url || '';
      details.bannerUrl = payload.banner_url || '';
      details.galleryImages = payload.gallery_images || [];
      details.description = payload.description || '';
      details.keyFeatures = payload.key_features || [];
      details.whyThisApp = payload.why_this_app || '';
      details.tags = payload.tags || [];
      details.status = 'Now Available';
      details.auditRecords = allAuditRecords;
    } else {
      // --- PATH B: APP IS PENDING ---
      // No app_info_v1 attestation found. Fall back to the verification request metadata.
      const verificationRequest = fromNullable(verificationRequestResult);
      if (verificationRequest) {
        const payload =
          processVerificationRequest(verificationRequest).metadata;
        const serverUrl = buildServerUrl(
          Principal.fromText(payload.canister_id),
          payload.mcp_path || '',
        );
        details.name = payload.name || '';
        details.publisher = payload.publisher || '';
        details.serverUrl = serverUrl;
        details.category = payload.category || 'Coming Soon';
        details.description = payload.description || '';
        details.whyThisApp = payload.why_this_app || '';
        details.keyFeatures = payload.key_features || [];
        details.tags = payload.tags || [];
        // Visuals are nested in the verification request
        details.iconUrl = payload.visuals?.icon_url || '';
        details.bannerUrl = payload.visuals?.banner_url || '';
        details.galleryImages = payload.visuals?.gallery_images || [];
        details.status = 'Coming Soon';
        details.auditRecords = allAuditRecords;
      }
    }

    // 2. Loop through attestations and explicitly map data.
    for (const attestation of declarativeAttestations) {
      const payload = attestation.metadata;

      switch (attestation.audit_type) {
        case 'app_info_v1':
          console.log(
            `Processing attestation of type ${attestation.audit_type}:`,
            payload,
          );
          const serverUrl = buildServerUrl(
            Principal.fromText(payload.canister_id),
            payload.mcp_path || '',
          );
          // Explicitly assign each property with a safe fallback.
          details.name = payload.name || '';
          details.publisher = payload.publisher || '';
          details.serverUrl = serverUrl;
          details.category = payload.category || '';
          details.iconUrl = payload.icon_url || '';
          details.bannerUrl = payload.banner_url || '';
          details.galleryImages = payload.gallery_images || [];
          details.description = payload.description || '';
          details.keyFeatures = payload.key_features || [];
          details.whyThisApp = payload.why_this_app || '';
          details.tags = payload.tags || [];
          break;

        case 'security_v1':
          details.security.summary = payload.summary || '';
          if (payload.issues_found && Array.isArray(payload.issues_found)) {
            details.security.issuesFound = payload.issues_found;
          }
          break;

        case 'tools_v1': // Assuming the type is 'tools_v1' from the CLI template
          if (payload.tools && Array.isArray(payload.tools)) {
            details.tools = payload.tools;
          }
          break;

        case 'data_safety_v1':
          // This was already good, but we'll ensure it's consistent.
          details.dataSafety = {
            description: payload.overall_description || '', // Match template key
            points: payload.data_points || [], // Match template key
          };
          break;

        case 'build_reproducibility_v1':
          details.buildInfo = {
            status: payload.status || 'unknown',
            gitCommit: payload.git_commit || null,
            repoUrl: payload.repo_url || null,
            canisterId: payload.canister_id || null,
            failureReason: payload.failure_reason || null,
          };
          break;
      }
    }
    // 3. Set the security tier based on completed audit types.
    details.securityTier = calculateSecurityTier(
      isVerifiedResult,
      declarativeAttestations.map((a) => a.audit_type),
    );
  } catch (e) {
    console.error('Failed to parse attestation payload:', e);
  }

  return details;
};

// 1. Define the new, more powerful filter types that match the canister.
// Using a discriminated union in TypeScript is the perfect way to model this.

export interface ListBountiesRequestInput {
  filter?: BountyFilterInput[];
  take?: bigint;
  prev?: bigint;
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
  const registryActor = getRegistryActor();
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
    const result = await registryActor.list_bounties(candidRequest);

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

/** Fetches the reputation token balance for the caller's identity.
 * @param identity The identity of the caller.
 * @param token_id The ID of the reputation token (e.g., "security_v1").
 * @returns The available balance of the specified reputation token.
 */
export const getReputationBalance = async (
  identity: Identity,
  token_id: string,
): Promise<bigint> => {
  const auditHubActor = getAuditHubActor(identity);
  const result = await auditHubActor.get_available_balance(
    identity.getPrincipal(),
    token_id,
  );
  return result;
};

// 1. Define the new, complete, and ergonomic interface.
//    We use Maps for easy lookups in the frontend.
export interface AuditorProfile {
  reputation: Map<string, bigint>;
  available_balances: Map<string, bigint>;
  staked_balances: Map<string, bigint>;
}
/**
 * Fetches the complete profile for the current user's principal from the Audit Hub.
 * It transforms the canister's array-based response into a more ergonomic
 * object with Maps for easy data access.
 *
 * @param identity The user's identity.
 * @returns The user's complete auditor profile.
 */
export const getAuditorProfile = async (
  identity: Identity,
): Promise<AuditorProfile> => {
  const auditHubActor = getAuditHubActor(identity);
  const principal = identity.getPrincipal();

  // 2. Call the canister. The result is an optional record, which the agent
  //    represents as a single-element array `[record]` or an empty array `[]`.
  const profileResult = await auditHubActor.get_auditor_profile(principal);

  // 4. Destructure the record from the array.
  const rawProfile = profileResult;

  // 5. Transform the arrays of tuples into Maps and return the clean object.
  //    The Map constructor elegantly handles this conversion.
  return {
    reputation: new Map(rawProfile.reputation),
    available_balances: new Map(rawProfile.available_balances),
    staked_balances: new Map(rawProfile.staked_balances),
  };
};

/** Fetches a list of all pending verification requests from the registry.
 * Each request is fully processed and deserialized for easy consumption.
 * @returns An array of processed verification requests.
 */
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
}

/**
 * Submits a divergence report for a failed build verification.
 * @param args - The arguments for the divergence report.
 * @returns The result from the canister.
 */
export const submitDivergence = async (
  identity: Identity,
  { bountyId, wasmId, reason }: SubmitDivergenceArgs,
) => {
  const actor = getRegistryActor(identity);

  // The canister requires the bounty_id in the metadata for authorization.
  const metadata: ICRC16Map = [['bounty_id', { Nat: bountyId }]];

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
 * Fetches the complete audit history (attestations and divergences) for a given WASM ID.
 */
export const getAuditRecordsForWasm = async (
  wasmId: string,
): Promise<ProcessedAuditRecord[]> => {
  const actor = getRegistryActor();
  const rawRecords = await actor.get_audit_records_for_wasm(wasmId);

  return rawRecords.map((record) => {
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
