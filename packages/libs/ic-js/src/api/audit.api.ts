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

export interface VerificationStatus {
  isVerified: boolean;
  verificationRequest: ProcessedVerificationRequest | null;
  attestations: ProcessedAttestation[];
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
 * Fetches and PROCESSES the verification status for a given WASM hash.
 * @returns An object containing the final verification status and a list of
 *          fully deserialized attestations.
 */
export const getVerificationStatus = async (
  wasmId: string, // Lowercase hex string ID of the WASM
): Promise<VerificationStatus> => {
  const registryActor = getRegistryActor();

  const [
    isVerifiedResult,
    verificationResult,
    attestationsResult,
    bountiesResult,
  ] = await Promise.all([
    registryActor.is_wasm_verified(wasmId),
    registryActor.get_verification_request(wasmId),
    registryActor.get_attestations_for_wasm(wasmId),
    registryActor.get_bounties_for_wasm(wasmId),
  ]);

  const verificationRequest = fromNullable(verificationResult);

  const processedRequest: ProcessedVerificationRequest | null =
    verificationRequest
      ? processVerificationRequest(verificationRequest)
      : null;

  // 3. Process the attestations right here, in the API layer.
  const processedAttestations: ProcessedAttestation[] = attestationsResult.map(
    (att): ProcessedAttestation => ({
      audit_type: att.audit_type,
      timestamp: att.timestamp,
      auditor: att.auditor,
      // The deserialization happens here!
      payload: deserializeFromIcrc16Map(att.metadata),
    }),
  );

  const processedBounties: AuditBounty[] = bountiesResult.map(processBounty);

  return {
    isVerified: isVerifiedResult,
    verificationRequest: processedRequest,
    attestations: processedAttestations,
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
  results?: {
    attestationData: AttestationData;
  };
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
export const getAuditBounty = async (
  identity: Identity | undefined,
  bountyId: bigint,
): Promise<AuditBountyWithDetails | null> => {
  const registryActor = getRegistryActor();
  const auditHubActor = getAuditHubActor();

  console.log('identity', identity);

  // 1. Fetch the core ICRC-127 bounty record.
  const rawBountyOpt = await registryActor.icrc127_get_bounty(bountyId);
  if (rawBountyOpt.length === 0) {
    return null; // Bounty not found.
  }
  const processed = processBounty(rawBountyOpt[0]);

  const wasmHashBytes = processed.challengeParameters?.wasm_hash as
    | Uint8Array
    | undefined;
  if (!wasmHashBytes) {
    throw new Error(`Bounty #${bountyId} is malformed: missing wasm_hash.`);
  }
  const wasmId = uint8ArrayToHex(wasmHashBytes);

  // 2. Fetch ancillary data in parallel.
  const [verificationRequest, allAttestations, bountyLockOpt, bountyStakeOpt] =
    await Promise.all([
      registryActor.get_verification_request(wasmId),
      registryActor.get_attestations_for_wasm(wasmId),
      auditHubActor.get_bounty_lock(bountyId),
      auditHubActor.get_stake_requirement(
        processed.challengeParameters?.audit_type,
      ),
    ]);

  const bountyLock: AuditHub.BountyLock | undefined =
    fromNullable(bountyLockOpt);
  const bountyStake: bigint | undefined = fromNullable(bountyStakeOpt);

  // 3. Determine the final status and find the matching attestation.
  let status: AuditBountyWithDetails['status'] = 'Open';
  let results: AuditBountyWithDetails['results'] | undefined;
  let completedDate: AuditBountyWithDetails['completedDate'] | undefined;
  let lockExpiresAt: AuditBountyWithDetails['lockExpiresAt'] | undefined;

  const matchingAttestation = allAttestations.find(
    (att: Registry.AttestationRecord) => {
      const meta = deserializeFromIcrc16Map(att.metadata);
      return meta.bounty_id === bountyId;
    },
  );

  if (matchingAttestation) {
    status = 'Completed';
    completedDate = new Date(
      Number(matchingAttestation.timestamp / 1_000_000n),
    );
    results = {
      attestationData: deserializeFromIcrc16Map(
        matchingAttestation.metadata,
      ) as AttestationData,
    };
  } else if (bountyLock) {
    status = 'In Prog';
    lockExpiresAt = nsToDate(bountyLock.expires_at);
  }

  // This is the crucial new check. It runs AFTER the main status checks.
  if (identity && status === 'Completed') {
    const currentUserPrincipal = identity.getPrincipal();
    // Check if the current user has filed an attestation for this WASM
    const userAttestation = allAttestations.find(
      (att) => att.auditor.compareTo(currentUserPrincipal) === 'eq',
    );

    // If the user has an attestation, but the bounty has no claims,
    // we are in the special "Awaiting Claim" state.
    if (userAttestation && processed.claims.length === 0) {
      status = 'AwaitingClaim';
    }
  }

  if (!fromNullable(verificationRequest)) {
    return null; // No verification request means no valid audit.
  }

  const processedRequest = processVerificationRequest(
    fromNullable(verificationRequest)!,
  );

  // 4. Assemble and return the final, comprehensive object.
  return {
    id: processed.id,
    projectName: wasmId, // We don't have a project name on-chain yet
    auditType: processed.challengeParameters?.audit_type,
    reward: processed.tokenAmount,
    stake: bountyStake ?? 0n, // Stake comes from the lock
    status,
    claimedBy: bountyLock?.claimant,
    completedDate,
    lockExpiresAt,
    results,
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
  attestations: ProcessedAttestation[];
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
    attestations: [],
  };

  const registryActor = getRegistryActor();

  try {
    // 2. Fetch attestations AND bounties in parallel for better performance.
    const [attestationsResult, bountiesResult] = await Promise.all([
      registryActor.get_attestations_for_wasm(wasmId),
      registryActor.get_bounties_for_wasm(wasmId), // Assuming this method exists
    ]);
    details.bounties = bountiesResult.map(processBounty);
    details.attestations = attestationsResult.map(processAttestation);

    // 2. Loop through attestations and explicitly map data.
    const completedAuditTypes: string[] = [];
    for (const attestation of details.attestations) {
      completedAuditTypes.push(attestation.audit_type);
      const payload = attestation.payload;

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
          if (payload.status) {
            details.dataSafety.points.push({
              title: 'Build Reproducibility',
              description:
                payload.status === 'success'
                  ? 'This app has reproducible builds.'
                  : 'This app does not have reproducible builds.',
            });
          }
          break;
      }
    }
    // 3. Set the security tier based on completed audit types.
    details.securityTier = calculateSecurityTier(completedAuditTypes);
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
