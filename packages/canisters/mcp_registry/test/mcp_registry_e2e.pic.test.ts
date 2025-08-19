// packages/canisters/mcp_registry/test/mcp_registry_e2e.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

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
import { idlFactory as credentialIdlFactory } from '@declarations/auditor_credentials/auditor_credentials.did.js';
import type { _SERVICE as CredentialService } from '@declarations/auditor_credentials/auditor_credentials.did.js';
import { createHash } from 'node:crypto';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
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
const CREDENTIAL_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auditor_credentials/auditor_credentials.wasm',
);
const DUMMY_UPGRADE_WASM_PATH = REGISTRY_WASM_PATH;

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
  let registryCanisterId: Principal;
  let ledgerCanisterId: Principal;
  let targetCanisterId: Principal;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy Dependencies
    const credentialFixture = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
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

    // 2.b: Create the managed canister
    const managedCanisterFixture = await pic.setupCanister<OrchestratorService>(
      {
        idlFactory: orchestratorIdlFactory,
        wasm: DUMMY_UPGRADE_WASM_PATH,
        sender: operatorIdentity.getPrincipal(),
        arg: IDL.encode(orchestratorInit({ IDL }), [[]]),
      },
    );
    targetCanisterId = managedCanisterFixture.canisterId;

    // 3. Setup Permissions and Funds
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      credentialFixture.canisterId,
    );

    orchestratorActor.setIdentity(daoIdentity);
    await orchestratorActor.set_mcp_registry_id(registryFixture.canisterId);

    credentialFixture.actor.setIdentity(daoIdentity);
    await credentialFixture.actor.issue_credential(
      reproAuditorIdentity.getPrincipal(),
      'build',
    );
    await credentialFixture.actor.issue_credential(
      securityAuditorIdentity.getPrincipal(),
      'security',
    );
    await credentialFixture.actor.issue_credential(
      qualityAuditorIdentity.getPrincipal(),
      'quality',
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
    const wasmBytes = Buffer.from('mock wasm module bytes');
    const wasmHash = createHash('sha256').update(wasmBytes).digest();
    const wasmId = Buffer.from(wasmHash).toString('hex');
    const bountyAmount = 100_000n;
    const appNamespace = 'com.prometheus.test-server';
    const appVersion: [bigint, bigint, bigint] = [1n, 0n, 0n];

    // === PHASE 1: Developer creates a namespace for their application ===
    registryActor.setIdentity(developerIdentity);
    const request: CreateCanisterType = {
      canister_type_namespace: appNamespace,
      canister_type_name: 'Prometheus Test Server',
      controllers: [[developerIdentity.getPrincipal()]],
      description: 'A test server for our isolated test suite.',
      repo: 'https://github.com/prometheus-protocol/test-server',
      metadata: [['prom_cert:tier', { Text: 'Gold' }]],
      forked_from: [],
    };

    const createResult = await registryActor.icrc118_create_canister_type([
      request,
    ]);
    expect('Ok' in createResult[0]).toBe(true);

    // === PHASE 2: Developer requests formal verification for a PROPOSED new version ===
    const reqResult = await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/final-boss/app',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });
    expect(reqResult).toBeGreaterThanOrEqual(0n);

    // === PHASE 3: Bounties are created to attract auditors ===
    registryActor.setIdentity(bountyCreatorIdentity);
    const auditTypes = ['build', 'security', 'quality'];
    const bountyIds: { [key: string]: bigint } = {};
    for (const auditType of auditTypes) {
      const createResult = await registryActor.icrc127_create_bounty({
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        timeout_date:
          BigInt((await pic.getTime()) * 1_000_000) + 86_400_000_000_000n,
        start_date: [],
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: auditType }],
          ],
        },
        bounty_metadata: [
          ['icrc127:reward_canister', { Principal: ledgerCanisterId }],
          ['icrc127:reward_amount', { Nat: bountyAmount }],
        ],
      });
      if (!('Ok' in createResult))
        throw new Error(`Bounty creation failed for ${auditType}`);
      bountyIds[auditType] = createResult.Ok.bounty_id;
    }

    // Check that the bounties were created successfully
    const bounties = await registryActor.get_bounties_for_wasm(wasmHash);
    console.log(`Found ${bounties.length} bounties for the WASM hash.`);
    expect(bounties).toHaveLength(auditTypes.length);

    // === PHASE 4: Auditors complete audits and claim bounties ===
    const auditors = [
      { identity: reproAuditorIdentity, type: 'build' },
      { identity: securityAuditorIdentity, type: 'security' },
      { identity: qualityAuditorIdentity, type: 'quality' },
    ];
    for (const auditor of auditors) {
      console.log(`  - ${auditor.type} audit...`);
      registryActor.setIdentity(auditor.identity);
      const res = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [['126:audit_type', { Text: auditor.type }]],
      });
      expect('Ok' in res).toBe(true);

      const claimResult = await registryActor.icrc127_submit_bounty({
        bounty_id: bountyIds[auditor.type],
        submission: { Text: 'Attestation filed.' },
        account: [],
      });
      expect('Ok' in claimResult).toBe(true);
      if ('Ok' in claimResult) {
        const resArr = claimResult.Ok.result;
        if (resArr && resArr[0] && resArr[0].result) {
          expect(resArr[0].result).toHaveProperty('Valid');
        }
      }
    }
    // === PHASE 4.5: Verify the new public query for attestations ===
    registryActor.setIdentity(developerIdentity); // Any identity can query

    // The actor method now returns AttestationRecord[] directly.
    const attestations =
      await registryActor.get_attestations_for_wasm(wasmHash);

    // Assert the number of attestations is correct
    expect(attestations).toHaveLength(3);

    // Assert the content of one of the attestations to be sure
    const securityAttestation = attestations.find(
      (att) =>
        'Attestation' in att &&
        att.Attestation.auditor.toText() ===
          securityAuditorIdentity.getPrincipal().toText(),
    );
    expect(securityAttestation).toBeDefined();

    // The test puts the audit type in the metadata, so let's check it
    const auditTypeMeta =
      'Attestation' in securityAttestation!
        ? securityAttestation.Attestation.metadata.find(
            (meta) => meta[0] === '126:audit_type',
          )
        : [];
    expect(auditTypeMeta).toBeDefined();
    // The value is a variant, so we check for the Text property
    // @ts-ignore
    expect(auditTypeMeta[1]).toEqual({ Text: 'security' });

    // === PHASE 5: DAO Finalization ===
    registryActor.setIdentity(daoIdentity);
    const finalizeResult = await registryActor.finalize_verification(
      wasmId,
      { Verified: null },
      [],
    );
    expect('ok' in finalizeResult).toBe(true);

    // === PHASE 6: Developer publishes the now-verified WASM ===
    registryActor.setIdentity(developerIdentity);

    // Step 6.1: Declare the version and its expected hash.
    const updateRequest: UpdateWasmRequest = {
      canister_type_namespace: appNamespace,
      version_number: appVersion,
      description: 'Initial release with verified Wasm',
      repo: 'https://github.com/final-boss/app',
      metadata: [],
      expected_hash: wasmHash,
      expected_chunks: [wasmHash], // For a single chunk, the chunk hash is the wasm hash.
      previous: [],
    };
    const updateResult = await registryActor.icrc118_update_wasm(updateRequest);
    expect('Ok' in updateResult).toBe(true);

    // Step 6.2: Upload the actual WASM bytes with the expected chunk hash.
    const uploadResult = await registryActor.icrc118_upload_wasm_chunk({
      canister_type_namespace: appNamespace,
      version_number: appVersion,
      chunk_id: 0n,
      wasm_chunk: wasmBytes, // Use the actual bytes
      expected_chunk_hash: wasmHash,
    });
    expect(uploadResult.total_chunks).toBe(1n);

    // Owner add operator identity as a controller
    registryActor.setIdentity(developerIdentity);
    const res = await registryActor.icrc118_manage_controller([
      {
        canister_type_namespace: appNamespace,
        op: { Add: null },
        controller: operatorIdentity.getPrincipal(),
      },
    ]);
    expect('Ok' in res[0]).toBe(true);

    // === PHASE 7: Operator UPGRADES a live canister ===
    registryActor.setIdentity(operatorIdentity);
    orchestratorActor.setIdentity(operatorIdentity);

    // Operator registers the canister ID to the namespace
    await orchestratorActor.register_canister(targetCanisterId, appNamespace);

    const versionRecordResult = await registryActor.get_canister_type_version({
      canister_type_namespace: appNamespace,
      version_number: appVersion,
    });
    expect('ok' in versionRecordResult).toBe(true);
    const resolvedHash =
      'ok' in versionRecordResult
        ? (versionRecordResult.ok as { hash: Uint8Array }).hash
        : new Uint8Array();

    const upgradeResult = await orchestratorActor.icrc120_upgrade_to([
      {
        canister_id: targetCanisterId,
        hash: resolvedHash,
        mode: {
          upgrade: [
            {
              skip_pre_upgrade: [false],
              wasm_memory_persistence: [{ keep: null }],
            },
          ],
        },
        args: [],
        parameters: [],
        restart: false,
        snapshot: false,
        stop: false,
        timeout: 0n,
      },
    ]);
    expect('Ok' in upgradeResult[0]).toBe(true);

    // === PHASE 8: Operator polls for upgrade completion ===
    orchestratorActor.setIdentity(operatorIdentity); // Ensure we are the operator

    let finalStatus;
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      const status = await orchestratorActor.icrc120_upgrade_finished();

      if ('InProgress' in status) {
        // In PocketIC, we must advance time manually to allow the canister to work
        await pic.advanceTime(200); // Advance time by 200ms
        await pic.tick(); // Process the next round of inter-canister calls
        retries++;
      } else {
        // Status is either Success or Failed, so we're done polling.
        finalStatus = status;
        break;
      }
    }

    expect(finalStatus).toBeDefined();
    expect('Success' in finalStatus!).toBe(true);

    console.log('E2E test completed successfully!');
  });
});
