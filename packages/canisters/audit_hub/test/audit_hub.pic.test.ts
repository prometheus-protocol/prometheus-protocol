// packages/canisters/audit_hub/test/audit_hub.pic.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { IDL } from '@dfinity/candid';
import { Identity } from '@dfinity/agent';

// Update these imports to match your new canister's declarations
import { idlFactory } from '@declarations/audit_hub';
import { type _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did.js';

// Update the Wasm path
const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);

describe('Audit Hub Canister', () => {
  let pic: PocketIc;
  let auditHubActor: Actor<AuditHubService>;

  // Define our actors for the tests
  const daoIdentity: Identity = createIdentity('dao-principal');
  const auditor1Identity: Identity = createIdentity('auditor-1-principal');
  const auditor2Identity: Identity = createIdentity('auditor-2-principal');
  const randomUserIdentity: Identity = createIdentity('random-user-principal');

  // Use beforeEach to ensure a clean state for each test
  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    const fixture = await pic.setupCanister<AuditHubService>({
      idlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    auditHubActor = fixture.actor;
  });

  // --- Suite 1: Core Token & Admin Functionality ---
  describe('Core Token & Admin Functionality', () => {
    it('should initially report zero balances for an auditor', async () => {
      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        'security_v1',
      );
      const staked = await auditHubActor.get_staked_balance(
        auditor1Identity.getPrincipal(),
        'security_v1',
      );
      expect(available).toBe(0n);
      expect(staked).toBe(0n);
    });

    it('should REJECT minting tokens from a non-DAO principal', async () => {
      auditHubActor.setIdentity(randomUserIdentity);
      const res = await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        100n,
      );
      expect(res).toHaveProperty('err');
      // @ts-ignore
      expect(res.err).toMatch(/Unauthorized: Only the owner can mint tokens./);
    });

    it('should allow the DAO to mint tokens and verify balances', async () => {
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        100n,
      );

      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        'security_v1',
      );
      expect(available).toBe(100n);

      // Verify another token type for the same auditor is still zero
      const quality_balance = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        'quality_v1',
      );
      expect(quality_balance).toBe(0n);
    });

    it('should allow the DAO to burn tokens', async () => {
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        100n,
      );
      expect(
        await auditHubActor.get_available_balance(
          auditor1Identity.getPrincipal(),
          'security_v1',
        ),
      ).toBe(100n);

      await auditHubActor.burn_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        40n,
      );
      expect(
        await auditHubActor.get_available_balance(
          auditor1Identity.getPrincipal(),
          'security_v1',
        ),
      ).toBe(60n);
    });

    it('should allow the owner to transfer ownership and verify new permissions', async () => {
      const newOwnerPrincipal = auditor1Identity.getPrincipal();

      // 1. Transfer Ownership as DAO
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.transfer_ownership(newOwnerPrincipal);
      const ownerAfterTransfer = await auditHubActor.get_owner();
      expect(ownerAfterTransfer.toText()).toEqual(newOwnerPrincipal.toText());

      // 2. OLD owner is now UNAUTHORIZED
      auditHubActor.setIdentity(daoIdentity);
      const resOldOwner = await auditHubActor.mint_tokens(
        randomUserIdentity.getPrincipal(),
        'test',
        1n,
      );
      expect(resOldOwner).toHaveProperty('err');

      // 3. NEW owner is now AUTHORIZED
      auditHubActor.setIdentity(auditor1Identity);
      const resNewOwner = await auditHubActor.mint_tokens(
        randomUserIdentity.getPrincipal(),
        'test',
        1n,
      );
      expect(resNewOwner).toHaveProperty('ok');
    });

    it('should allow the DAO to set and get stake requirements', async () => {
      auditHubActor.setIdentity(daoIdentity);
      const tokenId = 'security_v1';
      const stakeAmount = 100n;

      // Initially, it should be null
      const initialReq = await auditHubActor.get_stake_requirement(tokenId);
      expect(initialReq).toEqual([]); // PocketIC returns [] for empty opt

      // Set the requirement
      const setResult = await auditHubActor.set_stake_requirement(
        tokenId,
        stakeAmount,
      );
      expect(setResult).toHaveProperty('ok');

      // Verify it was set correctly
      const finalReq = await auditHubActor.get_stake_requirement(tokenId);
      expect(finalReq).toEqual([stakeAmount]);

      // Verify a non-owner cannot set it
      auditHubActor.setIdentity(randomUserIdentity);
      const unauthorizedResult = await auditHubActor.set_stake_requirement(
        tokenId,
        200n,
      );
      expect(unauthorizedResult).toHaveProperty('err');
    });
  });

  // --- Suite 2: Bounty Locking & Staking Lifecycle ---
  describe('Bounty Locking & Staking Lifecycle', () => {
    const BOUNTY_ID = 1n; // Using a fixed bounty ID for simplicity
    const TOKEN_ID = 'security_v1';
    const STAKE_AMOUNT = 50n; // This is now the configured requirement

    beforeEach(async () => {
      auditHubActor.setIdentity(daoIdentity);
      // CHANGE 1: The DAO must now configure the stake requirement
      await auditHubActor.set_stake_requirement(TOKEN_ID, STAKE_AMOUNT);

      // Pre-fund the auditor for these tests
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
        100n, // Give them more than enough
      );
    });

    it('should allow an auditor to reserve a bounty, and update balances correctly', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      // CHANGE 2: Call reserve_bounty without the stake amount
      const res = await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);
      expect(res).toHaveProperty('ok');

      // Assertions remain the same, using the STAKE_AMOUNT constant
      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const staked = await auditHubActor.get_staked_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      expect(available).toBe(50n); // 100n - 50n
      expect(staked).toBe(50n);

      const lock = await auditHubActor.get_bounty_lock(BOUNTY_ID);
      expect(lock).not.toEqual([]);
      // @ts-ignore
      expect(lock[0].stake_amount).toBe(STAKE_AMOUNT);
    });

    it('should REJECT reserving a bounty with insufficient available balance', async () => {
      // CHANGE 3: To test this, we now mint the auditor with LESS than the required stake
      const poorAuditor = createIdentity('poor-auditor');
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        poorAuditor.getPrincipal(),
        TOKEN_ID,
        STAKE_AMOUNT - 1n, // Mint 49 tokens
      );

      auditHubActor.setIdentity(poorAuditor);
      const res = await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);
      expect(res).toHaveProperty('err');
      // @ts-ignore
      expect(res.err).toMatch(/Insufficient available balance to stake./);
    });

    it('should REJECT reserving a bounty that is already locked', async () => {
      // Auditor 1 locks the bounty
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);

      // Auditor 2 (also funded) tries to lock it
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor2Identity.getPrincipal(),
        TOKEN_ID,
        100n,
      );
      auditHubActor.setIdentity(auditor2Identity);
      const res = await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);
      expect(res).toHaveProperty('err');
      // @ts-ignore
      expect(res.err).toMatch(/Bounty is already locked./);
    });

    it('should correctly verify that a bounty is ready for collection by the claimant', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);

      // Check for the correct claimant
      const isReadyForClaimant =
        await auditHubActor.is_bounty_ready_for_collection(
          BOUNTY_ID,
          auditor1Identity.getPrincipal(),
        );
      expect(isReadyForClaimant).toBe(true);

      // Check for a different, unauthorized user
      const isReadyForOther =
        await auditHubActor.is_bounty_ready_for_collection(
          BOUNTY_ID,
          auditor2Identity.getPrincipal(),
        );
      expect(isReadyForOther).toBe(false);
    });

    it('should allow the DAO to release a stake, returning funds to available balance', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);

      // Verify initial state
      expect(
        await auditHubActor.get_staked_balance(
          auditor1Identity.getPrincipal(),
          TOKEN_ID,
        ),
      ).toBe(50n);

      // Release the stake
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.release_stake(BOUNTY_ID);

      // Verify final state
      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const staked = await auditHubActor.get_staked_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const lock = await auditHubActor.get_bounty_lock(BOUNTY_ID);

      expect(available).toBe(100n);
      expect(staked).toBe(0n);
      expect(lock).toStrictEqual([]);
    });

    it('should slash an expired lock and burn the staked tokens', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID);

      // Advance time past the expiration (e.g., 4 days)
      await pic.advanceTime(4 * 24 * 60 * 60 * 1000); // 4 days in ms
      await pic.tick();

      // Verify the bounty is no longer ready for collection
      const isReady = await auditHubActor.is_bounty_ready_for_collection(
        BOUNTY_ID,
        auditor1Identity.getPrincipal(),
      );
      expect(isReady).toBe(false);

      // Anyone can clean up the expired lock
      auditHubActor.setIdentity(randomUserIdentity);
      const cleanupRes = await auditHubActor.cleanup_expired_lock(BOUNTY_ID);
      expect(cleanupRes).toHaveProperty('ok');

      // Verify the stake was slashed (burned)
      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const staked = await auditHubActor.get_staked_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const lock = await auditHubActor.get_bounty_lock(BOUNTY_ID);

      expect(available).toBe(50n); // Unstaked portion is untouched
      expect(staked).toBe(0n); // Staked portion is gone
      expect(lock).toStrictEqual([]); // Lock is removed
    });
  });

  // --- Suite 3: Auditor Profile Query ---
  describe('get_auditor_profile', () => {
    it('should return null for an auditor with no balances', async () => {
      const profile = await auditHubActor.get_auditor_profile(
        randomUserIdentity.getPrincipal(),
      );
      // For an empty `opt`, PocketIC returns an empty array
      expect(profile).toEqual({
        available_balances: [],
        staked_balances: [],
        reputation: [],
      });
    });

    it('should return a profile with only available balances and reputation', async () => {
      // Setup: Mint two different token types to the auditor
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        10n,
      );
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'tools_v1',
        5n,
      );

      // Action: Fetch the profile
      const profileResult = await auditHubActor.get_auditor_profile(
        auditor1Identity.getPrincipal(),
      );

      // Assertions
      expect(profileResult).not.toEqual([]); // Should not be null
      const profile = profileResult; // Unwrap the opt record

      // Helper to sort arrays for consistent comparison, as map order is not guaranteed
      const sortByName = (a: (string | bigint)[], b: (string | bigint)[]) => {
        if (
          a.length === 2 &&
          b.length === 2 &&
          typeof a[0] === 'string' &&
          typeof b[0] === 'string'
        ) {
          return (a[0] as string).localeCompare(b[0] as string);
        }
        return 0;
      };

      const expectedBalances = [
        ['security_v1', 10n],
        ['tools_v1', 5n],
      ].sort(sortByName);

      expect(profile?.available_balances.sort(sortByName)).toEqual(
        expectedBalances,
      );
      expect(profile?.reputation.sort(sortByName)).toEqual(expectedBalances);
      expect(profile?.staked_balances).toEqual([]); // Should be an empty array
    });

    it('should return a complete profile with available, staked, and reputation balances', async () => {
      // Setup: Configure stake requirements and mint various tokens
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.set_stake_requirement('security_v1', 10n);
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'security_v1',
        25n, // Will have 15n left after staking
      );
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        'tools_v1',
        5n, // Will remain fully available
      );

      // Action 1: Auditor stakes some tokens
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(1n, 'security_v1');

      // Action 2: Fetch the profile
      const profileResult = await auditHubActor.get_auditor_profile(
        auditor1Identity.getPrincipal(),
      );
      const profile = profileResult;

      // Assertions
      const sortByName = (a: (string | bigint)[], b: (string | bigint)[]) => {
        if (
          a.length === 2 &&
          b.length === 2 &&
          typeof a[0] === 'string' &&
          typeof b[0] === 'string'
        ) {
          return (a[0] as string).localeCompare(b[0] as string);
        }
        return 0;
      };

      const expectedAvailable = [
        ['security_v1', 15n],
        ['tools_v1', 5n],
      ].sort(sortByName);

      const expectedStaked = [['security_v1', 10n]].sort(sortByName);

      expect(profile?.available_balances.sort(sortByName)).toEqual(
        expectedAvailable,
      );
      expect(profile?.reputation.sort(sortByName)).toEqual(expectedAvailable);
      expect(profile?.staked_balances.sort(sortByName)).toEqual(expectedStaked);
    });
  });
});
