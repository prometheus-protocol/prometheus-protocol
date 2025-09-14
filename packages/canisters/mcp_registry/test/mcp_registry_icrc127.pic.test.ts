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
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

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
      ]),
    });
    ledgerActor = ledgerFixture.actor;

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
      arg: IDL.encode(registryInit({ IDL }), [[]]),
    });
    registryActor = registryFixture.actor;

    // 4. Configure Registry to use the Audit Hub
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      auditHubFixture.canisterId,
    );

    // 5. Fund Bounty Creator and have them approve the Registry
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
      spender: { owner: registryFixture.canisterId, subaccount: [] },
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
      reputationTokenId,
      reputationStakeAmount,
    );

    // 6. Mint Reputation Tokens to our auditors
    await auditHubActor.mint_tokens(
      auditorIdentity.getPrincipal(),
      reputationTokenId,
      1000n,
    );
    await auditHubActor.mint_tokens(
      maliciousAuditorIdentity.getPrincipal(),
      reputationTokenId,
      1000n,
    );

    // 7. Create the auditable entity and the bounty
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHashToVerify,
      repo: 'https://github.com/test/repo',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });
    registryActor.setIdentity(bountyCreatorIdentity);
    const createResult = await registryActor.icrc127_create_bounty({
      bounty_id: [],
      validation_canister_id: registryFixture.canisterId,
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHashToVerify }],
          ['audit_type', { Text: reputationTokenId }],
        ],
      },
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: ledgerFixture.canisterId }],
        ['icrc127:reward_amount', { Nat: bountyAmount }],
      ],
      start_date: [],
    });
    bountyId = ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;
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
        ['126:audit_type', { Text: reputationTokenId }],
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
        ['126:audit_type', { Text: reputationTokenId }],
        ['bounty_id', { Nat: bountyId }],
      ],
    });

    // The facade should reject this.
    expect(attestResult).toHaveProperty('Error');
    // @ts-ignore
    expect(attestResult.Error).toHaveProperty('Unauthorized');
  });

  it('should REJECT bounty submission if the claimant has not reserved the bounty', async () => {
    // The auditor files the attestation WITHOUT reserving first (which will fail)
    registryActor.setIdentity(auditorIdentity);
    await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }],
        ['bounty_id', { Nat: bountyId }],
      ],
    });

    // Now they try to claim the bounty. The facade should reject this.
    const submitResult = await registryActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty' },
      account: [],
    });

    expect(submitResult).toHaveProperty('Error');
    // @ts-ignore
    expect(submitResult.Error.Generic).toMatch(
      /Caller is not the authorized claimant/,
    );
  });

  it('should successfully process a claim through the full, correct lifecycle', async () => {
    // --- 1. Reserve the Bounty ---
    auditHubActor.setIdentity(auditorIdentity);
    const reserveResult = await auditHubActor.reserve_bounty(
      bountyId,
      reputationTokenId,
    );
    expect(reserveResult).toHaveProperty('ok');

    // --- 2. File the Attestation (as the claimant) ---
    registryActor.setIdentity(auditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }], // Additional metadata
        ['bounty_id', { Nat: bountyId }], // Pass bounty_id
      ],
    });
    expect(attestResult).toHaveProperty('Ok');

    // --- 3. Submit the Bounty (as the claimant) ---
    const submitResult = await registryActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty now' },
      account: [], // Payout to self
    });

    // The facade check passes, and the hook check passes.
    expect(submitResult).toHaveProperty('Ok');
    // @ts-ignore
    expect(submitResult.Ok.result[0].result).toHaveProperty('Valid');

    // --- 4. Verify Payout ---
    const claimantBalance = await ledgerActor.icrc1_balance_of({
      owner: auditorIdentity.getPrincipal(),
      subaccount: [],
    });
    expect(claimantBalance).toBe(bountyAmount);

    // --- 5. Verify Stake was Returned (by DAO releasing it) ---
    auditHubActor.setIdentity(daoIdentity);
    await auditHubActor.release_stake(bountyId);
    const finalReputation = await auditHubActor.get_available_balance(
      auditorIdentity.getPrincipal(),
      reputationTokenId,
    );
    expect(finalReputation).toBe(1000n); // Back to the original amount
  });
});
