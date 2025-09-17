// packages/canisters/mcp_registry/test/mcp_registry_e2e.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { sha256 } from '@noble/hashes/sha2.js';

// --- Import Declarations ---
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type {
  CreateCanisterType,
  _SERVICE as RegistryService,
  UpdateWasmRequest,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import {
  idlFactory as orchestratorIdlFactory,
  init as orchestratorInit,
} from '@declarations/mcp_orchestrator/mcp_orchestrator.did.js';
import type { _SERVICE as OrchestratorService } from '@declarations/mcp_orchestrator/mcp_orchestrator.did.js';
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import type { _SERVICE as LedgerService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import { idlFactory as credentialIdlFactory } from '@declarations/audit_hub/audit_hub.did.js';
import type { _SERVICE as CredentialService } from '@declarations/audit_hub/audit_hub.did.js';
import { idlFactory as serverIdl } from '@declarations/mcp_server/mcp_server.did.js';
import type { _SERVICE as ServerService } from '@declarations/mcp_server/mcp_server.did.js';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm.gz',
);
const ORCHESTRATOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_orchestrator/mcp_orchestrator.wasm',
);
const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);
const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);
const MCP_SERVER_DUMMY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_server/mcp_server.wasm',
);

// --- Identities ---
const daoIdentity = createIdentity('dao-principal'); // Also the canister owner
const developerIdentity = createIdentity('developer-principal');
const operatorIdentity = createIdentity('operator-principal');
const bountyCreatorIdentity = createIdentity('bounty-creator');
const reproAuditorIdentity = createIdentity('repro-auditor');
const securityAuditorIdentity = createIdentity('security-auditor');
const qualityAuditorIdentity = createIdentity('quality-auditor');

describe('MCP Registry Full E2E Lifecycle', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let orchestratorActor: Actor<OrchestratorService>;
  let ledgerActor: Actor<LedgerService>;
  let auditHubActor: Actor<CredentialService>;
  let registryCanisterId: Principal;
  let ledgerCanisterId: Principal;
  let targetCanisterId: Principal;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy Dependencies
    const auditHub = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    auditHubActor = auditHub.actor;

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
            archive_options: {
              num_blocks_to_archive: 1000n,
              trigger_threshold: 2000n,
              controller_id: daoIdentity.getPrincipal(),
              max_message_size_bytes: [],
              cycles_for_archive_creation: [],
              node_max_memory_size_bytes: [],
              more_controller_ids: [],
              max_transactions_per_response: [],
            },
            decimals: [],
            fee_collector_account: [],
            max_memo_length: [],
            index_principal: [],
            feature_flags: [],
          },
        },
      ]),
    });
    ledgerActor = ledgerFixture.actor;
    ledgerCanisterId = ledgerFixture.canisterId;

    // 2. Deploy Registry with real dependency IDs
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]),
    });
    registryActor = registryFixture.actor;
    registryCanisterId = registryFixture.canisterId;

    // 3. Deploy Orchestrator with real dependency IDs
    const orchestratorFixture = await pic.setupCanister<OrchestratorService>({
      idlFactory: orchestratorIdlFactory,
      wasm: ORCHESTRATOR_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(orchestratorInit({ IDL }), [[]]),
    });
    orchestratorActor = orchestratorFixture.actor;

    // 3. Setup Permissions and Funds
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      auditHub.canisterId,
    );
    await registryActor.set_orchestrator_canister_id(
      orchestratorFixture.canisterId,
    );

    orchestratorActor.setIdentity(daoIdentity);
    await orchestratorActor.set_mcp_registry_id(registryFixture.canisterId);

    auditHub.actor.setIdentity(daoIdentity);
    // Configure the required stake for the reputation token
    await auditHubActor.set_stake_requirement('build_reproducibility_v1', 100n);
    await auditHubActor.set_stake_requirement('security', 100n);
    await auditHubActor.set_stake_requirement('quality', 100n);

    await auditHub.actor.mint_tokens(
      reproAuditorIdentity.getPrincipal(),
      'build_reproducibility_v1',
      1000n,
    );
    await auditHub.actor.mint_tokens(
      securityAuditorIdentity.getPrincipal(),
      'security',
      1000n,
    );
    await auditHub.actor.mint_tokens(
      qualityAuditorIdentity.getPrincipal(),
      'quality',
      1000n,
    );
    ledgerActor.setIdentity(daoIdentity);
    await ledgerActor.icrc1_transfer({
      to: { owner: bountyCreatorIdentity.getPrincipal(), subaccount: [] },
      amount: 3_000_000n,
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
    });
    ledgerActor.setIdentity(bountyCreatorIdentity);
    await ledgerActor.icrc2_approve({
      spender: { owner: registryCanisterId, subaccount: [] },
      amount: 3000000n,
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
      expected_allowance: [],
      expires_at: [],
    });
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should orchestrate the full developer-to-auditor-to-upgrade lifecycle', async () => {
    const wasmBytes = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
    const wasmHash = createHash('sha256').update(wasmBytes).digest();
    const wasmId = Buffer.from(wasmHash).toString('hex');
    const bountyAmount = 100_000n;
    const appNamespace = 'com.prometheus.test-server';
    const appVersion: [bigint, bigint, bigint] = [1n, 0n, 0n];

    // === PHASE 1: Developer creates a namespace and submits a verification request ===
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: appNamespace,
        controllers: [[developerIdentity.getPrincipal()]],
        canister_type_name: 'Test Server',
        description: '',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });

    // ASSERT: At this point, the WASM is known but NOT verified.
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

    // === PHASE 2: A sponsor creates bounties to incentivize audits ===
    registryActor.setIdentity(bountyCreatorIdentity);
    const buildBountyResult = await registryActor.icrc127_create_bounty({
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHash }],
          ['audit_type', { Text: 'build' }],
        ],
      },
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: ledgerCanisterId }],
        ['icrc127:reward_amount', { Nat: bountyAmount }],
      ],
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n, // 24 hours from now
      start_date: [],
      bounty_id: [],
      validation_canister_id: registryCanisterId,
    });
    const securityBountyResult = await registryActor.icrc127_create_bounty({
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHash }],
          ['audit_type', { Text: 'security' }],
        ],
      },
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: ledgerCanisterId }],
        ['icrc127:reward_amount', { Nat: bountyAmount }],
      ],
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n, // 24 hours from now
      start_date: [],
      bounty_id: [],
      validation_canister_id: registryCanisterId,
    });
    const buildBountyId =
      ('Ok' in buildBountyResult && buildBountyResult.Ok.bounty_id) || 0n;
    const securityBountyId =
      ('Ok' in securityBountyResult && securityBountyResult.Ok.bounty_id) || 0n;

    // === PHASE 3: The Build Auditor completes the verification, unlocking the "Verified" status ===
    // Step 3.1: Reserve the bounty
    auditHubActor.setIdentity(reproAuditorIdentity);
    const reserveResult = await auditHubActor.reserve_bounty(
      buildBountyId,
      'build_reproducibility_v1',
    );
    console.log('Reserve Result:', reserveResult);

    // Step 3.2: File the successful attestation
    registryActor.setIdentity(reproAuditorIdentity);
    const res = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: 'build_reproducibility_v1' }],
        ['bounty_id', { Nat: buildBountyId }],
      ],
    });
    console.log('Attestation Result:', res);

    // ASSERT: The successful build attestation automatically finalized the verification.
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);

    // === PHASE 4: Other declarative audits (e.g., Security) can now proceed ===
    auditHubActor.setIdentity(securityAuditorIdentity);
    await auditHubActor.reserve_bounty(securityBountyId, 'security');
    registryActor.setIdentity(securityAuditorIdentity);
    await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: 'security' }],
        ['bounty_id', { Nat: securityBountyId }],
      ],
    });

    // === PHASE 5: Developer publishes the now-VERIFIED WASM to the registry ===
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc118_update_wasm({
      canister_type_namespace: appNamespace,
      previous: [],
      expected_chunks: [wasmHash],
      metadata: [],
      repo: '',
      description: '',
      version_number: appVersion,
      expected_hash: wasmHash,
    });
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: appNamespace,
      expected_chunk_hash: wasmHash,
      version_number: appVersion,
      chunk_id: 0n,
      wasm_chunk: wasmBytes,
    });

    // === PHASE 6: Operator upgrades a live canister using the verified WASM ===
    // Step 6.1: Setup operator and register the live canister
    await registryActor.icrc118_manage_controller([
      {
        canister_type_namespace: appNamespace,
        op: { Add: null },
        controller: operatorIdentity.getPrincipal(),
      },
    ]);

    // Step 6.2: Perform the upgrade
    orchestratorActor.setIdentity(daoIdentity);
    const upgradeResult = await orchestratorActor.deploy_or_upgrade({
      namespace: appNamespace,
      hash: wasmHash,
      mode: { upgrade: [] },
      args: [],
      parameters: [],
      restart: false,
      snapshot: false,
      stop: false,
      timeout: 0n,
    });

    // @ts-ignore
    console.log('Upgrade Result:', upgradeResult.ok.toText());
    expect(upgradeResult).toHaveProperty('ok');

    // // Check that the owner is the developer (from init args)
    // const managedCanisterActor = pic.createActor<ServerService>(
    //   serverIdl,
    //   // @ts-ignore
    //   upgradeResult.ok,
    // );
    // const owner = await managedCanisterActor.get_owner();
    // expect(owner).toEqual(developerIdentity.getPrincipal());

    // const status = await managedCanisterActor.icrc120_upgrade_finished();
    // expect(status).toHaveProperty('Success');

    console.log('E2E test completed successfully!');
  });

  it('should automatically deploy a canister upon successful build verification', async () => {
    // === PHASE 1: Developer creates a new namespace and submits a verification request ===
    const appNamespace = 'com.prometheus.auto-deploy-app';

    // Get the Wasm hash for this canister
    const wasmBytes = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
    const wasmHash = createHash('sha256').update(wasmBytes).digest();
    const wasmId = Buffer.from(wasmHash).toString('hex');

    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc118_create_canister_type([
      {
        canister_type_namespace: appNamespace,
        controllers: [[developerIdentity.getPrincipal()]],
        canister_type_name: 'Auto-Deploy Test App',
        description: '',
        repo: '',
        metadata: [],
        forked_from: [],
      },
    ]);
    // Upload the wasm in advance (normally done via separate calls)
    await registryActor.icrc118_update_wasm({
      canister_type_namespace: appNamespace,
      previous: [],
      expected_chunks: [wasmHash],
      metadata: [],
      repo: '',
      description: '',
      version_number: [1n, 0n, 0n],
      expected_hash: wasmHash,
    });
    await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: appNamespace,
      expected_chunk_hash: wasmHash,
      version_number: [1n, 0n, 0n],
      chunk_id: 0n,
      wasm_chunk: wasmBytes,
    });
    // Submit the verification request
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/auto/deploy',
      commit_hash: new Uint8Array([2]),
      metadata: [],
    });

    // === PHASE 2: A sponsor creates a bounty for the build audit ===
    registryActor.setIdentity(bountyCreatorIdentity);
    const bountyResult = await registryActor.icrc127_create_bounty({
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHash }],
          ['audit_type', { Text: 'build' }],
        ],
      },
      bounty_metadata: [],
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
      start_date: [],
      bounty_id: [],
      validation_canister_id: registryCanisterId,
    });
    const bountyId = ('Ok' in bountyResult && bountyResult.Ok.bounty_id) || 0n;

    // === PHASE 3: The Build Auditor files a successful attestation (THE TRIGGER) ===
    auditHubActor.setIdentity(reproAuditorIdentity);
    await auditHubActor.reserve_bounty(bountyId, 'build_reproducibility_v1');

    registryActor.setIdentity(reproAuditorIdentity);
    await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: 'build_reproducibility_v1' }],
        ['bounty_id', { Nat: bountyId }],
      ],
    });

    // ASSERT 1: The WASM is now marked as verified in the registry.
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);

    // --- CRITICAL: Allow the IC to process the inter-canister call ---
    // The registry calls the orchestrator in a "fire-and-forget" manner.
    // We need to advance the PocketIC state to let that call complete.
    await pic.tick(10); // Tick twice to be safe (call + response/execution)

    // === PHASE 4: Assert that the deployment happened automatically ===

    // ASSERT 2: The orchestrator now manages a canister for the namespace.
    orchestratorActor.setIdentity(daoIdentity); // Use an admin identity for query
    const managedCanisters =
      await orchestratorActor.get_canisters(appNamespace);
    expect(managedCanisters).toHaveLength(1);
    const deployedCanisterId = managedCanisters[0];
    expect(deployedCanisterId).toBeInstanceOf(Principal);

    // // ASSERT 3 (THE ULTIMATE PROOF): Inspect the newly created canister directly.
    // const deployedWasmHash = await pic.getWasmHash(deployedCanisterId);
    // const controllers = await pic.getControllers(deployedCanisterId);

    // // Check that the correct code was installed.
    // expect(deployedWasmHash).toEqual(wasmHash);

    // // Check that the orchestrator is the SOLE controller.
    // expect(controllers).toHaveLength(1);
    // expect(controllers[0].toText()).toEqual(
    //   orchestratorActor.getCanisterId().toText(),
    // );

    console.log(
      `Automated deployment successful! New canister ID: ${deployedCanisterId.toText()}`,
    );
  });
});
