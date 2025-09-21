import { Certificate, HttpAgent, Identity } from '@dfinity/agent';
import {
  getOrchestratorActor,
  getRegistryActor,
  getUsageTrackerActor,
} from '../actors.js';
import { Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';
import {
  AppListing,
  CanisterType,
  GetCanisterTypesRequest,
  ICRC16Map,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';
import {
  AppStoreDetails,
  AppVersionDetails,
  buildServerUrl,
  DataSafetyPoint,
} from './audit.api.js';
import {
  processAuditRecord,
  processBounty,
  processServerTool,
  uint8ArrayToHex,
} from '../utils.js';
import { fromNullable, toNullable } from '@dfinity/utils';
import { deserializeFromIcrc16Map } from '../icrc16.js';

export type { Registry };

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
  const result = await registryActor.icrc126_verification_request(args);

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

  console.log(result);

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
    wasm_hash: uint8ArrayToHex(wasm.hash as Uint8Array),
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
// --- 1. DEFINE THE NEW, SUPERIOR TYPESCRIPT INTERFACES ---

// A clean enum for the security tier on the frontend.
export type SecurityTier = 'Gold' | 'Silver' | 'Bronze' | 'Unranked';

// Represents the details of the latest version of an app.
export interface AppVersionSummary {
  wasmId: string; // The WASM Hash of this version
  versionString: string; // e.g., "1.2.0"
  securityTier: SecurityTier;
  status: 'Rejected' | 'Verified' | 'Pending';
}

// The new, primary data structure for the app store's list view.
// The `namespace` is now the stable, primary identifier.
export interface AppStoreListing {
  // --- Stable App Identity ---
  namespace: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  iconUrl: string;
  bannerUrl: string;

  // --- Details of the Latest Published Version ---
  latestVersion: AppVersionSummary;
}

// Helper function to unwrap the Motoko variant into a simple string.
function unwrapSecurityTier(tierVariant: Registry.SecurityTier): SecurityTier {
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
  const registryActor = getRegistryActor();

  try {
    const result = await registryActor.get_app_listings({
      filter: [],
      prev: [],
      take: [],
    });

    if ('err' in result) {
      console.error('Failed to fetch app listings from canister:', result.err);
      return [];
    }

    const canisterListings: AppListing[] = result.ok || [];

    // --- 2. UPDATE THE MAPPING LOGIC TO BUILD THE NEW STRUCTURE ---
    return canisterListings.map(
      (item): AppStoreListing => ({
        // --- Map the stable, top-level properties ---
        namespace: item.namespace,
        name: item.name,
        description: item.description,
        publisher: item.publisher,
        iconUrl: item.icon_url,
        bannerUrl: item.banner_url,
        category: item.category,

        // --- Map the nested, version-specific properties ---
        latestVersion: {
          wasmId: item.latest_version.wasm_id,
          versionString: item.latest_version.version_string,
          securityTier: unwrapSecurityTier(item.latest_version.security_tier),
          status: unwrapVersionStatus(item.latest_version.status),
        },
      }),
    );
  } catch (error) {
    console.error(`Error calling get_app_listings:`, error);
    return [];
  }
};
// --- 1. CREATE A DEDICATED HELPER FOR MAPPING THE VERSION DETAILS ---
// This function's only job is to convert the canister's version object to the TS version object.

function mapCanisterVersionToTS(
  canisterDetails: Registry.AppDetailsResponse, // This is the type from your .did.js file
  canisterId: Principal,
): AppVersionDetails {
  const canisterVersion = canisterDetails.latest_version;
  return {
    wasmId: canisterVersion.wasm_id,
    versionString: canisterVersion.version_string,
    status: unwrapVersionStatus(canisterVersion.status),
    securityTier: unwrapSecurityTier(canisterVersion.security_tier),
    buildInfo: {
      status: canisterVersion.build_info.status as
        | 'success'
        | 'failure'
        | 'unknown',
      gitCommit: fromNullable(canisterVersion.build_info.git_commit),
      repoUrl: fromNullable(canisterVersion.build_info.repo_url),
      failureReason: fromNullable(canisterVersion.build_info.failure_reason),
    },
    canisterId,
    serverUrl: buildServerUrl(canisterId, canisterDetails.mcp_path),
    tools: canisterVersion.tools.map(processServerTool),
    dataSafety: {
      overallDescription: canisterVersion.data_safety.overall_description,
      dataPoints: canisterVersion.data_safety.data_points.map(
        deserializeFromIcrc16Map,
      ) as DataSafetyPoint[],
    },
    bounties: canisterVersion.bounties.map(processBounty),
    // Use a more generic name like `processAuditRecord` that handles both types
    auditRecords: canisterVersion.audit_records.map(processAuditRecord),
  };
}

// export type AppListingStatus =
//   | { Rejected: { reason: string } }
//   | { Verified: null }
//   | { Pending: null };

// --- 2. CREATE A DEDICATED HELPER FOR MAPPING THE VERSION SUMMARY ---
function unwrapVersionStatus(
  statusVariant: Registry.AppListingStatus,
): 'Rejected' | 'Verified' | 'Pending' {
  if ('Rejected' in statusVariant) return 'Rejected';
  if ('Verified' in statusVariant) return 'Verified';
  return 'Pending';
}

// This function maps the canister's version summary to our TS version summary.
function mapCanisterVersionSummaryToTS(
  canisterSummary: Registry.AppVersionSummary, // Type from .did.js
): AppVersionSummary {
  return {
    wasmId: canisterSummary.wasm_id,
    versionString: canisterSummary.version_string,
    securityTier: unwrapSecurityTier(canisterSummary.security_tier),
    status: unwrapVersionStatus(canisterSummary.status),
  };
}

/**
 * Fetches and assembles all on-chain data for a specific app using its stable namespace.
 * This is the new, primary function for the App Details page.
 * @param namespace The reverse-DNS style namespace of the app (e.g., "com.wallet.infinity").
 */
export const getAppDetailsByNamespace = async (
  namespace: string,
  wasmId?: string,
  canisterId?: Principal,
): Promise<AppStoreDetails | null> => {
  const registryActor = getRegistryActor();
  const orchestratorActor = getOrchestratorActor();
  const usageTrackerActor = getUsageTrackerActor();

  try {
    const [appDetailsReq, canisterIdsReq] = await Promise.all([
      registryActor.get_app_details_by_namespace(namespace, toNullable(wasmId)),
      orchestratorActor.get_canisters(namespace),
    ]);

    if ('err' in appDetailsReq) {
      console.error(
        `Failed to fetch details for namespace "${namespace}":`,
        appDetailsReq.err,
      );
      return null;
    }

    const canisterDetails = appDetailsReq.ok;
    const canisterId = canisterIdsReq[0];

    let metrics = undefined;
    if (canisterId) {
      const res = await usageTrackerActor.get_app_metrics(canisterId);
      const appMetrics = fromNullable(res);
      metrics = appMetrics
        ? {
            totalInvocations: appMetrics.total_invocations,
            uniqueUsers: appMetrics.unique_users,
            totalTools: appMetrics.total_tools,
          }
        : undefined;
    }

    // --- 3. THE MAIN FUNCTION IS NOW CLEAN, SIMPLE, AND DECLARATIVE ---
    return {
      // --- A. Populate the Stable, Top-Level App Identity ---
      namespace: canisterDetails.namespace,
      name: canisterDetails.name,
      publisher: canisterDetails.publisher,
      category: canisterDetails.category,
      iconUrl: canisterDetails.icon_url,
      bannerUrl: canisterDetails.banner_url,
      galleryImages: canisterDetails.gallery_images,
      description: canisterDetails.description,
      keyFeatures: canisterDetails.key_features,
      whyThisApp: canisterDetails.why_this_app,
      tags: canisterDetails.tags,
      reviews: [], // Placeholder for reviews

      // --- B. Delegate all complex mapping to our new helper functions ---
      latestVersion: mapCanisterVersionToTS(canisterDetails, canisterId),
      allVersions: canisterDetails.all_versions.map(
        mapCanisterVersionSummaryToTS,
      ),
      metrics,
    };
  } catch (error) {
    console.error(`Error calling get_app_details_by_namespace:`, error);
    return null;
  }
};
