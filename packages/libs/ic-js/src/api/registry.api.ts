import { Certificate, HttpAgent, Identity } from '@dfinity/agent';
import { getOrchestratorActor, getRegistryActor } from '../actors.js';
import { Registry } from '@prometheus-protocol/declarations';
import { Principal } from '@dfinity/principal';
import {
  ICRC16Map,
  VerificationOutcome,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';

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
  bounties: Registry.Bounty[];
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
  const [isVerified, auditRecords, bounties] = await Promise.all([
    registryActor.is_wasm_verified(wasm_hash),
    registryActor.get_attestations_for_wasm(wasm_hash),
    registryActor.get_bounties_for_wasm(wasm_hash),
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
    bounties,
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

// /**
//  * Uses the management canister to get the live module hash of any canister.
//  * @param canisterId The Principal of the canister to check.
//  * @returns The WASM hash as a Uint8Array, or null if not found.
//  */
// export const getCanisterWasmHash = async (
//   identity: Identity,
//   canisterId: Principal,
// ): Promise<Uint8Array | undefined> => {
//   const system = getSystemActor(identity);
//   const status = await system.canister_info({
//     canister_id: canisterId,
//     num_requested_changes: [],
//   });
//   const moduleHash = fromNullable(status.module_hash);
//   return moduleHash === undefined
//     ? undefined
//     : moduleHash instanceof Uint8Array
//       ? moduleHash
//       : new Uint8Array(moduleHash);
// };

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
