import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, it, expect, afterAll, inject, beforeEach } from 'vitest';
import { IDL } from '@icp-sdk/core/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';

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
import { idlFactory as bountySponsorIdlFactory } from '@declarations/bounty_sponsor/bounty_sponsor.did.js';
import type { _SERVICE as BountySponsorService } from '@declarations/bounty_sponsor/bounty_sponsor.did';

// --- Wasm Paths ---
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
const BOUNTY_SPONSOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/bounty_sponsor/bounty_sponsor.wasm',
);

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const auditor1Identity: Identity = createIdentity('auditor-1');
const auditor2Identity: Identity = createIdentity('auditor-2');
const auditor3Identity: Identity = createIdentity('auditor-3');
const auditor4Identity: Identity = createIdentity('auditor-4');
const auditor5Identity: Identity = createIdentity('auditor-5');
const bountyCreatorIdentity: Identity = createIdentity('bounty-creator');

describe('MCP Registry ICRC-126 Integration', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let auditHubActor: Actor<AuditHubService>;
  let ledgerActor: Actor<LedgerService>;
  let bountySponsorActor: Actor<BountySponsorService>;
  let ledgerCanisterId: Principal;
  let registryCanisterId: Principal;
  let bountySponsorCanisterId: Principal;

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
    const reputationTokenId = 'data_safety_v1'; // Descriptive audit type
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
        ]).buffer,
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
        arg: IDL.encode(registryInit({ IDL }), [[]]).buffer,
      });
      registryActor = registryFixture.actor;
      registryCanisterId = registryFixture.canisterId;

      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        auditHubFixture.canisterId,
      );
      await registryActor.set_bounty_reward_token_canister_id(ledgerCanisterId);

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_stake_requirement(
        reputationTokenId, // audit_type
        ledgerCanisterId.toText(), // token_id is the ledger canister ID
        reputationStakeAmount,
      );
      await auditHubActor.set_registry_canister_id(registryCanisterId);

      // Set up bounty_sponsor canister
      const bountySponsorFixture =
        await pic.setupCanister<BountySponsorService>({
          idlFactory: bountySponsorIdlFactory,
          wasm: BOUNTY_SPONSOR_WASM_PATH,
          sender: daoIdentity.getPrincipal(),
        });
      bountySponsorActor = bountySponsorFixture.actor;
      bountySponsorCanisterId = bountySponsorFixture.canisterId;

      // Configure bounty_sponsor
      bountySponsorActor.setIdentity(daoIdentity);
      await bountySponsorActor.set_registry_canister_id(registryCanisterId);
      await bountySponsorActor.set_reward_token_canister_id(ledgerCanisterId);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        reputationTokenId,
        250_000n,
      ); // 0.25 USDC per bounty

      // Tell registry where bounty_sponsor is (so it can auto-trigger bounties)
      registryActor.setIdentity(daoIdentity);
      await registryActor.set_bounty_sponsor_canister_id(
        bountySponsorCanisterId,
      );

      // Fund bounty_sponsor with USDC for bounty creation
      ledgerActor.setIdentity(daoIdentity);
      await ledgerActor.icrc1_transfer({
        to: { owner: bountySponsorCanisterId, subaccount: [] },
        amount: 10_000_000n, // 10 USDC - enough for many bounties
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Transfer USDC to auditors and have them deposit stake
      // Transfer to auditor 1
      await ledgerActor.icrc1_transfer({
        to: { owner: auditor1Identity.getPrincipal(), subaccount: [] },
        amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });
      // Transfer to auditor 2
      await ledgerActor.icrc1_transfer({
        to: { owner: auditor2Identity.getPrincipal(), subaccount: [] },
        amount: 1_020_000n, // 1 USDC + approve fee + transfer fee
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });
      // Transfer to bounty creator
      await ledgerActor.icrc1_transfer({
        to: { owner: bountyCreatorIdentity.getPrincipal(), subaccount: [] },
        amount: 3_000_000n,
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Auditor 1: Approve and deposit stake
      ledgerActor.setIdentity(auditor1Identity);
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
      auditHubActor.setIdentity(auditor1Identity);
      const depositResult1 = await auditHubActor.deposit_stake(
        ledgerCanisterId.toText(),
        1_000_000n,
      );
      if ('err' in depositResult1) {
        throw new Error(`Deposit failed: ${depositResult1.err}`);
      }

      // Auditor 2: Approve and deposit stake
      ledgerActor.setIdentity(auditor2Identity);
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
      auditHubActor.setIdentity(auditor2Identity);
      await auditHubActor.deposit_stake(ledgerCanisterId.toText(), 1_000_000n);
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
      // Create bounty on AUDIT HUB (new architecture)
      auditHubActor.setIdentity(bountyCreatorIdentity);
      const createResult = await auditHubActor.icrc127_create_bounty({
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: reputationTokenId }], // metadata descriptive string
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
      auditHubActor.setIdentity(auditor1Identity);
      const reserveResult = await auditHubActor.reserve_bounty(
        bountyId,
        reputationTokenId, // audit_type
      );
      expect(reserveResult).toHaveProperty('ok');

      registryActor.setIdentity(auditor1Identity);
      const result = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [
          ['126:audit_type', { Text: reputationTokenId }], // metadata can be any descriptive string
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
    const buildReproTokenId = 'build_reproducibility_v1'; // metadata descriptor
    const buildReproStakeAmount = 50n;
    let registryCanisterId: Principal;
    let ledgerCanisterId: Principal; // ledger canister ID for token_id parameter

    beforeEach(async () => {
      pic = await PocketIc.create(inject('PIC_URL'));

      // Setup USDC ledger
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
              token_name: 'USDC',
              token_symbol: 'USDC',
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
        ]).buffer,
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
        arg: IDL.encode(registryInit({ IDL }), [[]]).buffer,
      });
      registryActor = registryFixture.actor;
      registryCanisterId = registryFixture.canisterId;

      registryActor.setIdentity(daoIdentity);
      await registryActor.set_auditor_credentials_canister_id(
        auditHubFixture.canisterId,
      );
      await registryActor.set_bounty_reward_token_canister_id(ledgerCanisterId);

      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_stake_requirement(
        buildReproTokenId, // audit_type is descriptive string
        ledgerCanisterId.toText(), // token_id is ledger canister ID
        buildReproStakeAmount,
      );
      await auditHubActor.set_registry_canister_id(registryCanisterId);

      // Set up bounty_sponsor canister
      const bountySponsorFixture =
        await pic.setupCanister<BountySponsorService>({
          idlFactory: bountySponsorIdlFactory,
          wasm: BOUNTY_SPONSOR_WASM_PATH,
          sender: daoIdentity.getPrincipal(),
        });
      bountySponsorActor = bountySponsorFixture.actor;
      bountySponsorCanisterId = bountySponsorFixture.canisterId;

      // Configure bounty_sponsor
      bountySponsorActor.setIdentity(daoIdentity);
      await bountySponsorActor.set_registry_canister_id(registryCanisterId);
      await bountySponsorActor.set_audit_hub_canister_id(
        auditHubFixture.canisterId,
      ); // NEW: Point to audit_hub for bounty creation
      await bountySponsorActor.set_reward_token_canister_id(ledgerCanisterId);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        buildReproTokenId,
        250_000n,
      ); // 0.25 USDC per bounty

      // Tell registry where bounty_sponsor is (so it can auto-trigger bounties)
      registryActor.setIdentity(daoIdentity);
      await registryActor.set_bounty_sponsor_canister_id(
        bountySponsorCanisterId,
      );

      // Fund bounty_sponsor with USDC for bounty creation
      ledgerActor.setIdentity(daoIdentity);
      await ledgerActor.icrc1_transfer({
        to: { owner: bountySponsorCanisterId, subaccount: [] },
        amount: 10_000_000n, // 10 USDC - enough for many bounties
        fee: [],
        memo: [],
        created_at_time: [],
        from_subaccount: [],
      });

      // Transfer USDC to all 5 auditors (need 1,020,000 each = 5,100,000 total)
      const auditors = [
        auditor1Identity,
        auditor2Identity,
        auditor3Identity,
        auditor4Identity,
        auditor5Identity,
      ];

      for (const auditor of auditors) {
        // Reset to DAO identity for transferring funds
        ledgerActor.setIdentity(daoIdentity);
        await ledgerActor.icrc1_transfer({
          to: { owner: auditor.getPrincipal(), subaccount: [] },
          amount: 1_020_000n,
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
        });

        // Each auditor approves and deposits stake
        ledgerActor.setIdentity(auditor);
        await ledgerActor.icrc2_approve({
          spender: { owner: auditHubFixture.canisterId, subaccount: [] },
          amount: 1_010_000n,
          fee: [],
          memo: [],
          created_at_time: [],
          from_subaccount: [],
          expected_allowance: [],
          expires_at: [],
        });

        auditHubActor.setIdentity(auditor);
        await auditHubActor.deposit_stake(
          ledgerCanisterId.toText(),
          1_000_000n,
        ); // use ledger canister ID
      }
    });

    it('should create 9 bounties via bounty_sponsor when sponsor_bounties_for_wasm is called', async () => {
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });

      // Manually trigger bounty creation via bounty_sponsor
      bountySponsorActor.setIdentity(daoIdentity);
      await bountySponsorActor.sponsor_bounties_for_wasm(
        wasmId,
        wasmHash,
        ['build_reproducibility_v1'],
        'https://github.com/test/repo',
        '01',
        [],
        9, // Create 9 bounties
      );

      // Bounties are now created by bounty_sponsor on audit_hub
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId);
      expect(bountyIds.length).toBe(9);
    });

    it('should finalize as #Verified after bounties are created and 5 successful attestations are submitted', async () => {
      // Step 1: Developer submits verification request
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

      // Step 1.5: Create bounties via bounty_sponsor
      bountySponsorActor.setIdentity(daoIdentity);
      await bountySponsorActor.sponsor_bounties_for_wasm(
        wasmId,
        wasmHash,
        ['build_reproducibility_v1'],
        'https://github.com/test/repo',
        '01',
        [],
        9,
      );

      // Step 2: Get the created bounties from bounty_sponsor
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId);
      expect(bountyIds.length).toBe(9);

      // Step 3: All 5 auditors reserve their bounties and submit divergence reports
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
          buildReproTokenId, // audit_type
        );

        registryActor.setIdentity(auditors[i]);
        await registryActor.icrc126_file_attestation({
          wasm_id: wasmId,
          metadata: [
            ['126:audit_type', { Text: buildReproTokenId }], // metadata can be descriptive string
            ['bounty_id', { Nat: bountyIds[i] }],
          ],
        });
      }

      // Step 4: Assert the verification was automatically finalized after 5 attestations
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(true);
    });

    it('should finalize as #Rejected after bounties are created and 5 divergence reports are submitted', async () => {
      // Step 1: Developer submits verification request
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHash,
        repo: 'https://github.com/test/repo',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);

      // Step 1.5: Create bounties via bounty_sponsor
      bountySponsorActor.setIdentity(daoIdentity);
      await bountySponsorActor.sponsor_bounties_for_wasm(
        wasmId,
        wasmHash,
        ['build_reproducibility_v1'],
        'https://github.com/test/repo',
        '01',
        [],
        9,
      );

      // Step 2: Get the created bounties from bounty_sponsor
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(wasmId);
      expect(bountyIds.length).toBe(9);

      // Step 3: All 5 auditors reserve their bounties and submit divergence reports
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
          buildReproTokenId, // audit_type
        );

        registryActor.setIdentity(auditors[i]);
        await registryActor.icrc126_file_divergence({
          wasm_id: wasmId,
          divergence_report: 'Build failed due to dependency mismatch.',
          metadata: [
            [
              ['126:audit_type', { Text: buildReproTokenId }],
              ['bounty_id', { Nat: bountyIds[i] }],
            ],
          ],
        });
      }

      // Step 4: Assert the verification was automatically finalized as rejected after 5 divergence reports
      expect(await registryActor.is_wasm_verified(wasmId)).toBe(false);
      const logResult = await registryActor.icrc3_get_blocks([
        { start: 0n, length: 100n },
      ]);
      const rejectedBlock = logResult.blocks.find(
        (b: any) =>
          'Map' in b.block &&
          b.block.Map.find(
            ([k, v]: [string, any]) =>
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
