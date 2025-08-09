// packages/canisters/mcp_orchestrator/test/mcp_orchestrator.pic.test.ts
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject } from 'vitest';

import { idlFactory as registryIdlFactory } from '@declarations/mcp_registry';
import {
  type _SERVICE as RegistryService,
  type CreateCanisterType,
  type UpdateWasmRequest,
  init as registryInit,
  UploadRequest,
} from '@declarations/mcp_registry/mcp_registry.did.js';

// --- Import the NEW orchestrator's declarations ---
import { idlFactory as orchestratorIdlFactory } from '@declarations/mcp_orchestrator';
import {
  ConfigCanisterRequest,
  init as orchestratorInit,
  type _SERVICE as OrchestratorService,
  type UpgradeToRequest,
} from '@declarations/mcp_orchestrator/mcp_orchestrator.did.js';

// --- Import the System Service ---
import type { _SERVICE as SystemService } from '../../../../node_modules/@dfinity/ic-management/dist/candid/ic-management.ts';
import { idlFactory as systemIDLFactory } from '../../../../node_modules/@dfinity/ic-management/dist/candid/ic-management.idl.js';

import { Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

// --- Wasm Paths ---
const ORCHESTRATOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_orchestrator/mcp_orchestrator.wasm',
);
const DUMMY_UPGRADE_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm', // Using registry wasm as a dummy
);

const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);

// --- Identities ---
const adminIdentity: Identity = createIdentity('admin-principal');
const authorizedUser: Identity = createIdentity('authorized-user');
const unauthorizedUser: Identity = createIdentity('unauthorized-user');

// --- SHARED SETUP FUNCTION ---
async function setupEnvironment(pic: PocketIc) {
  // 1. Deploy Registry
  const registryFixture = await pic.setupCanister<RegistryService>({
    idlFactory: registryIdlFactory,
    wasm: REGISTRY_WASM_PATH,
    sender: adminIdentity.getPrincipal(),
    arg: IDL.encode(registryInit({ IDL }), [[]]),
  });

  // 2. Deploy Orchestrator, injecting the live registry ID
  const orchestratorFixture = await pic.setupCanister<OrchestratorService>({
    idlFactory: orchestratorIdlFactory,
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: adminIdentity.getPrincipal(),
    arg: IDL.encode(orchestratorInit({ IDL }), [
      { registryId: registryFixture.canisterId, icrc120Args: [], ttArgs: [] },
    ]),
  });

  // 3. Deploy a Managed Canister, controlled by the orchestrator
  const managedCanisterFixture = await pic.setupCanister({
    idlFactory: orchestratorIdlFactory, // Wasm doesn't matter
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: adminIdentity.getPrincipal(),
    controllers: [orchestratorFixture.canisterId, adminIdentity.getPrincipal()],
    arg: IDL.encode(orchestratorInit({ IDL }), [
      { registryId: registryFixture.canisterId, icrc120Args: [], ttArgs: [] },
    ]),
  });

  // 4. Create System Actor
  const systemActor = pic.createActor<SystemService>(
    systemIDLFactory,
    Principal.fromText('aaaaa-aa'),
  );

  return {
    registryActor: registryFixture.actor,
    orchestratorActor: orchestratorFixture.actor,
    systemActor,
    orchestratorCanisterId: orchestratorFixture.canisterId,
    managedCanisterId: managedCanisterFixture.canisterId,
  };
}

// --- TEST SUITE 1: BASELINE FUNCTIONALITY ---
describe('MCP Orchestrator Canister (Baseline Tests)', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let systemActor: Actor<SystemService>;
  let managedCanisterId: Principal;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
    const env = await setupEnvironment(pic);

    // Assign variables for this test suite
    orchestratorActor = env.orchestratorActor;
    systemActor = env.systemActor;
    managedCanisterId = env.managedCanisterId;

    // --- Configure Permissions for Baseline Tests ---
    const baselineNamespace = 'com.prometheus.baseline-tests';
    const registryActor = env.registryActor;
    registryActor.setIdentity(adminIdentity);
    orchestratorActor.setIdentity(adminIdentity);

    // Tell registry about orchestrator
    await registryActor.set_mcp_orchestrator(env.orchestratorCanisterId);
    // Create a type where 'admin' is the controller
    await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: baselineNamespace,
        canister_type_name: 'Baseline Test Server',
        controllers: [[adminIdentity.getPrincipal()]],
        description: 'A server for baseline tests.',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);
    // Tell orchestrator about the managed canister
    await orchestratorActor.register_canister(
      managedCanisterId,
      baselineNamespace,
    );
  });

  it('can get icrc120_metadata', async () => {
    orchestratorActor.setIdentity(adminIdentity);
    const response = await orchestratorActor.icrc120_metadata();
    const found = response.find(([k]) => k === 'icrc120:canister_type');
    expect(found).toBeDefined();
  });

  it('can stop and start a canister', async () => {
    orchestratorActor.setIdentity(adminIdentity);
    const stopReq = [{ canister_id: managedCanisterId, timeout: 0n }];
    const stopRes = await orchestratorActor.icrc120_stop_canister(stopReq);
    expect(stopRes[0]).toHaveProperty('Ok');

    const startReq = [{ canister_id: managedCanisterId, timeout: 0n }];
    const startRes = await orchestratorActor.icrc120_start_canister(startReq);
    expect(startRes[0]).toHaveProperty('Ok');
  });

  it('can config a canister', async () => {
    orchestratorActor.setIdentity(adminIdentity);
    const req: ConfigCanisterRequest = {
      canister_id: managedCanisterId,
      configs: [['foo', { Bool: true }]],
    };
    const res = await orchestratorActor.icrc120_config_canister([req]);
    expect(res[0]).toHaveProperty('Ok');
  });
});

// --- TEST SUITE 2: SECURE UPGRADE INTEGRATION ---
describe('Integration with MCP Registry (Secure Upgrade Flow)', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let systemActor: Actor<SystemService>;
  let targetCanisterId: Principal;
  let registeredWasmHash: Uint8Array;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
    const env = await setupEnvironment(pic);

    // Assign variables for this test suite
    orchestratorActor = env.orchestratorActor;
    systemActor = env.systemActor;
    targetCanisterId = env.managedCanisterId; // Use the canister from setup
    const registryActor = env.registryActor;

    // --- Configure Permissions for Integration Tests ---
    const secureNamespace = 'com.prometheus.secure-server';

    // Tell registry about orchestrator (as admin)
    registryActor.setIdentity(adminIdentity);
    await registryActor.set_mcp_orchestrator(env.orchestratorCanisterId);

    // Create a type where 'authorizedUser' is the controller (as admin)
    const createRequest: CreateCanisterType = {
      canister_type_namespace: secureNamespace,
      canister_type_name: 'Secure Server',
      controllers: [[authorizedUser.getPrincipal()]], // Correct: flat array of principals
      description: 'A server for integration testing.',
      repo: '',
      metadata: [],
      forked_from: [],
    };
    await registryActor.icrc118_create_canister_type([createRequest]);

    // Tell orchestrator about the target canister (as admin)
    orchestratorActor.setIdentity(authorizedUser);
    // FIX 1: Use the correct canister ID for this test's context.
    await orchestratorActor.register_canister(
      targetCanisterId,
      secureNamespace,
    );

    // --- Publish Wasm as the AUTHORIZED USER ---
    // FIX 2: Set the registry actor's identity to the authorized user for publishing.
    registryActor.setIdentity(authorizedUser);

    const wasmBytes = fs.readFileSync(DUMMY_UPGRADE_WASM_PATH);
    registeredWasmHash = createHash('sha256').update(wasmBytes).digest();
    const chunkHash = registeredWasmHash;

    const updateRequest: UpdateWasmRequest = {
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 1n],
      description: 'v0.0.1',
      expected_hash: registeredWasmHash,
      expected_chunks: [chunkHash],
      repo: '',
      metadata: [],
      previous: [],
    };
    const updateResult = await registryActor.icrc118_update_wasm(updateRequest);
    expect(updateResult).toHaveProperty('Ok'); // This will now pass

    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 1n],
      chunk_id: 0n,
      wasm_chunk: wasmBytes,
      expected_chunk_hash: chunkHash,
    });
  });

  it('should REJECT an upgrade from an UNAUTHORIZED user', async () => {
    orchestratorActor.setIdentity(unauthorizedUser);
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: registeredWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 0n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    expect(result[0]).toHaveProperty('Err');
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('Unauthorized');
  });

  it('should REJECT an upgrade to an UNREGISTERED Wasm hash', async () => {
    orchestratorActor.setIdentity(authorizedUser);
    const unregisteredHash = createHash('sha256')
      .update('unregistered wasm')
      .digest();
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: unregisteredHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 0n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    expect(result[0]).toHaveProperty('Err');
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('WasmUnavailable');
  });

  it('should ACCEPT and PERFORM an upgrade from an AUTHORIZED user to a REGISTERED Wasm', async () => {
    orchestratorActor.setIdentity(authorizedUser);
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: registeredWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 0n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    expect(result[0]).toHaveProperty('Ok');
  });
});
