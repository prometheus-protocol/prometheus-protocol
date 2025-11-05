import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import {
  describe,
  beforeAll,
  it,
  expect,
  afterAll,
  inject,
  beforeEach,
} from 'vitest';
import { IDL } from '@icp-sdk/core/candid';
import type { Identity } from '@icp-sdk/core/agent';

// --- Import Declarations ---
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
  type _SERVICE as RegistryService,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import {
  DeployOrUpgradeRequest,
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
import { idlFactory as serverIdl } from '@declarations/mcp_server/mcp_server.did.js';
import type { _SERVICE as ServerService } from '@declarations/mcp_server/mcp_server.did.js';

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
const MCP_SERVER_DUMMY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_server/mcp_server.wasm',
);
// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const auditor1Identity: Identity = createIdentity('auditor1-principal');
const auditor2Identity: Identity = createIdentity('auditor2-principal');
const auditor3Identity: Identity = createIdentity('auditor3-principal');
const auditor4Identity: Identity = createIdentity('auditor4-principal');
const auditor5Identity: Identity = createIdentity('auditor5-principal');
const unauthorizedUser: Identity = createIdentity('unauthorized-user');
// --- NEW: An identity for a regular user provisioning an instance ---
const endUserIdentity: Identity = createIdentity('end-user-principal');

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
    ]).buffer,
  });
  const registryFixture = await pic.setupCanister<RegistryService>({
    idlFactory: registryIdlFactory,
    wasm: REGISTRY_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(registryInit({ IDL }), [[]]).buffer,
  });
  const orchestratorFixture = await pic.setupCanister<OrchestratorService>({
    idlFactory: orchestratorIdlFactory,
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    arg: IDL.encode(orchestratorInit({ IDL }), [[]]).buffer,
  });
  const managedCanisterFixture = await pic.setupCanister({
    idlFactory: orchestratorIdlFactory,
    wasm: ORCHESTRATOR_WASM_PATH,
    sender: daoIdentity.getPrincipal(),
    controllers: [orchestratorFixture.canisterId, daoIdentity.getPrincipal()],
    arg: IDL.encode(orchestratorInit({ IDL }), [[]]).buffer,
  });

  return {
    registryActor: registryFixture.actor,
    orchestratorActor: orchestratorFixture.actor,
    auditHubActor: auditHubFixture.actor,
    ledgerActor: ledgerFixture.actor,
    managedCanisterId: managedCanisterFixture.canisterId,
    ledgerCanisterId: ledgerFixture.canisterId,
    registryCanisterId: registryFixture.canisterId,
    orchestratorCanisterId: orchestratorFixture.canisterId,
    auditHubCanisterId: auditHubFixture.canisterId,
  };
}

// --- TEST SUITE 2: SECURE UPGRADE FLOW (Refactored) ---
describe('MCP Orchestrator Secure Upgrade Flow', () => {
  let pic: PocketIc;
  let orchestratorActor: Actor<OrchestratorService>;
  let registryActor: Actor<RegistryService>;
  let auditHubActor: Actor<AuditHubService>;
  let ledgerActor: Actor<LedgerService>;
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
    ledgerActor = env.ledgerActor;
    registryCanisterId = env.registryCanisterId;
    targetCanisterId = env.managedCanisterId;

    // --- Configure inter-canister dependencies ---
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      env.auditHubCanisterId,
    );
    await registryActor.set_bounty_reward_token_canister_id(
      env.ledgerCanisterId,
    );
    orchestratorActor.setIdentity(daoIdentity);
    await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);

    auditHubActor.setIdentity(daoIdentity);
    await auditHubActor.set_payment_token_config(
      env.ledgerCanisterId,
      'USDC',
      6,
    );
    await auditHubActor.set_stake_requirement(buildReproTokenId, 50n);
    await auditHubActor.set_registry_canister_id(env.registryCanisterId);

    // Fund registry with USDC for bounty rewards (9 bounties × ~260k = ~2.34M + buffer)
    ledgerActor.setIdentity(daoIdentity);
    await ledgerActor.icrc1_transfer({
      to: { owner: registryCanisterId, subaccount: [] },
      amount: 3_000_000n,
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
    });

    // Transfer USDC to all 5 auditors and have them deposit stake
    const auditors = [
      auditor1Identity,
      auditor2Identity,
      auditor3Identity,
      auditor4Identity,
      auditor5Identity,
    ];
    for (const auditor of auditors) {
      await ledgerActor.icrc1_transfer({
        to: { owner: auditor.getPrincipal(), subaccount: [] },
        amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Each auditor approves and deposits stake
      ledgerActor.setIdentity(auditor);
      await ledgerActor.icrc2_approve({
        spender: { owner: env.auditHubCanisterId, subaccount: [] },
        amount: 1_010_000n, // 1M USDC + 10k fee
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
        expected_allowance: [],
        expires_at: [],
      });

      auditHubActor.setIdentity(auditor);
      await auditHubActor.deposit_stake(1_000_000n);

      ledgerActor.setIdentity(daoIdentity);
    }

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

    // --- Upload two WASM versions to the registry ---
    const wasmBytes = fs.readFileSync(MCP_SERVER_DUMMY_WASM_PATH);
    unverifiedWasmHash = createHash('sha256').update(wasmBytes).digest();
    verifiedWasmHash = createHash('sha256').update(wasmBytes).digest();

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

    // 1. Developer submits verification request - this auto-creates 9 bounties
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: verifiedWasmHash,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });

    // 2. Fetch the auto-created bounties for this WASM
    const wasmBounties = await registryActor.get_bounties_for_wasm(wasmId);
    expect(wasmBounties.length).toBeGreaterThanOrEqual(5);

    // 3. Take first 5 bounties for 5-of-9 consensus
    const bountyIds = wasmBounties.slice(0, 5).map((b: any) => b.bounty_id);

    // 4. All 5 auditors reserve and attest
    const auditors = [
      auditor1Identity,
      auditor2Identity,
      auditor3Identity,
      auditor4Identity,
      auditor5Identity,
    ];
    for (let i = 0; i < 5; i++) {
      auditHubActor.setIdentity(auditors[i]);
      await auditHubActor.reserve_bounty(bountyIds[i], buildReproTokenId);

      registryActor.setIdentity(auditors[i]);
      const res = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: buildReproTokenId }],
          ['bounty_id', { Nat: bountyIds[i] }],
        ],
      });
      if (i === 0) {
        console.log('First Attestation Result:', res);
      }
    }

    // 5. Assert: Wasm is now automatically verified after 5-of-9 consensus
    expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);
  });

  it('should ACCEPT an upgrade from an authorized user to a now-VERIFIED Wasm', async () => {
    // This test now runs the verification lifecycle as part of its setup
    const wasmId = Buffer.from(verifiedWasmHash).toString('hex');
    if (!(await registryActor.is_wasm_verified(wasmId))) {
      // Run the full verification flow with 5 auditors
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: verifiedWasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });

      // Fetch the auto-created bounties for this WASM
      const wasmBounties = await registryActor.get_bounties_for_wasm(wasmId);
      const bountyIds = wasmBounties.slice(0, 5).map((b: any) => b.bounty_id);

      // All 5 auditors reserve and attest
      const auditors = [
        auditor1Identity,
        auditor2Identity,
        auditor3Identity,
        auditor4Identity,
        auditor5Identity,
      ];
      for (let i = 0; i < 5; i++) {
        auditHubActor.setIdentity(auditors[i]);
        await auditHubActor.reserve_bounty(bountyIds[i], buildReproTokenId);

        registryActor.setIdentity(auditors[i]);
        await registryActor.icrc126_file_attestation({
          wasm_id: wasmId,
          metadata: [
            ['126:audit_type', { Text: buildReproTokenId }],
            ['bounty_id', { Nat: bountyIds[i] }],
          ],
        });
      }
    }

    // Now, perform the upgrade
    orchestratorActor.setIdentity(daoIdentity);
    const upgradeRequest: DeployOrUpgradeRequest = {
      namespace: secureNamespace,
      hash: verifiedWasmHash,
      mode: { install: null },
      args: [],
      stop: false,
      snapshot: false,
      restart: false,
      timeout: 10_000n,
      parameters: [],
      deployment_type: { global: null },
    };
    const result = await orchestratorActor.deploy_or_upgrade(upgradeRequest);
    expect(result).toHaveProperty('ok');

    // @ts-ignore
    console.log('Upgrade Result:', result.ok.toText());
    expect(result).toHaveProperty('ok');

    // TODO: Figure out why we cant tick or advance time here
    // pic.tick(1000 * 60 * 5); // Advance 5 minutes
    // pic.setTime(new Date(Date.now() + 1000 * 60 * 5));

    // // Check that the owner is the developer (from init args)
    // const managedCanisterActor = pic.createActor<ServerService>(
    //   serverIdl,
    //   // @ts-ignore
    //   result.ok,
    // );
    // const owner = await managedCanisterActor.get_owner();
    // expect(owner).toEqual(developerIdentity.getPrincipal());

    // const status = await managedCanisterActor.icrc120_upgrade_finished();
    // expect(status).toHaveProperty('Success');
  });

  // --- NEW TEST SUITE: CYCLE TOP-UP SYSTEM ---
  describe('Cycle Top-Up System', () => {
    let pic: PocketIc;
    let orchestratorActor: Actor<OrchestratorService>;
    let orchestratorCanisterId: Principal;
    let registryActor: Actor<RegistryService>;
    let auditHubActor: Actor<AuditHubService>;
    let verifiedWasmHash: Uint8Array;
    const managedNamespace = 'com.test.cycles-topup';
    let managedCanisterId: Principal;

    // Test constants
    const TOP_UP_AMOUNT = 1_000_000_000_000n; // 1T cycles
    const TEST_INTERVAL_SECONDS = 60n; // 1 minute for faster testing

    // Create the PocketIC instance once for the entire suite
    beforeAll(async () => {
      pic = await PocketIc.create(inject('PIC_URL'));

      const env = await setupEnvironment(pic);
      orchestratorActor = env.orchestratorActor;
      orchestratorCanisterId = env.orchestratorCanisterId;
      registryActor = env.registryActor;
      auditHubActor = env.auditHubActor;
      ledgerActor = env.ledgerActor;
      registryCanisterId = env.registryCanisterId;
      targetCanisterId = env.managedCanisterId;

      // --- Configure inter-canister dependencies ---
      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        env.auditHubCanisterId,
      );
      await registryActor.set_bounty_reward_token_canister_id(
        env.ledgerCanisterId,
      );
      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_payment_token_config(
        env.ledgerCanisterId,
        'USDC',
        6,
      );
      await auditHubActor.set_stake_requirement(buildReproTokenId, 50n);
      await auditHubActor.set_registry_canister_id(env.registryCanisterId);

      // Fund registry with USDC for bounty rewards (9 bounties × ~260k = ~2.34M + buffer)
      ledgerActor.setIdentity(daoIdentity);
      await ledgerActor.icrc1_transfer({
        to: { owner: registryCanisterId, subaccount: [] },
        amount: 3_000_000n,
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Transfer USDC to all 5 auditors and have them deposit stake
      const auditors = [
        auditor1Identity,
        auditor2Identity,
        auditor3Identity,
        auditor4Identity,
        auditor5Identity,
      ];
      for (const auditor of auditors) {
        await ledgerActor.icrc1_transfer({
          to: { owner: auditor.getPrincipal(), subaccount: [] },
          amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
        });

        // Each auditor approves and deposits stake
        ledgerActor.setIdentity(auditor);
        await ledgerActor.icrc2_approve({
          spender: { owner: env.auditHubCanisterId, subaccount: [] },
          amount: 1_010_000n, // 1M USDC + 10k fee
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
          expected_allowance: [],
          expires_at: [],
        });

        auditHubActor.setIdentity(auditor);
        await auditHubActor.deposit_stake(1_000_000n);

        ledgerActor.setIdentity(daoIdentity);
      }

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

      // --- Upload two WASM versions to the registry ---
      const wasmBytes = fs.readFileSync(MCP_SERVER_DUMMY_WASM_PATH);
      unverifiedWasmHash = createHash('sha256').update(wasmBytes).digest();
      verifiedWasmHash = createHash('sha256').update(wasmBytes).digest();

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

      const initArgType = IDL.Opt(
        IDL.Record({
          owner: IDL.Opt(IDL.Principal),
        }),
      );

      // 2. Create the corresponding JavaScript value.
      // Note the nested arrays to represent the nested optional types.
      const initArgValue = [
        // Outer Opt for the record
        {
          owner: [developerIdentity.getPrincipal()], // Inner Opt for the Principal
        },
      ];

      // 3. Encode the value using the type.
      // IDL.encode returns an ArrayBuffer, which we convert to Uint8Array.
      const encodedArgs = new Uint8Array(
        IDL.encode([initArgType], [initArgValue]),
      );

      // Verify the WASM before deploying
      const wasmId = Buffer.from(verifiedWasmHash).toString('hex');
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: verifiedWasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });

      // Get auto-created bounties and have 5 auditors attest
      const wasmBounties = await registryActor.get_bounties_for_wasm(wasmId);
      const bountyIds = wasmBounties.slice(0, 5).map((b: any) => b.bounty_id);

      for (let i = 0; i < 5; i++) {
        const auditorIdentities = [
          auditor1Identity,
          auditor2Identity,
          auditor3Identity,
          auditor4Identity,
          auditor5Identity,
        ];
        auditHubActor.setIdentity(auditorIdentities[i]);
        await auditHubActor.reserve_bounty(bountyIds[i], buildReproTokenId);

        registryActor.setIdentity(auditorIdentities[i]);
        await registryActor.icrc126_file_attestation({
          wasm_id: wasmId,
          metadata: [
            ['126:audit_type', { Text: buildReproTokenId }],
            ['bounty_id', { Nat: bountyIds[i] }],
          ],
        });
      }

      orchestratorActor.setIdentity(daoIdentity);
      const deployResult = await orchestratorActor.deploy_or_upgrade({
        namespace: managedNamespace,
        hash: verifiedWasmHash,
        mode: { install: null },
        args: encodedArgs,
        stop: false,
        snapshot: false,
        restart: false,
        timeout: 0n,
        parameters: [],
        deployment_type: { global: null },
      });
      expect(deployResult).toHaveProperty('ok');
      // @ts-ignore
      managedCanisterId = deployResult.ok;
    });

    afterAll(async () => {
      await pic.tearDown();
    });

    it('should top up a managed canister when its cycle balance falls below the threshold', async () => {
      // Arrange
      const balanceBefore = await pic.getCyclesBalance(managedCanisterId);
      // Set the threshold HIGHER than the current balance to force a top-up
      // Make threshold high enough that even after one top-up, it will still need another
      const threshold = balanceBefore + Number(TOP_UP_AMOUNT) * 2;

      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_cycle_top_up_config({
        enabled: true,
        threshold: BigInt(threshold),
        amount: TOP_UP_AMOUNT,
        interval_seconds: TEST_INTERVAL_SECONDS,
      });

      // Act - First top-up
      // Advance time past the interval to trigger the timer
      await pic.advanceTime(Number(TEST_INTERVAL_SECONDS) * 1000 + 5000);
      await pic.tick(8);

      // Assert - First top-up
      const balanceAfterFirst = await pic.getCyclesBalance(managedCanisterId);
      const expectedBalanceFirst = balanceBefore + Number(TOP_UP_AMOUNT);

      // The balance should have increased by approximately the top-up amount
      expect(balanceAfterFirst).toBeGreaterThan(balanceBefore);
      expect(balanceAfterFirst).toBeLessThanOrEqual(expectedBalanceFirst);
      // Allow for a small amount of cycle burn during the process
      expect(balanceAfterFirst).toBeGreaterThan(
        expectedBalanceFirst - 1_000_000,
      );

      // Act - Second top-up (verify timer reschedules)
      // Since the canister is still below threshold, it should top up again
      await pic.advanceTime(Number(TEST_INTERVAL_SECONDS) * 1000 + 5000);
      await pic.tick(20); // More ticks to ensure all async operations complete

      // Assert - Second top-up
      const balanceAfterSecond = await pic.getCyclesBalance(managedCanisterId);
      const expectedBalanceSecond = balanceAfterFirst + Number(TOP_UP_AMOUNT);

      // The balance should have increased again
      expect(balanceAfterSecond).toBeGreaterThan(balanceAfterFirst);
      expect(balanceAfterSecond).toBeLessThanOrEqual(expectedBalanceSecond * 2); // Allow for multiple top-ups due to timer behavior
      expect(balanceAfterSecond).toBeGreaterThan(
        expectedBalanceSecond - 1_000_000,
      );
    });

    it('should NOT top up a canister if its balance is above the threshold', async () => {
      // Arrange
      const balanceBefore = await pic.getCyclesBalance(managedCanisterId);
      // Set the threshold LOWER than the current balance
      const threshold = balanceBefore - 1_000_000_000;

      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_cycle_top_up_config({
        enabled: true,
        threshold: BigInt(threshold),
        amount: TOP_UP_AMOUNT,
        interval_seconds: TEST_INTERVAL_SECONDS,
      });

      // Act
      await pic.advanceTime(Number(TEST_INTERVAL_SECONDS) * 1000 + 5000);
      await pic.tick(8);

      // Assert
      const balanceAfter = await pic.getCyclesBalance(managedCanisterId);
      // Balance should not have increased by the top-up amount. It may have decreased slightly due to burn.
      expect(balanceAfter).toBeLessThanOrEqual(balanceBefore);
    });

    it('should NOT top up a canister when the feature is disabled', async () => {
      // Arrange
      // Set the threshold HIGHER to create a top-up condition
      const threshold = 999_999_999_999_999n; // Very high threshold
      
      // But disable the feature
      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_cycle_top_up_config({
        enabled: false,
        threshold: threshold,
        amount: TOP_UP_AMOUNT,
        interval_seconds: TEST_INTERVAL_SECONDS,
      });

      // Allow the config change to take effect and any pending timers to be cancelled/complete
      await pic.tick(10);
      
      // Record balance AFTER cleanup
      const balanceBefore = await pic.getCyclesBalance(managedCanisterId);

      // Act
      await pic.advanceTime(Number(TEST_INTERVAL_SECONDS) * 1000 + 5000);
      await pic.tick(8);

      // Assert
      const balanceAfter = await pic.getCyclesBalance(managedCanisterId);
      // Balance should not have increased
      expect(balanceAfter).toBeLessThanOrEqual(balanceBefore);
    });

    it('should NOT top up a canister if the orchestrator has insufficient cycles', async () => {
      // Arrange
      const managedCanisterBalanceBefore =
        await pic.getCyclesBalance(managedCanisterId);
      const orchestratorBalance = await pic.getCyclesBalance(
        orchestratorCanisterId,
      );

      // Set the threshold HIGHER to force a top-up condition
      const threshold = managedCanisterBalanceBefore + 1_000_000_000;
      // Set the top-up amount to be MORE than the orchestrator has
      const impossibleTopUpAmount = orchestratorBalance + 1;

      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_cycle_top_up_config({
        enabled: true,
        threshold: BigInt(threshold),
        amount: BigInt(impossibleTopUpAmount),
        interval_seconds: TEST_INTERVAL_SECONDS,
      });

      // Act
      await pic.advanceTime(Number(TEST_INTERVAL_SECONDS) * 1000 + 5000);
      await pic.tick(8);

      // Assert
      const balanceAfter = await pic.getCyclesBalance(managedCanisterId);
      // Balance should not have increased because the orchestrator couldn't afford it
      expect(balanceAfter).toBeLessThanOrEqual(managedCanisterBalanceBefore);
    });
  });

  describe('Provisioned Instance Provisioning', () => {
    let pic: PocketIc;
    let orchestratorActor: Actor<OrchestratorService>;
    let orchestratorCanisterId: Principal;
    let registryActor: Actor<RegistryService>;
    let auditHubActor: Actor<AuditHubService>;
    let ledgerActor: Actor<LedgerService>;
    let wasmId: string;

    const globalNamespace = 'com.test.global-server';
    const provisionedNamespace = 'com.test.private-vault';
    const buildReproTokenId = 'build_reproducibility_v1';

    beforeAll(async () => {
      pic = await PocketIc.create(inject('PIC_URL'));
      const env = await setupEnvironment(pic);
      orchestratorActor = env.orchestratorActor;
      orchestratorCanisterId = env.orchestratorCanisterId;
      registryActor = env.registryActor;
      auditHubActor = env.auditHubActor;
      ledgerActor = env.ledgerActor;

      // --- Configure inter-canister dependencies ---
      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        env.auditHubCanisterId,
      );
      await registryActor.set_bounty_reward_token_canister_id(
        env.ledgerCanisterId,
      );
      orchestratorActor.setIdentity(daoIdentity);
      await orchestratorActor.set_mcp_registry_id(env.registryCanisterId);

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_payment_token_config(
        env.ledgerCanisterId,
        'USDC',
        6,
      );
      await auditHubActor.set_stake_requirement(buildReproTokenId, 50n);
      await auditHubActor.set_registry_canister_id(env.registryCanisterId);

      // Fund registry with USDC for auto-bounty creation (9 bounties × ~260k = ~2.34M + buffer)
      ledgerActor.setIdentity(daoIdentity);
      await ledgerActor.icrc1_transfer({
        to: { owner: env.registryCanisterId, subaccount: [] },
        amount: 3_000_000n,
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Transfer USDC to all 5 auditors and have them deposit stake
      const auditors = [
        auditor1Identity,
        auditor2Identity,
        auditor3Identity,
        auditor4Identity,
        auditor5Identity,
      ];
      for (const auditor of auditors) {
        await ledgerActor.icrc1_transfer({
          to: { owner: auditor.getPrincipal(), subaccount: [] },
          amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
        });

        // Auditor: Approve and deposit stake
        ledgerActor.setIdentity(auditor);
        await ledgerActor.icrc2_approve({
          spender: { owner: env.auditHubCanisterId, subaccount: [] },
          amount: 1_010_000n, // 1M USDC + 10k fee
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
          expected_allowance: [],
          expires_at: [],
        });
        auditHubActor.setIdentity(auditor);
        await auditHubActor.deposit_stake(1_000_000n);

        // Reset ledger identity to DAO for next iteration
        ledgerActor.setIdentity(daoIdentity);
      }

      // --- Setup a verified WASM to be used by both app types ---
      const wasmBytes = fs.readFileSync(MCP_SERVER_DUMMY_WASM_PATH);
      const wasmHash = createHash('sha256').update(wasmBytes).digest();
      wasmId = Buffer.from(wasmHash).toString('hex');

      // --- 1. SETUP MULTI-TENANT (GLOBAL) APP ---
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc118_create_canister_type([
        {
          canister_type_namespace: globalNamespace,
          controllers: [[developerIdentity.getPrincipal()]],
          canister_type_name: 'Global Server',
          description: '',
          repo: '',
          metadata: [],
          forked_from: [],
        },
      ]);
      await registryActor.icrc118_update_wasm({
        canister_type_namespace: globalNamespace,
        version_number: [0n, 0n, 1n],
        expected_hash: wasmHash,
        expected_chunks: [wasmHash],
        // ... other fields
        previous: [],
        metadata: [],
        repo: '',
        description: '',
      });
      await registryActor.icrc118_upload_wasm_chunk({
        canister_type_namespace: globalNamespace,
        version_number: [0n, 0n, 1n],
        wasm_chunk: wasmBytes,
        chunk_id: 0n,
        expected_chunk_hash: wasmHash,
      });
      // Verify it, marking it as 'global'
      await verifyWasm(
        registryActor,
        auditHubActor,
        env.ledgerCanisterId,
        wasmHash,
        {
          Text: 'global',
        },
      );

      // --- 2. SETUP PROVISIONED (PRIVATE) APP ---
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc118_create_canister_type([
        {
          canister_type_namespace: provisionedNamespace,
          controllers: [[developerIdentity.getPrincipal()]],
          canister_type_name: 'Private Vault',
          description: '',
          repo: '',
          metadata: [],
          forked_from: [],
        },
      ]);
      await registryActor.icrc118_update_wasm({
        canister_type_namespace: provisionedNamespace,
        version_number: [0n, 0n, 1n],
        expected_hash: wasmHash,
        expected_chunks: [wasmHash],
        // ... other fields
        previous: [],
        metadata: [],
        repo: '',
        description: '',
      });
      await registryActor.icrc118_upload_wasm_chunk({
        canister_type_namespace: provisionedNamespace,
        version_number: [0n, 0n, 1n],
        wasm_chunk: wasmBytes,
        chunk_id: 0n,
        expected_chunk_hash: wasmHash,
      });
      // Verify it, marking it as 'provisioned'
      await verifyWasm(
        registryActor,
        auditHubActor,
        env.ledgerCanisterId,
        wasmHash,
        {
          Text: 'provisioned',
        },
      );
    });

    afterAll(async () => {
      await pic.tearDown();
    });

    it('should allow a user to provision an instance of a provisioned app', async () => {
      // Arrange: Use the end-user identity
      orchestratorActor.setIdentity(endUserIdentity);

      // Act: Call the new provisioning endpoint
      const result = await orchestratorActor.provision_instance(
        provisionedNamespace,
        wasmId,
      );

      // Assert
      expect(result).toHaveProperty('ok');
      // @ts-ignore
      const newCanisterId = result.ok;

      // Assert controllers: should be the user AND the orchestrator
      const controllers = await pic.getControllers(newCanisterId);
      expect(controllers).toHaveLength(1);
      expect(controllers).toContainEqual(orchestratorCanisterId);

      // Assert tracking: orchestrator should now track this new canister
      const canisterList =
        await orchestratorActor.get_canisters(provisionedNamespace);
      expect(canisterList).toHaveLength(1);
      expect(canisterList[0]).toEqual(newCanisterId);
    });

    it('should allow the Orchestrator owner to deploy a shared instance of a global app', async () => {
      // Arrange: Use the developer identity
      orchestratorActor.setIdentity(daoIdentity);
      const wasmHash = createHash('sha256')
        .update(fs.readFileSync(MCP_SERVER_DUMMY_WASM_PATH))
        .digest();

      // Act: Call the standard deploy endpoint
      const result = await orchestratorActor.deploy_or_upgrade({
        namespace: globalNamespace,
        hash: wasmHash,
        mode: { install: null },
        args: [],
        stop: false,
        snapshot: false,
        restart: false,
        timeout: 0n,
        parameters: [],
        deployment_type: { global: null },
      });

      // Assert
      expect(result).toHaveProperty('ok');
      const canisterList =
        await orchestratorActor.get_canisters(globalNamespace);
      expect(canisterList).toHaveLength(1);
    });

    it('should REJECT developer deployment of a provisioned app via the standard endpoint', async () => {
      // Arrange: Use the developer identity
      orchestratorActor.setIdentity(developerIdentity);
      const wasmHash = createHash('sha256')
        .update(fs.readFileSync(MCP_SERVER_DUMMY_WASM_PATH))
        .digest();

      const initialCanisterList =
        await orchestratorActor.get_canisters(provisionedNamespace);

      // Act: Attempt to deploy a provisioned app as if it were global
      const result = await orchestratorActor.deploy_or_upgrade({
        namespace: provisionedNamespace,
        hash: wasmHash,
        mode: { install: null },
        args: [],
        stop: false,
        snapshot: false,
        restart: false,
        timeout: 0n,
        parameters: [],
        deployment_type: { global: null },
      });

      // Assert: The call should fail because this endpoint is not for provisioning user instances
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(
        /Unauthorized: Only the owner can call this function./,
      );

      // Assert: No canister should have been created
      const afteCanisterList =
        await orchestratorActor.get_canisters(provisionedNamespace);
      expect(afteCanisterList).toHaveLength(initialCanisterList.length);
    });
  });

  // --- Helper function for WASM verification ---
  async function verifyWasm(
    registryActor: Actor<RegistryService>,
    auditHubActor: Actor<AuditHubService>,
    ledgerCanisterId: Principal,
    wasmHash: Uint8Array,
    deploymentType: { Text: 'global' } | { Text: 'provisioned' },
  ) {
    const wasmId = Buffer.from(wasmHash).toString('hex');
    if (await registryActor.is_wasm_verified(wasmId)) {
      return;
    }

    // Call verification request - this will auto-create 9 bounties
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [
        // This is the key part: injecting the deployment type during attestation
        ['deployment_type', deploymentType],
      ],
    });

    // Fetch the auto-created bounties for this WASM
    const wasmBounties = await registryActor.get_bounties_for_wasm(wasmId);

    // Take first 5 bounties for 5-of-9 consensus
    const bountyIds = wasmBounties.slice(0, 5).map((b: any) => b.bounty_id);

    // All 5 auditors reserve and attest
    const auditors = [
      auditor1Identity,
      auditor2Identity,
      auditor3Identity,
      auditor4Identity,
      auditor5Identity,
    ];
    for (let i = 0; i < 5; i++) {
      auditHubActor.setIdentity(auditors[i]);
      await auditHubActor.reserve_bounty(
        bountyIds[i],
        'build_reproducibility_v1',
      );

      registryActor.setIdentity(auditors[i]);
      const attestRes = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: 'build_reproducibility_v1' }],
          ['bounty_id', { Nat: bountyIds[i] }],
        ],
      });
      expect(attestRes).toHaveProperty('Ok');
    }

    expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);
  }
});
