// packages/canisters/audit_hub/test/audit_hub.pic.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { IDL } from '@icp-sdk/core/candid';
import { Identity } from '@icp-sdk/core/agent';

// Import audit_hub declarations
import { idlFactory } from '@declarations/audit_hub';
import { type _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did.js';

// Import registry declarations
import { idlFactory as registryIdlFactory } from '@declarations/mcp_registry';
import {
  init as registryInit,
  type _SERVICE as RegistryService,
} from '@declarations/mcp_registry/mcp_registry.did.js';

// Import ICRC-2 ledger IDL
import { idlFactory as ledgerIdlFactory } from '@declarations/icrc1_ledger';
import {
  init as ledgerInit,
  type _SERVICE as LedgerService,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';

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

const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm.gz',
);

describe('Audit Hub Canister - USDC Staking System', () => {
  let pic: PocketIc;
  let auditHubActor: Actor<AuditHubService>;
  let usdcLedgerActor: Actor<LedgerService>;
  let registryActor: Actor<RegistryService>;
  let auditHubCanisterId: Principal;
  let usdcLedgerCanisterId: Principal;
  let registryCanisterId: Principal;

  // Test identities
  const ownerIdentity: Identity = createIdentity('owner-principal');
  const verifier1Identity: Identity = createIdentity('verifier-1-principal');
  const verifier2Identity: Identity = createIdentity('verifier-2-principal');
  const randomUserIdentity: Identity = createIdentity('random-user-principal');
  const mockRegistryIdentity: Identity = createIdentity(
    'mock-registry-principal',
  );

  const USDC_DECIMALS = 6;
  const USDC_FEE = 10_000n; // 0.01 USDC
  const toUSDC = (amount: number) => BigInt(amount * 10 ** USDC_DECIMALS);

  // Helper function to create a bounty for testing
  const createTestBounty = async (auditType: string): Promise<bigint> => {
    // Fund randomUser with USDC to create bounties
    usdcLedgerActor.setIdentity(ownerIdentity);
    await usdcLedgerActor.icrc1_transfer({
      to: { owner: randomUserIdentity.getPrincipal(), subaccount: [] },
      amount: toUSDC(10) + 20_000n, // Amount for bounty + fees
      fee: [],
      memo: [],
      from_subaccount: [],
      created_at_time: [],
    });

    // Approve audit_hub to spend tokens for bounty creation
    usdcLedgerActor.setIdentity(randomUserIdentity);
    await usdcLedgerActor.icrc2_approve({
      spender: { owner: auditHubCanisterId, subaccount: [] },
      amount: toUSDC(2) + 10_000n, // Bounty reward + fees
      fee: [],
      memo: [],
      from_subaccount: [],
      created_at_time: [],
      expected_allowance: [],
      expires_at: [],
    });

    // Create the bounty
    auditHubActor.setIdentity(randomUserIdentity);
    const createResult = await auditHubActor.icrc127_create_bounty({
      challenge_parameters: { Map: [['audit_type', { Text: auditType }]] },
      timeout_date: BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000) * 1_000_000n,
      start_date: [],
      bounty_id: [],
      validation_canister_id: auditHubCanisterId,
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: usdcLedgerCanisterId }],
        ['icrc127:reward_amount', { Nat: toUSDC(1) }],
      ],
    });

    if ('Error' in createResult) {
      throw new Error(
        `Failed to create bounty: ${JSON.stringify(createResult.Error)}`,
      );
    }

    // @ts-ignore
    return createResult.Ok.bounty_id;
  };

  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // Deploy USDC ledger first
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
      ]),
    });
    usdcLedgerActor = ledgerFixture.actor;
    usdcLedgerCanisterId = ledgerFixture.canisterId;

    // Deploy registry (still needed for authorization, but NOT for ICRC127 bounties)
    // The audit_hub uses registry_canister_id to authorize certain operations like stake release
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: ownerIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]).buffer,
    });
    registryActor = registryFixture.actor;
    registryCanisterId = registryFixture.canisterId;

    // Deploy audit_hub
    const auditFixture = await pic.setupCanister<AuditHubService>({
      idlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: ownerIdentity.getPrincipal(),
    });
    auditHubActor = auditFixture.actor;
    auditHubCanisterId = auditFixture.canisterId;

    // Configure audit_hub with USDC ledger
    auditHubActor.setIdentity(ownerIdentity);

    // Set registry canister ID (needed for API key operations and stake release/slash authorization)
    // Note: The registry is NO LONGER used for ICRC127 bounty creation - that's now done locally
    await auditHubActor.set_registry_canister_id(registryCanisterId);

    // Set stake requirement for build verification
    await auditHubActor.set_stake_requirement(
      'build_v1',
      usdcLedgerCanisterId.toText(),
      toUSDC(1),
    ); // $1 USDC stake
  });

  // --- Suite 1: Stake Configuration ---
  describe('Stake Configuration', () => {
    it('should allow owner to set stake requirement', async () => {
      auditHubActor.setIdentity(ownerIdentity);
      const result = await auditHubActor.set_stake_requirement(
        'test_audit',
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );
      expect(result).toHaveProperty('ok');

      const requirement =
        await auditHubActor.get_stake_requirement('test_audit');
      expect(requirement).toBeDefined();
      // get_stake_requirement returns [[token_id, amount]] (opt record)
      expect(requirement![0][0]).toBe(usdcLedgerCanisterId.toText());
      expect(requirement![0][1]).toBe(toUSDC(5));
    });

    it('should reject stake requirement from non-owner', async () => {
      auditHubActor.setIdentity(randomUserIdentity);
      const result = await auditHubActor.set_stake_requirement(
        'hack_audit',
        usdcLedgerCanisterId.toText(),
        toUSDC(10),
      );
      expect(result).toHaveProperty('err');
    });
  });

  // --- Suite 2: API Key Management ---
  describe('API Key Management', () => {
    it('should allow verifier to generate API key', async () => {
      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.generate_api_key();
      expect(result).toHaveProperty('ok');
      // @ts-ignore
      expect(result.ok).toMatch(/^vr_/); // Should start with vr_ prefix
    });

    it('should allow verifier to list their API keys', async () => {
      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.generate_api_key();
      await auditHubActor.generate_api_key();

      const keys = await auditHubActor.list_api_keys();
      expect(keys.length).toBe(2);
      expect(keys[0].is_active).toBe(true);
    });

    it('should allow verifier to revoke API key', async () => {
      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.generate_api_key();
      // @ts-ignore
      const apiKey = result.ok;

      const revokeResult = await auditHubActor.revoke_api_key(apiKey);
      expect(revokeResult).toHaveProperty('ok');

      // Validation should fail for revoked key
      const validateResult = await auditHubActor.validate_api_key(apiKey);
      expect(validateResult).toHaveProperty('err');
    });

    it('should reject revoking another verifiers API key', async () => {
      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.generate_api_key();
      // @ts-ignore
      const apiKey = result.ok;

      auditHubActor.setIdentity(verifier2Identity);
      const revokeResult = await auditHubActor.revoke_api_key(apiKey);
      expect(revokeResult).toHaveProperty('err');
    });
  });

  // --- Suite 3: USDC Deposit & Withdrawal (ICRC-2) ---
  describe('USDC Deposit & Withdrawal', () => {
    beforeEach(async () => {
      // Mint USDC to verifier1 for testing
      usdcLedgerActor.setIdentity(ownerIdentity);
      await usdcLedgerActor.icrc1_transfer({
        to: { owner: verifier1Identity.getPrincipal(), subaccount: [] },
        amount: toUSDC(10) + 20_000n, // Amount + approve fee + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });
    });

    it('should allow verifier to deposit USDC after approval', async () => {
      // Step 1: Approve audit_hub to spend USDC
      usdcLedgerActor.setIdentity(verifier1Identity);
      await usdcLedgerActor.icrc2_approve({
        spender: { owner: auditHubCanisterId, subaccount: [] },
        amount: toUSDC(5) + 10_000n, // Amount + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      });

      // Step 2: Deposit USDC
      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.deposit_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );
      expect(result).toHaveProperty('ok');

      // Step 3: Verify balance
      const balance = await auditHubActor.get_available_balance_by_audit_type(
        verifier1Identity.getPrincipal(),
        'build_v1',
      );
      expect(balance).toBe(toUSDC(5));
    });

    it('should allow verifier to withdraw available USDC', async () => {
      // Setup: Deposit USDC first
      usdcLedgerActor.setIdentity(verifier1Identity);
      await usdcLedgerActor.icrc2_approve({
        spender: { owner: auditHubCanisterId, subaccount: [] },
        amount: toUSDC(5) + 10_000n, // Amount + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      });

      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.deposit_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );

      // Withdraw 2 USDC
      const withdrawResult = await auditHubActor.withdraw_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(2),
      );
      expect(withdrawResult).toHaveProperty('ok');

      // Verify balances (3 USDC minus the transfer fee for withdrawal)
      const balance = await auditHubActor.get_available_balance_by_audit_type(
        verifier1Identity.getPrincipal(),
        'build_v1',
      );
      expect(balance).toBe(toUSDC(3) - USDC_FEE);
    });

    it('should reject withdrawal of more than available balance', async () => {
      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.withdraw_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(100),
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Insufficient available balance/);
    });
  });

  // --- Suite 4: Bounty Reservation with USDC Staking ---
  describe('Bounty Reservation & Staking', () => {
    const AUDIT_TYPE = 'build_v1';
    let TOKEN_ID: string; // Ledger canister ID

    beforeEach(async () => {
      TOKEN_ID = usdcLedgerCanisterId.toText();

      // Set stake requirement for this audit type
      auditHubActor.setIdentity(ownerIdentity);
      await auditHubActor.set_stake_requirement(
        AUDIT_TYPE,
        usdcLedgerCanisterId.toText(),
        toUSDC(1),
      );

      // Fund verifier1 with USDC
      usdcLedgerActor.setIdentity(ownerIdentity);
      await usdcLedgerActor.icrc1_transfer({
        to: { owner: verifier1Identity.getPrincipal(), subaccount: [] },
        amount: toUSDC(10) + 20_000n, // Amount + approve fee + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      // Deposit into audit_hub
      usdcLedgerActor.setIdentity(verifier1Identity);
      await usdcLedgerActor.icrc2_approve({
        spender: { owner: auditHubCanisterId, subaccount: [] },
        amount: toUSDC(5) + 10_000n, // Amount + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      });

      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.deposit_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );
    });

    it('should allow verifier to reserve bounty with sufficient balance', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      auditHubActor.setIdentity(verifier1Identity);
      const result = await auditHubActor.reserve_bounty(BOUNTY_ID, AUDIT_TYPE);
      expect(result).toHaveProperty('ok');

      // Verify balances updated
      const availableBalance =
        await auditHubActor.get_available_balance_by_audit_type(
          verifier1Identity.getPrincipal(),
          'build_v1',
        );
      const stakedBalance = await auditHubActor.get_staked_balance(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(availableBalance).toBe(toUSDC(4)); // 5 - 1 stake
      expect(stakedBalance).toBe(toUSDC(1));
    });

    it('should reject reserve_bounty_with_api_key with invalid API key', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      const result = await auditHubActor.reserve_bounty_with_api_key(
        'invalid-api-key-12345',
        BOUNTY_ID,
        AUDIT_TYPE,
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Invalid API key/);
    });

    it('should reject reserve_bounty_with_api_key with revoked API key', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      // Generate and then revoke an API key
      auditHubActor.setIdentity(verifier1Identity);
      const keyResult = await auditHubActor.generate_api_key();
      // @ts-ignore
      const apiKey = keyResult.ok;
      await auditHubActor.revoke_api_key(apiKey);

      // Try to use the revoked key
      const result = await auditHubActor.reserve_bounty_with_api_key(
        apiKey,
        BOUNTY_ID,
        AUDIT_TYPE,
      );
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/revoked/);
    });

    it('should reject reserving bounty with insufficient balance', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      auditHubActor.setIdentity(verifier2Identity); // Has no balance
      const result = await auditHubActor.reserve_bounty(BOUNTY_ID, AUDIT_TYPE);
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/Insufficient available balance/);
    });

    it('should reject reserving already locked bounty', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, AUDIT_TYPE);

      // Try to reserve same bounty again
      const result = await auditHubActor.reserve_bounty(BOUNTY_ID, AUDIT_TYPE);
      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toMatch(/already locked/);
    });

    it('should allow verifier to submit bounty claim after reservation', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      // Reserve the bounty
      auditHubActor.setIdentity(verifier1Identity);
      const reserveResult = await auditHubActor.reserve_bounty(
        BOUNTY_ID,
        AUDIT_TYPE,
      );
      expect(reserveResult).toHaveProperty('ok');

      // Submit the bounty claim
      const submitResult = await auditHubActor.icrc127_submit_bounty({
        bounty_id: BOUNTY_ID,
        submission: { Text: 'Completed verification' },
        account: [], // Payout to self
      });

      expect(submitResult).toHaveProperty('Ok');
      // @ts-ignore
      expect(submitResult.Ok.result.length).toBeGreaterThan(0);
    });

    it('should reject bounty submission without reservation', async () => {
      const BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      // Try to submit without reserving first
      auditHubActor.setIdentity(verifier1Identity);
      const submitResult = await auditHubActor.icrc127_submit_bounty({
        bounty_id: BOUNTY_ID,
        submission: { Text: 'Completed verification' },
        account: [],
      });

      // Submission succeeds but validation should fail
      expect(submitResult).toHaveProperty('Ok');
      // @ts-ignore
      expect(submitResult.Ok.result[0].result).toHaveProperty('Invalid');
      // @ts-ignore
      expect(submitResult.Ok.result[0].metadata.Map).toContainEqual([
        'error',
        { Text: 'bounty not reserved' },
      ]);
    });
  });

  // --- Suite 5: Stake Release & Earnings Tracking ---
  describe('Stake Release & Earnings', () => {
    const AUDIT_TYPE = 'build_v1';
    let TOKEN_ID: string;
    let BOUNTY_ID: bigint;

    beforeEach(async () => {
      TOKEN_ID = usdcLedgerCanisterId.toText();

      // Set stake requirement for this audit type
      auditHubActor.setIdentity(ownerIdentity);
      await auditHubActor.set_stake_requirement(
        AUDIT_TYPE,
        usdcLedgerCanisterId.toText(),
        toUSDC(1),
      );

      // Setup: Fund and deposit for verifier1
      usdcLedgerActor.setIdentity(ownerIdentity);
      await usdcLedgerActor.icrc1_transfer({
        to: { owner: verifier1Identity.getPrincipal(), subaccount: [] },
        amount: toUSDC(10) + 20_000n, // Amount + approve fee + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      usdcLedgerActor.setIdentity(verifier1Identity);
      await usdcLedgerActor.icrc2_approve({
        spender: { owner: auditHubCanisterId, subaccount: [] },
        amount: toUSDC(5) + 10_000n, // Amount + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      });

      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.deposit_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );

      // Create a bounty using the test helper
      BOUNTY_ID = await createTestBounty(AUDIT_TYPE);

      // Reserve the bounty
      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, AUDIT_TYPE);
    });

    it('should release stake and track earnings after successful verification', async () => {
      // Owner (or registry) can release stake after verification
      auditHubActor.setIdentity(ownerIdentity);
      const result = await auditHubActor.release_stake(BOUNTY_ID);
      if ('err' in result) {
        console.log('release_stake error:', result.err);
      }
      expect(result).toHaveProperty('ok');

      // Verify balance returned
      const profile = await auditHubActor.get_verifier_profile(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      const availableBalance =
        await auditHubActor.get_available_balance_by_audit_type(
          verifier1Identity.getPrincipal(),
          'build_v1',
        );
      const stakedBalance = await auditHubActor.get_staked_balance(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(availableBalance).toBe(toUSDC(5));
      expect(stakedBalance).toBe(0n);
      expect(profile.total_earnings).toBe(toUSDC(1)); // Earned the stake amount
      expect(profile.total_verifications).toBe(1n);
    });

    it('should slash stake for incorrect consensus', async () => {
      // Owner (or registry) can slash stake for incorrect consensus
      auditHubActor.setIdentity(ownerIdentity);
      const result =
        await auditHubActor.slash_stake_for_incorrect_consensus(BOUNTY_ID);
      if ('err' in result) {
        console.log('slash_stake error:', result.err);
      }
      expect(result).toHaveProperty('ok');

      // Verify stake was slashed (burned)
      const profile = await auditHubActor.get_verifier_profile(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      const availableBalance =
        await auditHubActor.get_available_balance_by_audit_type(
          verifier1Identity.getPrincipal(),
          'build_v1',
        );
      const stakedBalance = await auditHubActor.get_staked_balance(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(availableBalance).toBe(toUSDC(4)); // Original 5 - 1 staked
      expect(stakedBalance).toBe(0n); // Slashed
      expect(profile.total_earnings).toBe(0n); // No earnings
      expect(profile.reputation_score).toBeLessThan(100); // Penalized
    });

    it('should slash stake for expired lock', async () => {
      // Advance time past expiration (1 hour)
      await pic.advanceTime(2 * 60 * 60 * 1000); // 2 hours in ms
      await pic.tick();

      // Anyone can cleanup expired lock
      auditHubActor.setIdentity(randomUserIdentity);
      const result = await auditHubActor.cleanup_expired_lock(BOUNTY_ID);
      expect(result).toHaveProperty('ok');

      // Verify stake was slashed
      const profile = await auditHubActor.get_verifier_profile(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      const stakedBalance = await auditHubActor.get_staked_balance(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(stakedBalance).toBe(0n);
      expect(profile.reputation_score).toBeLessThan(100);
    });
  });

  // --- Suite 6: Verifier Profile Query ---
  describe('Verifier Profile', () => {
    it('should return profile with zero balances for new verifier', async () => {
      const profile = await auditHubActor.get_verifier_profile(
        randomUserIdentity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      const availableBalance =
        await auditHubActor.get_available_balance_by_audit_type(
          randomUserIdentity.getPrincipal(),
          'build_v1',
        );
      const stakedBalance = await auditHubActor.get_staked_balance(
        randomUserIdentity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(availableBalance).toBe(0n);
      expect(stakedBalance).toBe(0n);
      expect(profile.total_verifications).toBe(0n);
      expect(profile.reputation_score).toBe(100n); // Default perfect score
      expect(profile.total_earnings).toBe(0n);
    });

    it('should return complete profile with all statistics', async () => {
      // Setup: Fund, deposit, and complete a verification
      usdcLedgerActor.setIdentity(ownerIdentity);
      await usdcLedgerActor.icrc1_transfer({
        to: { owner: verifier1Identity.getPrincipal(), subaccount: [] },
        amount: toUSDC(10) + 20_000n, // Amount + approve fee + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
      });

      usdcLedgerActor.setIdentity(verifier1Identity);
      await usdcLedgerActor.icrc2_approve({
        spender: { owner: auditHubCanisterId, subaccount: [] },
        amount: toUSDC(5) + 10_000n, // Amount + transfer fee
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      });

      auditHubActor.setIdentity(verifier1Identity);
      await auditHubActor.deposit_stake(
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );
      await auditHubActor.reserve_bounty(1n, 'build_v1');

      // Note: release_stake can only be called by registry in production
      // For this test, we'll skip the release and verify the pre-release state
      // The balance is 4 USDC (5 deposited - 1 staked)

      // Check complete profile
      const profile = await auditHubActor.get_verifier_profile(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      const availableBalance =
        await auditHubActor.get_available_balance_by_audit_type(
          verifier1Identity.getPrincipal(),
          'build_v1',
        );
      const stakedBalance = await auditHubActor.get_staked_balance(
        verifier1Identity.getPrincipal(),
        usdcLedgerCanisterId.toText(),
      );
      expect(availableBalance).toBe(toUSDC(4)); // 5 - 1 staked
      expect(stakedBalance).toBe(toUSDC(1));
      expect(profile.total_verifications).toBe(0n); // No verifications completed yet
      expect(profile.total_earnings).toBe(0n); // No earnings yet
      expect(profile.reputation_score).toBe(100n); // Reputation system maintains score at 100
    });
  });

  // --- Suite 7: Admin Functions ---
  describe('Admin Functions', () => {
    it('should allow owner to set stake requirement', async () => {
      auditHubActor.setIdentity(ownerIdentity);
      const result = await auditHubActor.set_stake_requirement(
        'build_v1',
        usdcLedgerCanisterId.toText(),
        toUSDC(5),
      );
      expect(result).toHaveProperty('ok');

      const requirement = await auditHubActor.get_stake_requirement('build_v1');
      expect(requirement).not.toEqual([]);
      // requirement is [[token_id, amount]] (opt record)
      expect(requirement![0][0]).toBe(usdcLedgerCanisterId.toText());
      expect(requirement![0][1]).toBe(toUSDC(5));
    });

    it('should allow owner to transfer ownership', async () => {
      auditHubActor.setIdentity(ownerIdentity);
      const result = await auditHubActor.set_owner(
        verifier1Identity.getPrincipal(),
      );
      expect(result).toHaveProperty('ok');

      const newOwner = await auditHubActor.get_owner();
      expect(newOwner.toText()).toBe(verifier1Identity.getPrincipal().toText());
    });

    it('should reject admin functions from non-owner', async () => {
      auditHubActor.setIdentity(randomUserIdentity);
      const result = await auditHubActor.set_stake_requirement(
        'unauthorized_audit',
        usdcLedgerCanisterId.toText(),
        toUSDC(10),
      );
      expect(result).toHaveProperty('err');
    });
  });
});
