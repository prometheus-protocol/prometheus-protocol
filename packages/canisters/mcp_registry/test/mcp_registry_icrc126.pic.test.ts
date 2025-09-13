import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, it, expect, afterAll, inject, beforeEach } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// --- Import Declarations ---
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type { _SERVICE as RegistryService } from '@declarations/mcp_registry/mcp_registry.did';
import { idlFactory as auditHubIdlFactory } from '@declarations/audit_hub/audit_hub.did.js';
import type { _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did';
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import type { _SERVICE as LedgerService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
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

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const auditorIdentity: Identity = createIdentity('auditor-principal');
const maliciousAuditorIdentity: Identity = createIdentity('malicious-auditor');
const bountyCreatorIdentity: Identity = createIdentity('bounty-creator');

describe('MCP Registry ICRC-126 Integration', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let auditHubActor: Actor<AuditHubService>;
  let ledgerActor: Actor<LedgerService>;
  let ledgerCanisterId: Principal;
  let registryCanisterId: Principal;

  afterAll(async () => {
    await pic.tearDown();
  });

  // =====================================================================================
  // == SUITE 1: Declarative Attestations (e.g., Security)
  // =====================================================================================
  describe('Declarative Attestations (e.g., Security)', () => {
    let wasmId: string;
    let bountyId: bigint;
    const wasmHash = new Uint8Array([1, 2, 3, 4]);
    const reputationTokenId = 'security_v1';
    const reputationStakeAmount = 100n;

    beforeEach(async () => {
      pic = await PocketIc.create(inject('PIC_URL'));

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

      const auditHubFixture = await pic.setupCanister<AuditHubService>({
        idlFactory: auditHubIdlFactory,
        wasm: AUDIT_HUB_WASM_PATH,
        sender: daoIdentity.getPrincipal(),
      });
      auditHubActor = auditHubFixture.actor;
      const registryFixture = await pic.setupCanister<RegistryService>({
        idlFactory: registryIdlFactory,
        wasm: REGISTRY_WASM_PATH,
        sender: daoIdentity.getPrincipal(),
        arg: IDL.encode(registryInit({ IDL }), [[]]),
      });
      registryActor = registryFixture.actor;
      registryCanisterId = registryFixture.canisterId;

      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        auditHubFixture.canisterId,
      );

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_stake_requirement(
        reputationTokenId,
        reputationStakeAmount,
      );
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

      wasmId = Buffer.from(wasmHash).toString('hex');
      registryActor.setIdentity(bountyCreatorIdentity);
      const createResult = await registryActor.icrc127_create_bounty({
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: reputationTokenId }],
          ],
        },
        timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
        start_date: [],
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        bounty_metadata: [
          ['icrc127:reward_canister', { Principal: ledgerCanisterId }],
          ['icrc127:reward_amount', { Nat: 10_0000n }],
        ],
      });
      bountyId = ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;

      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc118_create_canister_type([
        {
          canister_type_namespace: 'Test Server',
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
    });

    it('should ACCEPT an attestation from the auditor who correctly reserved the bounty', async () => {
      auditHubActor.setIdentity(auditorIdentity);
      await auditHubActor.reserve_bounty(bountyId, reputationTokenId);

      registryActor.setIdentity(auditorIdentity);
      const result = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: reputationTokenId }],
          ['bounty_id', { Nat: bountyId }],
        ],
      });
      expect(result).toHaveProperty('Ok');
    });
  });

  // =====================================================================================
  // == SUITE 2: Build Reproducibility Verification Lifecycle (Refactored)
  // =====================================================================================
  describe('Build Reproducibility Verification Lifecycle', () => {
    const wasmHash = new Uint8Array([10, 11, 12, 13]);
    const wasmId = Buffer.from(wasmHash).toString('hex');
    const buildReproTokenId = 'build_reproducibility_v1';
    const buildReproStakeAmount = 50n;
    let registryCanisterId: Principal;

    beforeEach(async () => {
      pic = await PocketIc.create(inject('PIC_URL'));
      const auditHubFixture = await pic.setupCanister<AuditHubService>({
        idlFactory: auditHubIdlFactory,
        wasm: AUDIT_HUB_WASM_PATH,
        sender: daoIdentity.getPrincipal(),
      });
      auditHubActor = auditHubFixture.actor;

      const registryFixture = await pic.setupCanister<RegistryService>({
        idlFactory: registryIdlFactory,
        wasm: REGISTRY_WASM_PATH,
        sender: daoIdentity.getPrincipal(),
        arg: IDL.encode(registryInit({ IDL }), [[]]),
      });
      registryActor = registryFixture.actor;
      registryCanisterId = registryFixture.canisterId;

      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        auditHubFixture.canisterId,
      );

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_stake_requirement(
        buildReproTokenId,
        buildReproStakeAmount,
      );
      await auditHubActor.mint_tokens(
        auditorIdentity.getPrincipal(),
        buildReproTokenId,
        100n,
      );
    });

    it('should NOT create a bounty when a verification request is submitted', async () => {
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });

      const bounties = await registryActor.get_bounties_for_wasm(wasmId);
      expect(bounties.length).toBe(0);
    });

    it('should automatically finalize as #Verified after a manual bounty is created and a successful attestation is submitted', async () => {
      // Step 1: Developer submits the claim (no bounty created)
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

      // Step 2: DAO manually creates the bounty to incentivize verification
      registryActor.setIdentity(daoIdentity);
      const createResult = await registryActor.icrc127_create_bounty({
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: buildReproTokenId }],
          ],
        },
        timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
        start_date: [],
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        bounty_metadata: [],
      });
      const bountyId =
        ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;

      // Step 3: Auditor reserves the bounty and submits a successful attestation
      auditHubActor.setIdentity(auditorIdentity);
      await auditHubActor.reserve_bounty(bountyId, buildReproTokenId);
      registryActor.setIdentity(auditorIdentity);
      await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: buildReproTokenId }],
          ['bounty_id', { Nat: bountyId }],
          ['status', { Text: 'success' }],
        ],
      });

      // Step 4: Assert the verification was automatically finalized
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);
    });

    it('should automatically finalize as #Rejected after a manual bounty is created and a divergence is reported', async () => {
      // Step 1: Developer submits the claim
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

      // Step 2: DAO manually creates the bounty
      registryActor.setIdentity(daoIdentity);
      const createResult = await registryActor.icrc127_create_bounty({
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: buildReproTokenId }],
          ],
        },
        timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
        start_date: [],
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        bounty_metadata: [],
      });
      const bountyId =
        ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;

      // Step 3: Auditor reserves the bounty and submits a divergence report
      auditHubActor.setIdentity(auditorIdentity);
      await auditHubActor.reserve_bounty(bountyId, buildReproTokenId);
      registryActor.setIdentity(auditorIdentity);
      const res = await registryActor.icrc126_file_divergence({
        wasm_id: wasmId,
        divergence_report: 'Build failed due to dependency mismatch.',
        metadata: [[['bounty_id', { Nat: bountyId }]]], // Note: opt is wrapped in an extra array
      });

      console.log('Divergence Report Result:', res);

      // Step 4: Assert the verification was automatically finalized as rejected
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);
      const logResult = await registryActor.icrc3_get_blocks([
        { start: 0n, length: 100n },
      ]);
      console.log('Log Result:', logResult.blocks[0].block);
      const rejectedBlock = logResult.blocks.find(
        (b) =>
          'Map' in b.block &&
          b.block.Map.find(
            ([k, v]) =>
              k === 'btype' && 'Text' in v && v.Text === '126rejected',
          ),
      );
      expect(rejectedBlock).toBeDefined();
    });

    it('should NOT list an app that has not been successfully verified', async () => {
      registryActor.setIdentity(daoIdentity);
      await registryActor.icrc118_create_canister_type([
        {
          canister_type_namespace: 'unverified-app',
          controllers: [],
          metadata: [],
          repo: '',
          canister_type_name: '',
          description: '',
          forked_from: [],
        },
      ]);
      await registryActor.icrc118_update_wasm({
        canister_type_namespace: 'unverified-app',
        previous: [],
        expected_chunks: [],
        metadata: [],
        repo: '',
        description: '',
        version_number: [0n, 1n, 0n],
        expected_hash: wasmHash,
      });

      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });

      const listings = await registryActor.get_app_listings({
        filter: [],
        take: [],
        prev: [],
      });
      expect('ok' in listings && listings.ok.length).toBe(0);
    });
  });
});
