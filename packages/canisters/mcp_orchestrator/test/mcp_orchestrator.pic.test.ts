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
} from '@declarations/mcp_orchestrator/mcp_orchestrator.did.js';
import {
  idlFactory as auditHubIdlFactory,
  type _SERVICE as AuditHubService,
} from '@declarations/audit_hub/audit_hub.did.js';
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
  type _SERVICE as LedgerService,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';

// --- Wasm Paths ---
const ORCHESTRATOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_orchestrator/mcp_orchestrator.wasm',
);
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm.gz',
);
const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);
const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);
const DUMMY_UPGRADE_WASM_PATH = REGISTRY_WASM_PATH;

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const auditorIdentity: Identity = createIdentity('auditor-principal');
const unauthorizedUser: Identity = createIdentity('unauthorized-user');

// --- EXPANDED SETUP FUNCTION ---
async function setupEnvironment(pic: PocketIc) {
  const auditHubFixture = await pic.setupCanister<AuditHubService>({
    idlFactory: auditHubIdlFactory,
    wasm: AUDIT_HUB_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
  });
  // 1. Deploy Ledger
  const ledgerFixture = await pic.setupCanister<LedgerService>({
    idlFactory: ledgerIdlFactory,
    wasm: LEDGER_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(ledgerInit({ IDL }), [
      {
        Init: {
          minting_account: {
            owner: daoIdentity.getPrincipal(),
            subaccount: [],
          },
          initial_balances: [],
          transfer_fee: 10_000n,
          token_name: 'Test Token',
          token_symbol: 'TTK',
          metadata: [],
          // Provide the mandatory archive_options
          archive_options: {
            num_blocks_to_archive: 1000n,
            trigger_threshold: 2000n,
            controller_id: daoIdentity.getPrincipal(),
            // Optional fields can be empty arrays
            max_message_size_bytes: [],
            cycles_for_archive_creation: [],
            node_max_memory_size_bytes: [],
            more_controller_ids: [],
            max_transactions_per_response: [],
          },
          // Other optional fields
          decimals: [],
          fee_collector_account: [],
          max_memo_length: [],
          index_principal: [],
          feature_flags: [],
        },
      },
    ]),
  });
  const registryFixture = await pic.setupCanister<RegistryService>({
    idlFactory: registryIdlFactory,
    wasm: REGISTRY_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(registryInit({ IDL }), [[]]),
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
    auditHubActor: auditHubFixture.actor,
    ledgerActor: ledgerFixture.actor,
    managedCanisterId: managedCanisterFixture.canisterId,
    ledgerCanisterId: ledgerFixture.canisterId,
    registryCanisterId: registryFixture.canisterId,
    auditHubCanisterId: auditHubFixture.canisterId,
  };
}

// --- TEST SUITE 2: SECURE UPGRADE FLOW (Refactored) ---
describe('MCP Orchestrator Secure Upgrade Flow', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let registryActor: Actor<RegistryService>;
  let auditHubActor: Actor<AuditHubService>;
  let targetCanisterId: Principal;
  let registryCanisterId: Principal;
  let unverifiedWasmHash: Uint8Array;
  let verifiedWasmHash: Uint8Array;
  const secureNamespace = 'com.prometheus.secure-server';
  const buildReproTokenId = 'build_reproducibility_v1';

  beforeAll(async () => {
    pic = await PocketIc.create(inject('PIC_URL'));
    const env = await setupEnvironment(pic);
    orchestratorActor = env.orchestratorActor;
    registryActor = env.registryActor;
    auditHubActor = env.auditHubActor;
    registryCanisterId = env.registryCanisterId;
    targetCanisterId = env.managedCanisterId;

    // --- Configure inter-canister dependencies ---
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      env.auditHubCanisterId,
    );
    orchestratorActor.setIdentity(daoIdentity);
    await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);

    auditHubActor.setIdentity(daoIdentity);
    await auditHubActor.set_stake_requirement(buildReproTokenId, 50n);
    await auditHubActor.mint_tokens(
      auditorIdentity.getPrincipal(),
      buildReproTokenId,
      100n,
    );

    // --- Create canister type and register a managed canister ---
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: secureNamespace,
        controllers: [[developerIdentity.getPrincipal()]],
        canister_type_name: '',
        description: '',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);
    orchestratorActor.setIdentity(developerIdentity);
    await orchestratorActor.register_canister(
      targetCanisterId,
      secureNamespace,
    );

    // --- Upload two WASM versions to the registry ---
    const wasmBytes = fs.readFileSync(DUMMY_UPGRADE_WASM_PATH);
    unverifiedWasmHash = createHash('sha256').update(wasmBytes).digest();
    verifiedWasmHash = createHash('sha256')
      .update(Buffer.concat([wasmBytes, Buffer.from('v2')]))
      .digest();

    // --- UPLOAD UNVERIFIED WASM (v0.0.1) ---
    // Step 1: Register metadata
    await registryActor.icrc118_update_wasm({
      canister_type_namespace: secureNamespace,
      previous: [],
      expected_chunks: [unverifiedWasmHash],
      metadata: [],
      repo: '',
      description: '',
      version_number: [0n, 1n, 0n],
      expected_hash: unverifiedWasmHash,
    });
    // Step 2: Upload the actual binary chunk
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: secureNamespace,
      wasm_chunk: wasmBytes,
      expected_chunk_hash: unverifiedWasmHash,
      version_number: [0n, 1n, 0n],
      chunk_id: 0n,
    });

    // --- UPLOAD VERIFIED WASM (v0.0.2) ---
    // Step 1: Register metadata
    await registryActor.icrc118_update_wasm({
      canister_type_namespace: secureNamespace,
      previous: [],
      expected_chunks: [
        createHash('sha256')
          .update(Buffer.concat([wasmBytes, Buffer.from('v2')]))
          .digest(),
      ],
      metadata: [],
      repo: '',
      description: '',
      version_number: [0n, 0n, 2n],
      expected_hash: createHash('sha256')
        .update(Buffer.concat([wasmBytes, Buffer.from('v2')]))
        .digest(),
    });
    // Step 2: Upload the actual binary chunk
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: secureNamespace,
      wasm_chunk: Buffer.concat([wasmBytes, Buffer.from('v2')]),
      expected_chunk_hash: createHash('sha256')
        .update(Buffer.concat([wasmBytes, Buffer.from('v2')]))
        .digest(),
      version_number: [0n, 0n, 2n],
      chunk_id: 0n,
    });
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should REJECT an upgrade from an UNAUTHORIZED user', async () => {
    orchestratorActor.setIdentity(unauthorizedUser);
    const result = await orchestratorActor.icrc120_upgrade_to([
      {
        canister_id: targetCanisterId,
        hash: verifiedWasmHash,
        mode: { install: null },
        args: [],
        stop: false,
        snapshot: false,
        restart: false,
        timeout: 0n,
        parameters: [],
      },
    ]);
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('Unauthorized');
  });

  it('should REJECT an upgrade to an UNVERIFIED Wasm, even from an authorized user', async () => {
    orchestratorActor.setIdentity(developerIdentity);
    const result = await orchestratorActor.icrc120_upgrade_to([
      {
        canister_id: targetCanisterId,
        hash: unverifiedWasmHash,
        mode: { install: null },
        args: [],
        stop: false,
        snapshot: false,
        restart: false,
        timeout: 0n,
        parameters: [],
      },
    ]);
    // @ts-ignore
    expect(result[0].Err).toHaveProperty('Unauthorized');
  });

  it('should complete the full verification lifecycle to mark a Wasm as Verified', async () => {
    const wasmId = Buffer.from(verifiedWasmHash).toString('hex');
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

    // 1. Developer submits claim
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: verifiedWasmHash,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });

    // 2. DAO creates bounty
    registryActor.setIdentity(daoIdentity);
    const createResult = await registryActor.icrc127_create_bounty({
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: verifiedWasmHash }],
          ['audit_type', { Text: buildReproTokenId }],
        ],
      },
      timeout_date: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000),
      start_date: [],
      bounty_id: [],
      validation_canister_id: registryCanisterId,
      bounty_metadata: [],
    });
    const bountyId = ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;

    // 3. Auditor reserves bounty and submits attestation
    auditHubActor.setIdentity(auditorIdentity);
    await auditHubActor.reserve_bounty(bountyId, buildReproTokenId);
    registryActor.setIdentity(auditorIdentity);
    const res = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: buildReproTokenId }],
        ['bounty_id', { Nat: bountyId }],
      ],
    });
    console.log('Attestation Result:', res);

    // 4. Assert: Wasm is now automatically verified
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);
  });

  it('should ACCEPT an upgrade from an authorized user to a now-VERIFIED Wasm', async () => {
    // This test now runs the verification lifecycle as part of its setup
    const wasmId = Buffer.from(verifiedWasmHash).toString('hex');
    if (!(await registryActor.is_wasm_verified(wasmId))) {
      // (This is the same setup as the previous test)
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: verifiedWasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      registryActor.setIdentity(daoIdentity);
      const createResult = await registryActor.icrc127_create_bounty({
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: verifiedWasmHash }],
            ['audit_type', { Text: buildReproTokenId }],
          ],
        },
        timeout_date: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000),
        start_date: [],
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        bounty_metadata: [],
      });
      const bountyId =
        ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;
      auditHubActor.setIdentity(auditorIdentity);
      await auditHubActor.reserve_bounty(bountyId, buildReproTokenId);
      registryActor.setIdentity(auditorIdentity);
      await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: buildReproTokenId }],
          ['bounty_id', { Nat: bountyId }],
        ],
      });
    }

    // Now, perform the upgrade
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
