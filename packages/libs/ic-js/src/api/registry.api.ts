import { Certificate, HttpAgent, Identity } from '@dfinity/agent';
import { getOrchestratorActor, getRegistryActor } from '../actors.js';
import { Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';
import {
  AppListing,
  BountyListingRequest,
  BountyStatus,
  CanisterType,
  GetCanisterTypesRequest,
  ICRC16Map,
  PendingSubmission,
  VerificationOutcome,
  VerificationRequest,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import { calculateSecurityTier, nsToDate } from '../utils.js';
import { fromNullable, toNullable } from '@dfinity/utils';
import { deserializeFromIcrc16Map, deserializeIcrc16Value } from '../icrc16.js';

export type { Registry };

// 1. Define a new, clean interface for a processed attestation.
// The raw `metadata` is replaced with a simple `payload` object.
export interface ProcessedAttestation {
  audit_type: string;
  timestamp: bigint;
  auditor: Principal;
  payload: Record<string, any>; // The deserialized metadata
}

// This is our new, clean, UI-friendly interface for a bounty.
export interface ProcessedBounty {
  id: bigint;
  creator: Principal;
  created: Date; // Converted from bigint
  tokenAmount: bigint;
  tokenCanisterId: Principal;
  metadata: Record<string, any>; // Deserialized
  challengeParameters: Record<string, any>; // Deserialized
  validationCanisterId: Principal;
  validationCallTimeout: bigint;
  payoutFee: bigint;
  claims: any[]; // Assuming ClaimRecord is not yet typed
  claimedTimestamp?: bigint; // Unwrapped from Opt
  claimedDate?: Date; // Unwrapped and converted
  timeoutDate?: Date; // Unwrapped and converted
}

export interface ProcessedVerificationRequest {
  repo: string;
  commit_hash: string;
  wasm_hash: string;
  metadata: Record<string, any>; // Deserialized metadata
}

// Update the VerificationStatus interface to use our new clean type.
export interface VerificationStatus {
  isVerified: boolean;
  verificationRequest: ProcessedVerificationRequest | null;
  attestations: ProcessedAttestation[];
  bounties: ProcessedBounty[];
}

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
      ? {
          repo: verificationRequest.repo,
          commit_hash: Buffer.from(verificationRequest.commit_hash).toString(
            'hex',
          ),
          wasm_hash: Buffer.from(verificationRequest.wasm_hash).toString('hex'),
          metadata: deserializeFromIcrc16Map(verificationRequest.metadata),
        }
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

  const processedBounties: ProcessedBounty[] = bountiesResult.map(
    (bounty): ProcessedBounty => {
      const claimedDateNs = fromNullable(bounty.claimed_date);
      const timeoutDateNs = fromNullable(bounty.timeout_date);

      return {
        // Map snake_case to camelCase and transform data
        id: bounty.bounty_id,
        creator: bounty.creator,
        created: nsToDate(bounty.created),
        tokenAmount: bounty.token_amount,
        tokenCanisterId: bounty.token_canister_id,
        validationCanisterId: bounty.validation_canister_id,
        validationCallTimeout: bounty.validation_call_timeout,
        payoutFee: bounty.payout_fee,
        claims: bounty.claims, // Pass through for now

        // Deserialize ICRC-16 maps
        metadata: deserializeFromIcrc16Map(bounty.bounty_metadata),
        challengeParameters: deserializeIcrc16Value(
          bounty.challenge_parameters,
        ),

        // Unwrap optional values
        claimedTimestamp: fromNullable(bounty.claimed),
        claimedDate: claimedDateNs ? nsToDate(claimedDateNs) : undefined,
        timeoutDate: timeoutDateNs ? nsToDate(timeoutDateNs) : undefined,
      };
    },
  );

  return {
    isVerified: isVerifiedResult,
    verificationRequest: processedRequest,
    attestations: processedAttestations,
    bounties: processedBounties,
  };
};

/**
 * Submits a new WASM for verification.
 * This corresponds to the `icrc126_verification_request` method on the registry.
 * @returns The unique ID of the verification request.
 */
export const submitVerificationRequest = async (
  identity: Identity,
  args: Registry.VerificationRequest,
): Promise<bigint> => {
  const registryActor = getRegistryActor(identity);
  const result = await registryActor.icrc126_verification_request({
    ...args,
    metadata: [], // Metadata can be added later if needed
  });

  return result;
};

export type VersionTuple = [bigint, bigint, bigint];

export interface PublishVersionArgs {
  namespace: string;
  version: VersionTuple;
  wasm_hash: Uint8Array;
  repo_url: string;
  chunk_hashes: Uint8Array[];
}

/**
 * Publishes a new version of a canister type, linking a verified WASM hash to it.
 * This corresponds to the `icrc118_update_wasm` method on the registry.
 */
export const updateWasm = async (
  identity: Identity,
  args: PublishVersionArgs,
): Promise<void> => {
  const { namespace, version, wasm_hash, repo_url, chunk_hashes } = args;

  const registryActor = getRegistryActor(identity);
  const result = await registryActor.icrc118_update_wasm({
    canister_type_namespace: namespace,
    version_number: version,
    expected_hash: wasm_hash,
    repo: repo_url,
    description: `Release version ${version}`,
    expected_chunks: chunk_hashes,
    // Optional fields can be added later if needed
    // e.g., release_date, release_notes, etc.
    metadata: [],
    previous: [],
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to publish version: ${JSON.stringify(result.Error)}`,
    );
  }
};

export interface UploadWasmChunkArgs {
  namespace: string;
  version: VersionTuple;
  chunk_bytes: Uint8Array;
  chunk_index: bigint;
  chunk_hash: Uint8Array;
}

export const uploadWasmChunk = async (
  identity: Identity,
  args: UploadWasmChunkArgs,
): Promise<void> => {
  const { namespace, version, chunk_bytes, chunk_index, chunk_hash } = args;
  const registryActor = getRegistryActor(identity);

  const result = await registryActor.icrc118_upload_wasm_chunk({
    canister_type_namespace: namespace,
    version_number: version,
    wasm_chunk: chunk_bytes,
    chunk_id: chunk_index,
    expected_chunk_hash: chunk_hash,
  });

  // The canister returns total_chunks = 0 on error.
  if (result.total_chunks === 0n) {
    throw new Error(
      `Failed to upload chunk ${chunk_index}. The canister rejected the chunk (hash mismatch or out of bounds).`,
    );
  }
};

/**
 * Adds a new controller to a canister type in the registry.
 * This corresponds to the `icrc118_manage_controller` method.
 */
export const addController = async (
  identity: Identity,
  args: { namespace: string; controller: string },
): Promise<void> => {
  const { namespace, controller } = args;
  const registryActor = getRegistryActor(identity);

  const request = {
    canister_type_namespace: namespace,
    op: { Add: null },
    controller: Principal.fromText(controller),
  };

  const result = await registryActor.icrc118_manage_controller([request]);
  const manageResult = result[0];

  if ('Error' in manageResult) {
    throw new Error(
      `Failed to add controller: ${JSON.stringify(manageResult.Error)}`,
    );
  }
};

/**
 * Removes a controller from a canister type in the registry.
 * This corresponds to the `icrc118_manage_controller` method.
 */
export const removeController = async (
  identity: Identity,
  args: { namespace: string; controller: string },
): Promise<void> => {
  const { namespace, controller } = args;
  const registryActor = getRegistryActor(identity);

  const request = {
    canister_type_namespace: namespace,
    op: { Remove: null },
    controller: Principal.fromText(controller),
  };

  const result = await registryActor.icrc118_manage_controller([request]);
  const manageResult = result[0];

  if ('Error' in manageResult) {
    throw new Error(
      `Failed to remove controller: ${JSON.stringify(manageResult.Error)}`,
    );
  }
};

/**
 * Registers a canister ID with the orchestrator, linking it to a namespace.
 * This is a prerequisite for upgrading the canister.
 */
export const registerCanister = async (
  identity: Identity,
  args: { canister_id: string; namespace: string },
): Promise<void> => {
  const { canister_id, namespace } = args;
  const orchestratorActor = getOrchestratorActor(identity);

  // The orchestrator canister itself will handle authorization.
  // If the caller is not a controller of the namespace, this call will fail.
  const res = await orchestratorActor.register_canister(
    Principal.fromText(canister_id),
    namespace,
  );

  if ('err' in res) {
    throw new Error(`Failed to register canister: ${JSON.stringify(res.err)}`);
  }
};

/**
 * Resolves a namespace and version string to a specific WASM hash by querying the registry.
 */
export const getWasmHashForVersion = async (
  identity: Identity,
  args: { namespace: string; version: string },
): Promise<Uint8Array> => {
  const { namespace, version } = args;
  const versionParts = version.split('.').map((part) => BigInt(part));
  if (versionParts.length !== 3) {
    throw new Error(`Invalid version format: "${version}". Must be "x.y.z".`);
  }

  const registryActor = getRegistryActor(identity);
  const result = await registryActor.get_canister_type_version({
    canister_type_namespace: namespace,
    version_number: versionParts as [bigint, bigint, bigint],
  });

  if ('err' in result) {
    throw new Error(
      `Could not find version ${version} for namespace ${namespace}: ${JSON.stringify(result.err)}`,
    );
  }

  // Ensure the returned value is always a Uint8Array
  const hash = result.ok.hash;
  return hash instanceof Uint8Array ? hash : new Uint8Array(hash);
};

export interface VersionInfo {
  version: string;
  wasm_hash: string; // Hex string representation
  description: string;
  date_added: Date;
  is_deprecated: boolean;
}

/**
 * Gets all published versions for a given namespace.
 */
export const getVersions = async (
  identity: Identity,
  namespace: string,
): Promise<VersionInfo[]> => {
  const registryActor = getRegistryActor(identity);

  const results: Registry.Wasm[] = await registryActor.icrc118_get_wasms({
    filter: [[{ canister_type_namespace: namespace }]],
    prev: [],
    take: [], // Empty 'take' should mean "get all"
  });

  return results.map((wasm) => ({
    version: wasm.version_number.join('.'),
    wasm_hash: Buffer.from(wasm.hash).toString('hex'),
    description: wasm.description,
    date_added: new Date(Number(wasm.created / 1_000_000n)), // Convert nanoseconds to milliseconds
    is_deprecated: wasm.deprecated,
  }));
};

/**
 * Marks a specific version of a canister type as deprecated or not, providing a reason.
 */
export const setDeprecationStatus = async (
  identity: Identity,
  args: {
    namespace: string;
    version: string;
    deprecate: boolean;
    reason: string;
  },
): Promise<void> => {
  const { namespace, version, deprecate, reason } = args;

  // Step 1: Resolve the user-friendly version string to its specific WASM hash
  const wasmHash = await getWasmHashForVersion(identity, {
    namespace,
    version,
  });

  const versionParts = version.split('.').map((part) => BigInt(part));
  if (versionParts.length !== 3) {
    throw new Error(`Invalid version format: "${version}". Must be "x.y.z".`);
  }

  const registryActor = getRegistryActor(identity);

  // Step 2: Build the correct request object with all required fields
  const result = await registryActor.icrc118_deprecate({
    canister_type_namespace: namespace,
    version_number: versionParts as [bigint, bigint, bigint],
    hash: wasmHash,
    deprecation_flag: [deprecate],
    reason: [reason],
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to set deprecation status: ${JSON.stringify(result.Error)}`,
    );
  }
};

/**
 * Gets the list of controller principals for a given namespace.
 */
export const getControllers = async (
  identity: Identity,
  namespace: string,
): Promise<string[]> => {
  const registryActor = getRegistryActor(identity);

  // We use the get_canister_types method with a filter to find our specific namespace
  const results = await registryActor.icrc118_get_canister_types({
    filter: [{ namespace: namespace }],
    prev: [],
    take: [],
  });

  if (results.length === 0) {
    throw new Error(`Namespace '${namespace}' not found.`);
  }

  // The result is an array of principals; convert them to text for display.
  return results[0].controllers.map((p: Principal) => p.toText());
};

export interface CreateBountyArgs {
  wasm_hash: Uint8Array;
  audit_type: string;
  amount: bigint;
  token_canister_id: Principal;
  timeout_date: bigint; // Nanoseconds from epoch
  validation_canister_id: Principal;
}

/**
 * Creates a new ICRC-127 tokenized bounty for a specific WASM hash and audit type.
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
  const { wasm_hash, audit_type, amount, token_canister_id, timeout_date } =
    args;

  const registryActor = getRegistryActor(identity);

  const request: Registry.CreateBountyRequest = {
    bounty_id: [], // The canister will assign this.
    validation_canister_id: args.validation_canister_id, // The registry validates its own bounties.
    timeout_date: timeout_date,
    start_date: [],
    challenge_parameters: {
      Map: [
        // The wasm_hash must be passed as a Blob (Uint8Array).
        ['wasm_hash', { Blob: wasm_hash }],
        ['audit_type', { Text: audit_type }],
      ],
    },
    bounty_metadata: [
      ['icrc127:reward_canister', { Principal: token_canister_id }],
      ['icrc127:reward_amount', { Nat: amount }],
    ],
  };

  const result = await registryActor.icrc127_create_bounty(request);

  if ('Error' in result) {
    throw new Error(`Failed to create bounty: ${JSON.stringify(result.Error)}`);
  }

  return result.Ok.bounty_id;
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
  wasm_hash: string;
  metadata: ICRC16Map;
}

/**
 * Files a new attestation for a specific WASM hash.
 */
export const fileAttestation = async (
  identity: Identity,
  args: FileAttestationArgs,
): Promise<void> => {
  const { wasm_hash, metadata } = args;
  const registryActor = getRegistryActor(identity);

  const result = await registryActor.icrc126_file_attestation({
    wasm_id: wasm_hash,
    metadata: metadata,
  });

  if ('Error' in result) {
    throw new Error(
      `Failed to file attestation: ${JSON.stringify(result.Error)}`,
    );
  }
};

export interface FinalizeVerificationArgs {
  wasm_id: string; // The lowercase hex string ID
  outcome: VerificationOutcome;
  metadata: ICRC16Map;
}

/**
 * Finalizes the verification status of a WASM as a DAO action.
 */
export const finalizeVerification = async (
  identity: Identity,
  args: FinalizeVerificationArgs,
): Promise<void> => {
  const { wasm_id, outcome, metadata } = args;
  const registryActor = getRegistryActor(identity);

  const result = await registryActor.finalize_verification(
    wasm_id,
    outcome,
    metadata,
  );

  if ('error' in result) {
    throw new Error(
      `Failed to finalize verification: ${JSON.stringify(result.error)}`,
    );
  }
};

export interface CreateCanisterTypeArgs {
  namespace: string;
  name: string;
  description: string;
  repo_url: string;
  metadata?: ICRC16Map;
}

/**
 * Creates a new canister type (namespace) in the registry.
 * This is a one-time action per project.
 */
export const createCanisterType = async (
  identity: Identity,
  args: CreateCanisterTypeArgs,
): Promise<'created' | 'existed'> => {
  const { namespace, name, description, repo_url, metadata } = args;
  const registryActor = getRegistryActor(identity);

  const result = await registryActor.icrc118_create_canister_type([
    {
      canister_type_namespace: namespace,
      canister_type_name: name,
      description: description,
      repo: repo_url,
      controllers: [[identity.getPrincipal()]], // Let the caller's principal be the default controller
      metadata: metadata ?? [],
      forked_from: [],
    },
  ]);

  if (result.length > 0 && 'Error' in result[0]) {
    const error = result[0].Error;
    // --- IDEMPOTENCY CHECK ---
    // Check if the error is the specific one for an existing type.
    // We check for a structured error or a generic string for flexibility.
    if (
      'CanisterTypeAlreadyExists' in error ||
      ('Generic' in error && error.Generic.includes('already exists'))
    ) {
      // This is not a failure. The desired state is already achieved.
      return 'existed';
    }
    // --- END OF CHECK ---

    // For any other error, we throw.
    throw new Error(`Failed to create canister type: ${JSON.stringify(error)}`);
  }

  return 'created';
};

/**
 * Uses the agent's `readState` method to get the live module hash of any canister.
 * This is the correct method for external clients, as used by dfx.
 *
 * @param canisterId The Principal of the canister to check.
 * @returns The WASM hash as a Uint8Array, or null if not found.
 */
export const getCanisterWasmHash = async (
  canisterId: Principal,
): Promise<Uint8Array | null> => {
  // We still need a mainnet agent to query the mainnet's state tree.
  const agent = new HttpAgent({
    host:
      process.env.DFX_NETWORK === 'ic'
        ? 'https://icp-api.io'
        : 'http://127.0.0.1:4943',
  });

  if (process.env.DFX_NETWORK !== 'ic') {
    // Only fetch the root key for local development
    await agent.fetchRootKey().catch((err) => {
      console.warn(
        'Unable to fetch root key. Check to ensure that your local replica is running',
      );
      console.error(err);
    });
  }

  const canisterSegment = Buffer.from('canister');
  const principalSegment = canisterId.toUint8Array();
  const moduleHashSegment = Buffer.from('module_hash');

  const path: ArrayBuffer[] = [
    canisterSegment.buffer.slice(
      canisterSegment.byteOffset,
      canisterSegment.byteOffset + canisterSegment.byteLength,
    ),
    principalSegment.buffer.slice(
      principalSegment.byteOffset,
      principalSegment.byteOffset + principalSegment.byteLength,
    ) as ArrayBuffer,
    moduleHashSegment.buffer.slice(
      moduleHashSegment.byteOffset,
      moduleHashSegment.byteOffset + moduleHashSegment.byteLength,
    ),
  ];

  try {
    const response = await agent.readState(canisterId, { paths: [path] });

    // --- THE DEFINITIVE FIX IS HERE ---
    // 1. Create a Certificate instance from the response. This class is the
    //    intended API for this workflow. It handles verification and decoding internally.
    //    We must provide the agent's root key to verify the certificate's authenticity.
    const cert = await Certificate.create({
      certificate: response.certificate,
      rootKey: agent.rootKey!,
      canisterId: canisterId,
    });

    // 2. Use the certificate's high-level `lookup` method. This returns the
    //    value directly if the path is found and the certificate is valid.
    const result = cert.lookup(path);

    // 3. The result will be an ArrayBuffer if found, or undefined otherwise.
    if (result.status === 'found') {
      const hash = new Uint8Array(result.value as ArrayBuffer);
      return hash;
    }

    return null;
  } catch (e) {
    console.log(e);
    // This can happen for various reasons, e.g., network issues or if the
    // replica is busy. We treat it as "hash not found".
    console.warn(
      `   ⚠️  Warning: Could not read state for canister ${canisterId.toText()}. It may not exist or the network may be busy.`,
    );
    return null;
  }
};

/**
 * Fetches a filtered and paginated list of canister types from the registry.
 * This is the low-level wrapper for the `get_canister_types` canister method.
 * @param identity The identity to use for the call (can be anonymous).
 * @param request The filter and pagination options for the query.
 */
export const getCanisterTypes = async (
  identity: Identity,
  request: GetCanisterTypesRequest,
): Promise<CanisterType[]> => {
  const registryActor = getRegistryActor(identity);
  try {
    const result = await registryActor.icrc118_get_canister_types(request);
    return result || [];
  } catch (error) {
    console.error(`Error fetching canister types:`, error);
    return [];
  }
};

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
}

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
  };

  const registryActor = getRegistryActor();

  try {
    // 1. Fetch attestations and correctly handle the Result variant.
    const attestationsResult =
      await registryActor.get_attestations_for_wasm(wasmId);

    const attestations = attestationsResult;

    // 2. Loop through attestations and explicitly map data.
    const completedAuditTypes: string[] = [];
    for (const attestation of attestations) {
      completedAuditTypes.push(attestation.audit_type);
      const payload = deserializeFromIcrc16Map(attestation.metadata);

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

export type SecurityTier = 'Gold' | 'Silver' | 'Bronze' | 'Unranked';

// Define the structure for the app cards on the discovery page
export interface AppStoreListing {
  id: string; // This is the hex string of the WASM hash
  namespace: string;
  name: string;
  description: string;
  category: string; // e.g., "DeFi", "Social", etc.
  securityTier: SecurityTier;
  publisher: string;
  iconUrl: string;
  bannerUrl: string;
}

function unwrapSecurityTier(
  tierVariant: AppListing['security_tier'],
): SecurityTier {
  if ('Gold' in tierVariant) return 'Gold';
  if ('Silver' in tierVariant) return 'Silver';
  if ('Bronze' in tierVariant) return 'Bronze';
  return 'Unranked';
}

/**
 * Fetches the fully assembled list of apps for the discovery page directly
 * from the canister's `get_app_listings` method.
 */
export const getAppStoreListings = async (): Promise<AppStoreListing[]> => {
  // 1. Get the actor using the established pattern.
  const registryActor = getRegistryActor();

  try {
    // 2. Call the new, powerful canister method with an empty request to get all listings.
    const result = await registryActor.get_app_listings({
      filter: [],
      prev: [],
      take: [],
    });

    // 3. Handle the canister's Result<T, E> response.
    if ('err' in result) {
      console.error('Failed to fetch app listings from canister:', result.err);
      return []; // Return empty array on canister-level error
    }

    const canisterListings: AppListing[] = result.ok || [];

    // 4. Map the canister's snake_case response to our camelCase TypeScript interface.
    // This keeps the UI layer clean and consistent.
    return canisterListings.map(
      (item): AppStoreListing => ({
        id: item.id,
        namespace: item.namespace,
        name: item.name,
        description: item.description,
        publisher: item.publisher,
        iconUrl: item.icon_url, // Mapping snake_case to camelCase
        bannerUrl: item.banner_url, // Mapping snake_case to camelCase
        category: item.category,
        securityTier: unwrapSecurityTier(item.security_tier),
      }),
    );
  } catch (error) {
    console.error(`Error calling get_app_listings:`, error);
    // Return an empty array on network/agent-level failure so the UI doesn't break.
    return [];
  }
};

// 1. Define the new, more powerful filter types that match the canister.
// Using a discriminated union in TypeScript is the perfect way to model this.
type BountyStatusInput = 'Open' | 'Claimed';
export type BountyFilterInput =
  | { status: BountyStatusInput }
  | { audit_type: string }
  | { creator: Principal };

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
  identity: Identity,
  request: ListBountiesRequest,
): Promise<ProcessedBounty[]> => {
  const registryActor = getRegistryActor(identity);
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
    return rawBounties.map((bounty): ProcessedBounty => {
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
        challengeParameters: deserializeIcrc16Value(
          bounty.challenge_parameters,
        ),
        claimedTimestamp: fromNullable(bounty.claimed),
        claimedDate: claimedDateNs ? nsToDate(claimedDateNs) : undefined,
        timeoutDate: timeoutDateNs ? nsToDate(timeoutDateNs) : undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching bounties:', error);
    return [];
  }
};

// 2. Define the user-friendly request object for our function.
export interface ListSubmissionsRequest {
  take?: bigint;
  prev?: string; // The wasm_id of the last item from the previous page
}

/**
 * Fetches a paginated list of all WASM submissions that are ready for DAO review.
 * @param identity The identity to use for the call (can be anonymous).
 * @param request The pagination options for the query.
 */
export const listPendingSubmissions = async (
  identity: Identity,
  request: ListSubmissionsRequest,
): Promise<PendingSubmission[]> => {
  const registryActor = getRegistryActor(identity);
  try {
    // 3. Transform the user-friendly request into the format Candid expects.
    //    Optional values are wrapped in an array: [] for null, [value] for some.
    const candidRequest = {
      take: toNullable(request.take),
      prev: toNullable(request.prev),
    };

    // 4. Call the new canister endpoint.
    const submissions =
      await registryActor.list_pending_submissions(candidRequest);

    // 5. The return type from the canister already matches our desired interface,
    //    so we can return it directly. No complex processing is needed.
    return submissions;
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    // Return an empty array on failure to prevent the CLI from crashing.
    return [];
  }
};
