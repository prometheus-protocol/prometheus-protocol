// packages/canisters/mcp_orchestrator/test/mcp_orchestrator.pic.test.ts
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Identity } from '@dfinity/agent';

// --- Import Declarations ---
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
  type _SERVICE as RegistryService,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import {
  idlFactory as orchestratorIdlFactory,
  init as orchestratorInit,
  type _SERVICE as OrchestratorService,
  type UpgradeToRequest,
  type ConfigCanisterRequest,
} from '@declarations/mcp_orchestrator/mcp_orchestrator.did.js';
import { idlFactory as credentialIdlFactory } from '@declarations/auditor_credential_canister/auditor_credential_canister.did.js';
import type { _SERVICE as CredentialService } from '@declarations/auditor_credential_canister/auditor_credential_canister.did';

// --- Wasm Paths ---
const ORCHESTRATOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_orchestrator/mcp_orchestrator.wasm',
);
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
const DUMMY_UPGRADE_WASM_PATH = REGISTRY_WASM_PATH;

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal'); // Owner of registry & orchestrator
const developerIdentity: Identity = createIdentity('developer-principal'); // Authorized to propose upgrades
const unauthorizedUser: Identity = createIdentity('unauthorized-user'); // Not authorized for anything

// --- SHARED SETUP FUNCTION ---
async function setupEnvironment(pic: PocketIc) {
  const credentialFixture = await pic.setupCanister<CredentialService>({
    idlFactory: credentialIdlFactory,
    wasm: CREDENTIAL_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
  });
  const registryFixture = await pic.setupCanister<RegistryService>({
    idlFactory: registryIdlFactory,
    wasm: REGISTRY_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(registryInit({ IDL }), [
      {
        auditorCredentialCanisterId: credentialFixture.canisterId,
        icrc118wasmregistryArgs: [],
        ttArgs: [],
      },
    ]),
  });
  const orchestratorFixture = await pic.setupCanister<OrchestratorService>({
    idlFactory: orchestratorIdlFactory,
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(orchestratorInit({ IDL }), [[]]),
  });

  const managedCanisterFixture = await pic.setupCanister({
    idlFactory: orchestratorIdlFactory,
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    controllers: [orchestratorFixture.canisterId, daoIdentity.getPrincipal()],
    arg: IDL.encode(orchestratorInit({ IDL }), [[]]),
  });

  return {
    registryActor: registryFixture.actor,
    orchestratorActor: orchestratorFixture.actor,
    orchestratorCanisterId: orchestratorFixture.canisterId,
    managedCanisterId: managedCanisterFixture.canisterId,
    registryCanisterId: registryFixture.canisterId,
  };
}

// --- TEST SUITE 1: BASELINE ICRC-120 FUNCTIONALITY ---
describe('MCP Orchestrator Canister (Baseline Tests)', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let managedCanisterId: Principal;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
    const env = await setupEnvironment(pic);
    orchestratorActor = env.orchestratorActor;
    managedCanisterId = env.managedCanisterId;

    const baselineNamespace = 'com.prometheus.baseline-tests';
    const registryActor = env.registryActor;
    registryActor.setIdentity(daoIdentity);
    orchestratorActor.setIdentity(daoIdentity);

    await registryActor.set_mcp_orchestrator(env.orchestratorCanisterId);
    await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: baselineNamespace,
        canister_type_name: 'Baseline Test Server',
        controllers: [[daoIdentity.getPrincipal()]],
        description: 'A server for baseline tests.',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);
    await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);
    await orchestratorActor.register_canister(
      managedCanisterId,
      baselineNamespace,
    );
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('can get icrc120_metadata', async () => {
    orchestratorActor.setIdentity(daoIdentity);
    const response = await orchestratorActor.icrc120_metadata();
    const found = response.find(([k]) => k === 'icrc120:canister_type');
    expect(found).toBeDefined();
  });

  it('can stop and start a canister', async () => {
    orchestratorActor.setIdentity(daoIdentity);
    const stopReq = [{ canister_id: managedCanisterId, timeout: 10_000n }];
    const stopRes = await orchestratorActor.icrc120_stop_canister(stopReq);
    expect(stopRes[0]).toHaveProperty('Ok');

    const startReq = [{ canister_id: managedCanisterId, timeout: 10_000n }];
    const startRes = await orchestratorActor.icrc120_start_canister(startReq);
    expect(startRes[0]).toHaveProperty('Ok');
  });

  it('can config a canister', async () => {
    orchestratorActor.setIdentity(daoIdentity);
    const req: ConfigCanisterRequest = {
      canister_id: managedCanisterId,
      configs: [['foo', { Bool: true }]],
    };
    const res = await orchestratorActor.icrc120_config_canister([req]);
    expect(res[0]).toHaveProperty('Ok');
  });
});

// --- TEST SUITE 2: SECURE UPGRADE FLOW ---
describe('MCP Orchestrator Secure Upgrade Flow', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let registryActor: Actor<RegistryService>;
  let targetCanisterId: Principal;
  let unverifiedWasmHash: Uint8Array;
  let verifiedWasmHash: Uint8Array;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
    const env = await setupEnvironment(pic);
    orchestratorActor = env.orchestratorActor;
    registryActor = env.registryActor;
    targetCanisterId = env.managedCanisterId;

    const secureNamespace = 'com.prometheus.secure-server';
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_mcp_orchestrator(env.orchestratorCanisterId);
    await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);
    orchestratorActor.setIdentity(daoIdentity);
    await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);

    registryActor.setIdentity(developerIdentity);
    const res1 = await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: secureNamespace,
        canister_type_name: 'Secure Server',
        controllers: [[developerIdentity.getPrincipal()]],
        description: 'A server for integration testing.',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);

    console.log('Canister type creation response:', res1);

    orchestratorActor.setIdentity(developerIdentity);
    const res = await orchestratorActor.register_canister(
      targetCanisterId,
      secureNamespace,
    );
    console.log('Canister registration response:', res);

    const wasmBytes = fs.readFileSync(DUMMY_UPGRADE_WASM_PATH);
    unverifiedWasmHash = createHash('sha256').update(wasmBytes).digest();
    verifiedWasmHash = createHash('sha256')
      .update(Buffer.concat([wasmBytes, Buffer.from('v2')]))
      .digest();

    await registryActor.icrc118_update_wasm({
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 1n],
      description: 'v0.0.1',
      expected_hash: unverifiedWasmHash,
      expected_chunks: [unverifiedWasmHash],
      repo: '',
      metadata: [],
      previous: [],
    });
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 1n],
      chunk_id: 0n,
      wasm_chunk: wasmBytes,
      expected_chunk_hash: unverifiedWasmHash,
    });
    await registryActor.icrc118_update_wasm({
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 2n],
      description: 'v0.0.2',
      expected_hash: verifiedWasmHash,
      expected_chunks: [verifiedWasmHash],
      repo: '',
      metadata: [],
      previous: [],
    });
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: secureNamespace,
      version_number: [0n, 0n, 2n],
      chunk_id: 0n,
      wasm_chunk: Buffer.concat([wasmBytes, Buffer.from('v2')]),
      expected_chunk_hash: verifiedWasmHash,
    });
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('can config a canister', async () => {
    orchestratorActor.setIdentity(developerIdentity);
    const req: ConfigCanisterRequest = {
      canister_id: targetCanisterId,
      configs: [['foo', { Bool: true }]],
    };
    const res = await orchestratorActor.icrc120_config_canister([req]);
    expect(res[0]).toHaveProperty('Ok');
  });

  it('should REJECT an upgrade from an UNAUTHORIZED user', async () => {
    orchestratorActor.setIdentity(unauthorizedUser);
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: verifiedWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 10_000n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('Unauthorized');
  });

  it('should REJECT an upgrade to an UNVERIFIED Wasm, even from an authorized user', async () => {
    orchestratorActor.setIdentity(developerIdentity);
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: unverifiedWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 10_000n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    console.log('Upgrade result:', result);
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('Unauthorized');
  });

  it('should allow the DAO to finalize a Wasm as Verified', async () => {
    registryActor.setIdentity(daoIdentity);
    const wasmId = Buffer.from(verifiedWasmHash).toString('hex');
    const result = await registryActor.finalize_verification(
      wasmId,
      { Verified: null },
      [],
    );
    expect(result).toHaveProperty('ok');
  });

  it('should ACCEPT an upgrade from an authorized user to a now-VERIFIED Wasm', async () => {
    orchestratorActor.setIdentity(developerIdentity);
    const upgradeRequest: UpgradeToRequest = {
      canister_id: targetCanisterId,
      hash: verifiedWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 10_000n,
      parameters: [],
    };
    const result = await orchestratorActor.icrc120_upgrade_to([upgradeRequest]);
    expect(result[0]).toHaveProperty('Ok');
  });
});
