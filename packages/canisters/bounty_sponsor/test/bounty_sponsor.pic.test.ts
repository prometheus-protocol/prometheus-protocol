// packages/canisters/bounty_sponsor/test/bounty_sponsor.pic.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { describe, it, expect, inject, beforeEach } from 'vitest';
import { IDL } from '@icp-sdk/core/candid';
import { Identity } from '@icp-sdk/core/agent';

// Import bounty_sponsor declarations (will be generated after first build)
import { idlFactory as bountySponsorIdlFactory } from '@declarations/bounty_sponsor';
import { type _SERVICE as BountySponsorService } from '@declarations/bounty_sponsor/bounty_sponsor.did.js';

// Import audit_hub declarations
import { idlFactory as auditHubIdlFactory } from '@declarations/audit_hub';
import { type _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did.js';

// Import ICRC-1 ledger IDL
import { idlFactory as ledgerIdlFactory } from '@declarations/icrc1_ledger';
import {
  init as ledgerInit,
  type _SERVICE as LedgerService,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';

const BOUNTY_SPONSOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/bounty_sponsor/bounty_sponsor.wasm',
);

const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);

const USDC_LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);

describe('Bounty Sponsor Canister', () => {
  let pic: PocketIc;
  let bountySponsorActor: Actor<BountySponsorService>;
  let auditHubActor: Actor<AuditHubService>;
  let usdcLedgerActor: Actor<LedgerService>;
  let bountySponsorCanisterId: Principal;
  let auditHubCanisterId: Principal;
  let usdcLedgerCanisterId: Principal;

  // Test identities
  const ownerIdentity: Identity = createIdentity('owner-principal');
  const sponsorIdentity: Identity = createIdentity('sponsor-principal');
  const randomUserIdentity: Identity = createIdentity('random-user-principal');

  const USDC_DECIMALS = 6;
  const USDC_FEE = 10_000n; // 0.01 USDC
  const toUSDC = (amount: number) => BigInt(amount * 10 ** USDC_DECIMALS);

  // Test WASM data
  const TEST_WASM_HASH = new Uint8Array(32).fill(1); // Mock hash
  const TEST_WASM_ID = 'test-wasm-id-123';
  const TEST_REPO = 'https://github.com/test/repo';
  const TEST_COMMIT_HASH = 'abc123def456';
  const TEST_BUILD_CONFIG: [string, any][] = [
    ['rust_version', { Text: '1.70.0' }],
    ['optimize_level', { Nat: 3 }],
  ];
  const TEST_REQUIRED_VERIFIERS = 5n;

  // Helper function to call sponsor_bounties_for_wasm with default test params
  const sponsorBounties = (
    actor: Actor<BountySponsorService>,
    auditTypes: string[],
    wasmId = TEST_WASM_ID,
    wasmHash = TEST_WASM_HASH,
  ) => {
    return actor.sponsor_bounties_for_wasm(
      wasmId,
      wasmHash,
      auditTypes,
      TEST_REPO,
      TEST_COMMIT_HASH,
      TEST_BUILD_CONFIG,
      TEST_REQUIRED_VERIFIERS,
    );
  };

  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // Deploy USDC ledger
    const ledgerFixture = await pic.setupCanister<LedgerService>({
      idlFactory: ledgerIdlFactory,
      wasm: USDC_LEDGER_WASM_PATH,
      sender: ownerIdentity.getPrincipal(),
      arg: IDL.encode(ledgerInit({ IDL }), [
        {
          Init: {
            minting_account: {
              owner: ownerIdentity.getPrincipal(),
              subaccount: [],
            },
            initial_balances: [],
            transfer_fee: USDC_FEE,
            token_name: 'USDC',
            token_symbol: 'USDC',
            metadata: [],
            archive_options: {
              num_blocks_to_archive: 1000n,
              trigger_threshold: 2000n,
              controller_id: ownerIdentity.getPrincipal(),
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
    usdcLedgerActor = ledgerFixture.actor;
    usdcLedgerCanisterId = ledgerFixture.canisterId;

    // Deploy audit_hub
    const auditHubFixture = await pic.setupCanister<AuditHubService>({
      idlFactory: auditHubIdlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: ownerIdentity.getPrincipal(),
    });
    auditHubActor = auditHubFixture.actor;
    auditHubCanisterId = auditHubFixture.canisterId;

    // Deploy bounty_sponsor
    const sponsorFixture = await pic.setupCanister<BountySponsorService>({
      idlFactory: bountySponsorIdlFactory,
      wasm: BOUNTY_SPONSOR_WASM_PATH,
      sender: ownerIdentity.getPrincipal(),
    });
    bountySponsorActor = sponsorFixture.actor;
    bountySponsorCanisterId = sponsorFixture.canisterId;

    // Configure bounty_sponsor
    bountySponsorActor.setIdentity(ownerIdentity);
    await bountySponsorActor.set_audit_hub_canister_id(auditHubCanisterId);
    await bountySponsorActor.set_reward_token_canister_id(usdcLedgerCanisterId);

    // Fund the bounty_sponsor canister with USDC
    usdcLedgerActor.setIdentity(ownerIdentity);
    await usdcLedgerActor.icrc1_transfer({
      to: { owner: bountySponsorCanisterId, subaccount: [] },
      amount: toUSDC(1000), // 1000 USDC for bounties
      fee: [],
      memo: [],
      from_subaccount: [],
      created_at_time: [],
    });
  });

  // --- Suite 1: Configuration Management ---
  describe('Configuration Management', () => {
    it('should allow owner to set audit_hub canister ID', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      const result = await bountySponsorActor.set_audit_hub_canister_id(
        Principal.fromText('aaaaa-aa'),
      );
      expect(result).toHaveProperty('ok');

      const envReq = await bountySponsorActor.get_env_requirements();
      const auditHubDep = envReq.v1.dependencies.find(
        (d) => d.canister_name === 'audit_hub',
      );
      expect(auditHubDep?.current_value[0]?.toText()).toBe('aaaaa-aa');
    });

    it('should reject audit_hub config from non-owner', async () => {
      bountySponsorActor.setIdentity(randomUserIdentity);
      const result = await bountySponsorActor.set_audit_hub_canister_id(
        Principal.fromText('aaaaa-aa'),
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Unauthorized/);
    });

    it('should allow owner to set reward token canister ID', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      const result = await bountySponsorActor.set_reward_token_canister_id(
        Principal.fromText('aaaaa-aa'),
      );
      expect(result).toHaveProperty('ok');

      const envReq = await bountySponsorActor.get_env_requirements();
      const tokenDep = envReq.v1.dependencies.find(
        (d) => d.canister_name === 'usdc_ledger',
      );
      expect(tokenDep?.current_value[0]?.toText()).toBe('aaaaa-aa');
    });

    it('should allow owner to set reward amounts for audit types', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);

      // Set different amounts for different audit types
      const result1 = await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );
      expect(result1).toHaveProperty('ok');

      const result2 = await bountySponsorActor.set_reward_amount_for_audit_type(
        'tools_v1',
        toUSDC(0.5),
      );
      expect(result2).toHaveProperty('ok');

      // Verify amounts
      const amount1 = await bountySponsorActor.get_reward_amount_for_audit_type(
        'build_reproducibility_v1',
      );
      expect(amount1[0]).toBe(toUSDC(0.25));

      const amount2 =
        await bountySponsorActor.get_reward_amount_for_audit_type('tools_v1');
      expect(amount2[0]).toBe(toUSDC(0.5));
    });

    it('should return complete config with all settings', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'tools_v1',
        toUSDC(0.5),
      );

      const envReq = await bountySponsorActor.get_env_requirements();
      expect(envReq.v1.dependencies.length).toBeGreaterThan(0);
      const auditHubDep = envReq.v1.dependencies.find(
        (d) => d.canister_name === 'audit_hub',
      );
      const tokenDep = envReq.v1.dependencies.find(
        (d) => d.canister_name === 'usdc_ledger',
      );
      expect(auditHubDep?.current_value.length).toBe(1);
      expect(tokenDep?.current_value.length).toBe(1);
    });

    it('should reject reward amount config from non-owner', async () => {
      bountySponsorActor.setIdentity(randomUserIdentity);
      const result = await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(1),
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Unauthorized/);
    });
  });

  // --- Suite 2: Ownership Management ---
  describe('Ownership Management', () => {
    it('should return current owner', async () => {
      const owner = await bountySponsorActor.get_owner();
      expect(owner.toText()).toBe(ownerIdentity.getPrincipal().toText());
    });

    it('should allow owner to transfer ownership', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      const result = await bountySponsorActor.transfer_ownership(
        sponsorIdentity.getPrincipal(),
      );
      expect(result).toHaveProperty('ok');

      const newOwner = await bountySponsorActor.get_owner();
      expect(newOwner.toText()).toBe(sponsorIdentity.getPrincipal().toText());
    });

    it('should reject ownership transfer from non-owner', async () => {
      bountySponsorActor.setIdentity(randomUserIdentity);
      const result = await bountySponsorActor.transfer_ownership(
        randomUserIdentity.getPrincipal(),
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Unauthorized/);
    });
  });

  // --- Suite 3: Bounty Sponsorship ---
  describe('Bounty Sponsorship', () => {
    beforeEach(async () => {
      // Set reward amounts
      bountySponsorActor.setIdentity(ownerIdentity);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'tools_v1',
        toUSDC(0.5),
      );
    });

    it('should sponsor bounties for single audit type', async () => {
      const result = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
      ]);

      if ('err' in result) {
        console.log('Sponsorship error:', result.err);
      }
      expect(result).toHaveProperty('ok');
      // @ts-ignore
      expect(result.ok.total_sponsored).toBe(9n); // 9 verifiers
      // @ts-ignore
      expect(result.ok.bounty_ids.length).toBe(9);
    });

    it('should sponsor bounties for multiple audit types', async () => {
      const result = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
        'tools_v1',
      ]);

      expect(result).toHaveProperty('ok');
      // @ts-ignore
      expect(result.ok.total_sponsored).toBe(18n); // 9 per type × 2 types
      // @ts-ignore
      expect(result.ok.bounty_ids.length).toBe(18);
    });

    it('should be idempotent - calling twice returns same bounty IDs', async () => {
      const result1 = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
      ]);

      const result2 = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
      ]);

      expect(result2).toHaveProperty('ok');
      // @ts-ignore
      expect(result2.ok.total_sponsored).toBe(0n); // No new bounties created
      // @ts-ignore
      expect(result2.ok.bounty_ids).toEqual(result1.ok.bounty_ids);
    });

    it('should sponsor additional audit types for existing WASM', async () => {
      // First sponsor build_reproducibility_v1
      const result1 = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
      ]);
      // @ts-ignore
      expect(result1.ok.total_sponsored).toBe(9n);

      // Then sponsor tools_v1
      const result2 = await sponsorBounties(bountySponsorActor, ['tools_v1']);
      // @ts-ignore
      expect(result2.ok.total_sponsored).toBe(9n); // Only new bounties
      // @ts-ignore
      expect(result2.ok.bounty_ids.length).toBe(9); // Only new bounty IDs returned

      // Verify total across both calls
      const allBounties =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(TEST_WASM_ID);
      expect(allBounties.length).toBe(18); // 9 + 9
    });

    it('should reject empty audit types array', async () => {
      const result = await bountySponsorActor.sponsor_bounties_for_wasm(
        TEST_WASM_ID,
        TEST_WASM_HASH,
        [],
        TEST_REPO,
        TEST_COMMIT_HASH,
        TEST_BUILD_CONFIG,
        TEST_REQUIRED_VERIFIERS,
      );

      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Must specify at least one audit type/);
    });

    it('should skip audit type without configured reward amount', async () => {
      const result = await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
        'unconfigured_audit_type',
      ]);

      expect(result).toHaveProperty('ok');
      // @ts-ignore
      expect(result.ok.total_sponsored).toBe(9n); // Only build_reproducibility_v1
    });

    it('should reject when audit_hub canister not configured', async () => {
      // Create new bounty_sponsor without audit_hub config
      const newSponsorFixture = await pic.setupCanister<BountySponsorService>({
        idlFactory: bountySponsorIdlFactory,
        wasm: BOUNTY_SPONSOR_WASM_PATH,
        sender: ownerIdentity.getPrincipal(),
      });
      const newSponsorActor = newSponsorFixture.actor;

      newSponsorActor.setIdentity(ownerIdentity);
      await newSponsorActor.set_reward_token_canister_id(usdcLedgerCanisterId);
      await newSponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );

      const result = await sponsorBounties(newSponsorActor, [
        'build_reproducibility_v1',
      ]);

      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Audit Hub canister ID not configured/);
    });

    it('should reject when reward token canister not configured', async () => {
      // Create new bounty_sponsor without reward token config
      const newSponsorFixture = await pic.setupCanister<BountySponsorService>({
        idlFactory: bountySponsorIdlFactory,
        wasm: BOUNTY_SPONSOR_WASM_PATH,
        sender: ownerIdentity.getPrincipal(),
      });
      const newSponsorActor = newSponsorFixture.actor;

      newSponsorActor.setIdentity(ownerIdentity);
      await newSponsorActor.set_audit_hub_canister_id(auditHubCanisterId);
      await newSponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );

      const result = await sponsorBounties(newSponsorActor, [
        'build_reproducibility_v1',
      ]);

      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Reward token canister ID not configured/);
    });
  });

  // --- Suite 4: Query Functions ---
  describe('Query Functions', () => {
    beforeEach(async () => {
      // Setup reward amounts and sponsor some bounties
      bountySponsorActor.setIdentity(ownerIdentity);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'tools_v1',
        toUSDC(0.5),
      );

      await sponsorBounties(bountySponsorActor, [
        'build_reproducibility_v1',
        'tools_v1',
      ]);
    });

    it('should return sponsored bounty IDs for WASM', async () => {
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(TEST_WASM_ID);
      expect(bountyIds.length).toBe(18); // 9 × 2 audit types
    });

    it('should return empty array for unsponsored WASM', async () => {
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(
          'non-existent-wasm',
        );
      expect(bountyIds.length).toBe(0);
    });

    it('should return sponsored audit types for WASM', async () => {
      const auditTypes =
        await bountySponsorActor.get_sponsored_audit_types_for_wasm(
          TEST_WASM_ID,
        );
      expect(auditTypes.length).toBe(2);
      expect(auditTypes).toContain('build_reproducibility_v1');
      expect(auditTypes).toContain('tools_v1');
    });

    it('should check if WASM is sponsored', async () => {
      const isSponsored =
        await bountySponsorActor.is_wasm_sponsored(TEST_WASM_ID);
      expect(isSponsored).toBe(true);

      const notSponsored =
        await bountySponsorActor.is_wasm_sponsored('non-existent-wasm');
      expect(notSponsored).toBe(false);
    });

    it('should return bounty info by bounty ID', async () => {
      const bountyIds =
        await bountySponsorActor.get_sponsored_bounties_for_wasm(TEST_WASM_ID);
      const firstBountyId = bountyIds[0];

      const info = await bountySponsorActor.get_bounty_info(firstBountyId);
      expect(info.length).toBe(1);
      // @ts-ignore
      expect(info[0].wasm_id).toBe(TEST_WASM_ID);
      // @ts-ignore
      expect(['build_reproducibility_v1', 'tools_v1']).toContain(
        info[0].audit_type,
      );
      // @ts-ignore
      expect(info[0].timestamp).toBeGreaterThan(0);
    });

    it('should return none for non-existent bounty ID', async () => {
      const info = await bountySponsorActor.get_bounty_info(9999n);
      expect(info.length).toBe(0);
    });

    it('should return total sponsored bounties count', async () => {
      const total = await bountySponsorActor.get_total_sponsored_bounties();
      expect(total).toBe(18n); // 9 × 2 audit types
    });
  });

  // --- Suite 5: Environment Requirements (Automated Config) ---
  describe('Environment Requirements', () => {
    it('should return environment requirements', async () => {
      const requirements = await bountySponsorActor.get_env_requirements();

      expect(requirements).toHaveProperty('v1');
      // @ts-ignore
      expect(requirements.v1.dependencies.length).toBe(3);

      // Check audit_hub dependency (used for bounty creation)
      // @ts-ignore
      const auditHubCreateDep = requirements.v1.dependencies.find(
        (d) =>
          d.canister_name === 'audit_hub' && d.key === '_audit_hub_canister_id',
      );
      expect(auditHubCreateDep).toBeDefined();
      expect(auditHubCreateDep.key).toBe('_audit_hub_canister_id');
      expect(auditHubCreateDep.setter).toBe('set_audit_hub_canister_id');
      expect(auditHubCreateDep.required).toBe(true);
    });
  });

  // --- Suite 6: USDC Balance Management ---
  describe('USDC Balance Management', () => {
    it('should have USDC balance for sponsoring bounties', async () => {
      const balance = await usdcLedgerActor.icrc1_balance_of({
        owner: bountySponsorCanisterId,
        subaccount: [],
      });
      expect(balance).toBe(toUSDC(1000)); // From beforeEach funding
    });

    it('should deduct USDC when sponsoring bounties', async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );

      const balanceBefore = await usdcLedgerActor.icrc1_balance_of({
        owner: bountySponsorCanisterId,
        subaccount: [],
      });

      await sponsorBounties(bountySponsorActor, ['build_reproducibility_v1']);

      const balanceAfter = await usdcLedgerActor.icrc1_balance_of({
        owner: bountySponsorCanisterId,
        subaccount: [],
      });

      // Should have spent 9 × $0.25 = $2.25 USDC (plus fees)
      const expectedSpent = toUSDC(0.25) * 9n; // 9 bounties
      expect(balanceBefore - balanceAfter).toBeGreaterThanOrEqual(
        expectedSpent,
      );
    });
  });

  // --- Suite 7: Multi-WASM Sponsorship ---
  describe('Multi-WASM Sponsorship', () => {
    const WASM_ID_1 = 'wasm-1';
    const WASM_ID_2 = 'wasm-2';
    const WASM_HASH_1 = new Uint8Array(32).fill(1);
    const WASM_HASH_2 = new Uint8Array(32).fill(2);

    beforeEach(async () => {
      bountySponsorActor.setIdentity(ownerIdentity);
      await bountySponsorActor.set_reward_amount_for_audit_type(
        'build_reproducibility_v1',
        toUSDC(0.25),
      );
    });

    it('should sponsor multiple WASMs independently', async () => {
      const result1 = await sponsorBounties(
        bountySponsorActor,
        ['build_reproducibility_v1'],
        WASM_ID_1,
        WASM_HASH_1,
      );
      // @ts-ignore
      expect(result1.ok.total_sponsored).toBe(9n);

      const result2 = await sponsorBounties(
        bountySponsorActor,
        ['build_reproducibility_v1'],
        WASM_ID_2,
        WASM_HASH_2,
      );
      // @ts-ignore
      expect(result2.ok.total_sponsored).toBe(9n);

      // Verify both are tracked
      const isSponsored1 =
        await bountySponsorActor.is_wasm_sponsored(WASM_ID_1);
      const isSponsored2 =
        await bountySponsorActor.is_wasm_sponsored(WASM_ID_2);
      expect(isSponsored1).toBe(true);
      expect(isSponsored2).toBe(true);

      const total = await bountySponsorActor.get_total_sponsored_bounties();
      expect(total).toBe(18n); // 9 per WASM
    });
  });
});
