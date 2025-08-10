// packages/canisters/mcp_registry/test/mcp_registry_icrc126.pic.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import { Identity } from '@dfinity/agent';

// --- Import Declarations ---
// Registry
import { idlFactory as registryIdlFactory } from '@declarations/mcp_registry';
import {
  type _SERVICE as RegistryService,
  type CreateCanisterType,
  init as registryInit,
  UpdateWasmRequest,
} from '@declarations/mcp_registry/mcp_registry.did.js';
// Credential Canister
import { idlFactory as credentialIdlFactory } from '@declarations/auditor_credentials';
import { type _SERVICE as CredentialService } from '@declarations/auditor_credentials/auditor_credentials.did.js';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);
const CREDENTIAL_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auditor_credentials/auditor_credentials.wasm',
);

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal'); // Owner of credential canister
const developerIdentity: Identity = createIdentity('developer-principal');
const securityAuditorIdentity: Identity = createIdentity('security-auditor');
const cyclesAuditorIdentity: Identity = createIdentity('cycles-auditor');
const randomUserIdentity: Identity = createIdentity('random-user');

describe('MCP Registry ICRC-126 Integration', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let credentialActor: Actor<CredentialService>;
  const namespace = 'com.prometheus.audited-app';
  let wasmId: string; // Using wasm hash as the ID for simplicity

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy Credential Canister, owned by the DAO
    const credentialFixture = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    credentialActor = credentialFixture.actor;

    // 2. Deploy Registry, injecting the live credential canister ID
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: developerIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [
        {
          auditorCredentialCanisterId: Principal.anonymous(),
          icrc118wasmregistryArgs: [],
          ttArgs: [],
        },
      ]),
    });
    registryActor = registryFixture.actor;

    // 3. Setup Permissions and State
    // Grant credentials to our auditors
    credentialActor.setIdentity(daoIdentity);
    await credentialActor.issue_credential(
      securityAuditorIdentity.getPrincipal(),
      'security',
    );
    await credentialActor.issue_credential(
      cyclesAuditorIdentity.getPrincipal(),
      'cycles',
    );

    // Create a canister type in the registry
    registryActor.setIdentity(developerIdentity);
    const createRequest: CreateCanisterType = {
      canister_type_namespace: namespace,
      canister_type_name: 'Audited App',
      controllers: [[developerIdentity.getPrincipal()]],
      description: 'An app that requires audits.',
      repo: '',
      metadata: [],
      forked_from: [],
    };
    await registryActor.icrc118_create_canister_type([createRequest]);

    // Submit a Wasm version, which creates the entity we will attest to
    const wasmHash = new Uint8Array([1, 2, 3, 4]);
    wasmId = Buffer.from(wasmHash).toString('hex'); // Use hex string as wasm_id
    const updateRequest: UpdateWasmRequest = {
      canister_type_namespace: namespace,
      version_number: [1n, 0n, 0n],
      description: 'v1.0.0',
      expected_hash: wasmHash,
      expected_chunks: [wasmHash],
      repo: '',
      metadata: [],
      previous: [],
    };
    await registryActor.icrc118_update_wasm(updateRequest);
  });

  it('should REJECT an attestation from a user with NO credentials', async () => {
    registryActor.setIdentity(randomUserIdentity);

    const attestationRequest = {
      wasm_id: wasmId,
      metadata: { '126:audit_type': { Text: 'security' } }, // Using a simplified map for testing
    };

    const result =
      await registryActor.icrc126_file_attestation(attestationRequest);
    expect(result).toHaveProperty('err');
    // @ts-ignore
    expect(result.err).toHaveProperty('Unauthorized');
  });

  it('should REJECT an attestation for the wrong audit type', async () => {
    // The security auditor tries to file a 'cycles' audit
    registryActor.setIdentity(securityAuditorIdentity);

    const attestationRequest = {
      wasm_id: wasmId,
      metadata: { '126:audit_type': { Text: 'cycles' } },
    };

    const result =
      await registryActor.icrc126_file_attestation(attestationRequest);
    expect(result).toHaveProperty('err');
    // @ts-ignore
    expect(result.err).toHaveProperty('Unauthorized');
  });

  it('should ACCEPT an attestation from a correctly credentialed auditor', async () => {
    registryActor.setIdentity(securityAuditorIdentity);

    const attestationRequest = {
      wasm_id: wasmId,
      metadata: {
        '126:audit_type': { Text: 'security' },
        'custom:notes': { Text: 'Looks good to me.' },
      },
    };

    const result =
      await registryActor.icrc126_file_attestation(attestationRequest);
    expect(result).toHaveProperty('ok');
  });

  it('should allow querying the filed attestation', async () => {
    // This test relies on the previous test successfully filing an attestation.
    const wasmInfo = await registryActor.get_wasm_by_id(wasmId);

    expect(wasmInfo).toBeDefined();
    // @ts-ignore
    const attestations = wasmInfo[0].attestations;
    expect(attestations).toBeDefined();
    expect(attestations).toHaveLength(1);

    const securityAttestation = attestations[0];
    expect(securityAttestation.audit_type).toBe('security');
    expect(securityAttestation.auditor.toText()).toBe(
      securityAuditorIdentity.getPrincipal().toText(),
    );
  });
});
