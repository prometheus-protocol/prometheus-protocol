// packages/canisters/mcp_registry/test/mcp_registry_icrc127.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
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
import type { Actor } from '@dfinity/pic';
import { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';

// --- Import Declarations ---
// Registry
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type { _SERVICE as RegistryService } from '@declarations/mcp_registry/mcp_registry.did.js';
// ICRC-1 Ledger
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import type { _SERVICE as LedgerService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
// Audit Hub (NEW)
import { idlFactory as auditHubIdlFactory } from '@declarations/audit_hub/audit_hub.did.js';
import type { _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did.js';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm.gz',
);
const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);
// NEW Wasm Path
const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const bountyCreatorIdentity: Identity = createIdentity('bounty-creator');
const auditorIdentity: Identity = createIdentity('auditor-principal');
const maliciousAuditorIdentity: Identity = createIdentity('malicious-auditor');

describe('MCP Registry ICRC-127 Integration with Audit Hub', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let ledgerActor: Actor<LedgerService>;
  let auditHubActor: Actor<AuditHubService>;
  let bountyId: bigint;
  let ledgerCanisterId: Principal; // store ledger canister ID for token_id
  let fee: bigint = 10_000n;
  const wasmHashToVerify = new Uint8Array([10, 11, 12]);
  const wasmIdToVerify = Buffer.from(wasmHashToVerify).toString('hex');
  const bountyAmount = 500_000n;
  const reputationTokenId = 'data_safety_v1';
  const reputationStakeAmount = 100n;

  // Use beforeEach to get a clean state for every test
  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

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
            transfer_fee: fee,
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
    ledgerActor = ledgerFixture.actor;
    ledgerCanisterId = ledgerFixture.canisterId; // save for token_id parameter

    // 2. Deploy the NEW Audit Hub Canister
    const auditHubFixture = await pic.setupCanister<AuditHubService>({
      idlFactory: auditHubIdlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    auditHubActor = auditHubFixture.actor;

    // 3. Deploy Registry
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]).buffer,
    });
    registryActor = registryFixture.actor;

    // 4. Configure Registry to use the Audit Hub
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      auditHubFixture.canisterId,
    );

    // 5. Fund Bounty Creator and have them approve the AUDIT HUB
    ledgerActor.setIdentity(daoIdentity);
    await ledgerActor.icrc1_transfer({
      to: { owner: bountyCreatorIdentity.getPrincipal(), subaccount: [] },
      amount: bountyAmount + fee + fee + fee, // Extra fee for approve and transfer out
      memo: [],
      from_subaccount: [],
      created_at_time: [],
      fee: [],
    });
    ledgerActor.setIdentity(bountyCreatorIdentity);
    await ledgerActor.icrc2_approve({
      spender: { owner: auditHubFixture.canisterId, subaccount: [] }, // CHANGED: Approve audit_hub, not registry
      amount: bountyAmount + fee + fee, // Extra fee for transfer out
      fee: [],
      memo: [],
      from_subaccount: [],
      created_at_time: [],
      expected_allowance: [],
      expires_at: [],
    });

    auditHubActor.setIdentity(daoIdentity);
    // Configure the required stake for the reputation token
    await auditHubActor.set_stake_requirement(
      reputationTokenId, // audit_type
      ledgerFixture.canisterId.toText(), // token_id is the ledger canister ID
      reputationStakeAmount,
    );

    // 6. Transfer USDC to auditors and have them deposit stake
    ledgerActor.setIdentity(daoIdentity);
    // Transfer to auditor 1
    await ledgerActor.icrc1_transfer({
      to: { owner: auditorIdentity.getPrincipal(), subaccount: [] },
      amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
    });
    // Transfer to auditor 2
    await ledgerActor.icrc1_transfer({
      to: { owner: maliciousAuditorIdentity.getPrincipal(), subaccount: [] },
      amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
    });

    // Auditor 1: Approve and deposit stake
    ledgerActor.setIdentity(auditorIdentity);
    await ledgerActor.icrc2_approve({
      spender: { owner: auditHubFixture.canisterId, subaccount: [] },
      amount: 1_010_000n, // 1M USDC + 10k fee
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
      expected_allowance: [],
      expires_at: [],
    });
    auditHubActor.setIdentity(auditorIdentity);
    await auditHubActor.deposit_stake(
      ledgerFixture.canisterId.toText(),
      1_000_000n,
    );

    // Auditor 2: Approve and deposit stake
    ledgerActor.setIdentity(maliciousAuditorIdentity);
    await ledgerActor.icrc2_approve({
      spender: { owner: auditHubFixture.canisterId, subaccount: [] },
      amount: 1_010_000n, // 1M USDC + 10k fee
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
      expected_allowance: [],
      expires_at: [],
    });
    auditHubActor.setIdentity(maliciousAuditorIdentity);
    await auditHubActor.deposit_stake(
      ledgerFixture.canisterId.toText(),
      1_000_000n,
    );

    // 7. Create the auditable entity and the bounty
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHashToVerify,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });
    // Create bounty on AUDIT HUB (new architecture)
    auditHubActor.setIdentity(bountyCreatorIdentity);
    const createResult = await auditHubActor.icrc127_create_bounty({
      bounty_id: [],
      validation_canister_id: auditHubFixture.canisterId, // AUDIT HUB validates (by checking registry)
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHashToVerify }],
          ['wasm_id', { Text: wasmIdToVerify }], // REQUIRED for validation hook
          ['audit_type', { Text: reputationTokenId }], // metadata descriptive string
        ],
      },
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: ledgerFixture.canisterId }],
        ['icrc127:reward_amount', { Nat: bountyAmount }],
      ],
      start_date: [],
    });
    console.log('Create bounty result:', createResult);
    bountyId = ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;
    console.log('Bounty ID:', bountyId);
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should REJECT attestation if the auditor has not reserved the bounty', async () => {
    // The auditor is qualified but has not locked the bounty.
    registryActor.setIdentity(auditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }], // metadata descriptive string
        ['bounty_id', { Nat: bountyId }],
      ], // Correctly includes bounty_id
    });

    // The facade should reject this.
    expect(attestResult).toHaveProperty('Error');
    // @ts-ignore
    expect(attestResult.Error).toHaveProperty('Unauthorized');
  });

  it('should REJECT attestation from an auditor who did not reserve the bounty', async () => {
    // The legitimate auditor reserves the bounty
    auditHubActor.setIdentity(auditorIdentity);
    await auditHubActor.reserve_bounty(bountyId, reputationTokenId);

    // The malicious auditor tries to file the attestation
    registryActor.setIdentity(maliciousAuditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }], // metadata descriptive string
        ['bounty_id', { Nat: bountyId }],
      ],
    });

    // The facade should reject this.
    expect(attestResult).toHaveProperty('Error');
    // @ts-ignore
    expect(attestResult.Error).toHaveProperty('Unauthorized');
  });

  it('should ALLOW manual bounty submission for tools_v1 audit type', async () => {
    // Reserve the bounty first
    auditHubActor.setIdentity(auditorIdentity);
    await auditHubActor.reserve_bounty(bountyId, reputationTokenId);

    // The auditor files the attestation
    registryActor.setIdentity(auditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }], // metadata descriptive string
        ['bounty_id', { Nat: bountyId }],
      ],
    });
    console.log('Attestation result:', attestResult);
    expect(attestResult).toHaveProperty('Ok');

    // Verify the participation was recorded
    const hasParticipated =
      await registryActor.has_verifier_participated_in_wasm(
        auditorIdentity.getPrincipal(),
        wasmIdToVerify,
        reputationTokenId,
      );
    console.log('Has participated:', hasParticipated);
    expect(hasParticipated).toBe(true);

    // Now they claim the bounty from AUDIT HUB. Manual claims are allowed for tools_v1 audits.
    auditHubActor.setIdentity(auditorIdentity);
    const submitResult = await auditHubActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty' },
      account: [],
    });
    console.log('Submit result:', submitResult);

    expect(submitResult).toHaveProperty('Ok');
    // @ts-ignore
    expect(submitResult.Ok.result.length).toBeGreaterThan(0);
  });

  it('should ALLOW manual bounty claims with valid reservation and attestation for tools_v1', async () => {
    // --- 1. Reserve the Bounty ---
    auditHubActor.setIdentity(auditorIdentity);
    const reserveResult = await auditHubActor.reserve_bounty(
      bountyId,
      reputationTokenId, // audit_type
    );
    expect(reserveResult).toHaveProperty('ok');

    // --- 2. File the Attestation on REGISTRY ---
    registryActor.setIdentity(auditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }], // metadata descriptive string
        ['bounty_id', { Nat: bountyId }],
      ],
    });
    expect(attestResult).toHaveProperty('Ok');

    // --- 3. Manually submit the bounty to AUDIT HUB (should succeed for tools_v1) ---
    auditHubActor.setIdentity(auditorIdentity);
    const submitResult = await auditHubActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty now' },
      account: [], // Payout to self
    });

    // Manual claims are allowed for tools_v1 audits (not build_reproducibility_v1)
    expect(submitResult).toHaveProperty('Ok');
    // @ts-ignore
    expect(submitResult.Ok.result.length).toBeGreaterThan(0);
  });
});
