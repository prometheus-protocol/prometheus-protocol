import { Identity } from '@dfinity/agent';
import { getOrchestratorActor, getRegistryActor } from '../actors.js';
import { Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';

export interface VerificationStatus {
  isVerified: boolean;
  attestations: Registry.AttestationRecord[];
}

// --- Define the Type Guard ---
/**
 * A TypeScript type guard that checks if an AuditRecord is an Attestation.
 * @param record The AuditRecord to check.
 * @returns True if the record is an Attestation, false otherwise.
 */
function isAttestation(
  record: Registry.AuditRecord,
): record is { Attestation: Registry.AttestationRecord } {
  return 'Attestation' in record;
}

// --- Define the public API types ---
export interface VerificationStatus {
  isVerified: boolean;
  attestations: Registry.AttestationRecord[];
}

/**
 * Fetches the verification status for a given WASM hash.
 * @returns An object containing the final verification status and a list of attestations.
 */
export const getVerificationStatus = async (
  identity: Identity,
  wasm_hash: Uint8Array,
): Promise<VerificationStatus> => {
  const registryActor = getRegistryActor(identity);

  // We can make these calls in parallel for efficiency
  const [isVerified, auditRecords] = await Promise.all([
    registryActor.is_wasm_verified(wasm_hash),
    registryActor.get_attestations_for_wasm(wasm_hash),
  ]);

  // Use the type guard in the filter. This is clean and reusable.
  const filteredAttestations = auditRecords
    .filter(isAttestation)
    .map(
      (record: { Attestation: Registry.AttestationRecord }) =>
        record.Attestation,
    ); // Now we can safely access .Attestation

  return {
    isVerified,
    attestations: filteredAttestations,
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

export interface PublishVersionArgs {
  namespace: string;
  version: string; // e.g., "1.0.0"
  wasm_hash: Uint8Array;
  repo_url: string;
}

/**
 * Publishes a new version of a canister type, linking a verified WASM hash to it.
 * This corresponds to the `icrc118_update_wasm` method on the registry.
 */
export const publishVersion = async (
  identity: Identity,
  args: PublishVersionArgs,
): Promise<void> => {
  const { namespace, version, wasm_hash, repo_url } = args;

  // Parse the version string into the format the canister expects: [Nat, Nat, Nat]
  const versionParts = version.split('.').map((part) => {
    const num = BigInt(part);
    if (isNaN(Number(part)) || num < 0) {
      throw new Error(
        `Invalid version part: "${part}". Version must be in the format "x.y.z".`,
      );
    }
    return num;
  });

  if (versionParts.length !== 3) {
    throw new Error(`Invalid version format: "${version}". Must be "x.y.z".`);
  }

  const registryActor = getRegistryActor(identity);
  const result = await registryActor.icrc118_update_wasm({
    canister_type_namespace: namespace,
    version_number: versionParts as [bigint, bigint, bigint],
    expected_hash: wasm_hash,
    repo: repo_url,
    description: `Release version ${version}`,
    expected_chunks: [wasm_hash], // Assuming we only have one chunk for the WASM
    // Optional fields can be added later if needed
    // e.g., release_date, release_notes, etc.
    metadata: [],
    previous: [],
  });

  if ('Err' in result) {
    throw new Error(`Failed to publish version: ${JSON.stringify(result.Err)}`);
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

  if ('Err' in manageResult) {
    throw new Error(
      `Failed to add controller: ${JSON.stringify(manageResult.Err)}`,
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
  const registryActor = await getRegistryActor(identity);

  const request = {
    canister_type_namespace: namespace,
    op: { Remove: null },
    controller: Principal.fromText(controller),
  };

  const result = await registryActor.icrc118_manage_controller([request]);
  const manageResult = result[0];

  if ('Err' in manageResult) {
    throw new Error(
      `Failed to remove controller: ${JSON.stringify(manageResult.Err)}`,
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
  const orchestratorActor = await getOrchestratorActor(identity);

  // The orchestrator canister itself will handle authorization.
  // If the caller is not a controller of the namespace, this call will fail.
  await orchestratorActor.register_canister(
    Principal.fromText(canister_id),
    namespace,
  );
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

  const registryActor = await getRegistryActor(identity);
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
  description: string;
  dateAdded: Date;
  isDeprecated: boolean;
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
    description: wasm.description,
    dateAdded: new Date(Number(wasm.created / 1_000_000n)), // Convert nanoseconds to milliseconds
    isDeprecated: wasm.deprecated,
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

  const registryActor = await getRegistryActor(identity);

  // Step 2: Build the correct request object with all required fields
  const result = await registryActor.icrc118_deprecate({
    canister_type_namespace: namespace,
    version_number: versionParts as [bigint, bigint, bigint],
    hash: wasmHash,
    deprecation_flag: [deprecate],
    reason: [reason],
  });

  if ('Err' in result) {
    throw new Error(
      `Failed to set deprecation status: ${JSON.stringify(result.Err)}`,
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
  const registryActor = await getRegistryActor(identity);

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
