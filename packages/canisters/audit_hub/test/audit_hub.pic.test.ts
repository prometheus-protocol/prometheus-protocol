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
  });

  // --- Suite 2: Bounty Locking & Staking Lifecycle ---
  describe('Bounty Locking & Staking Lifecycle', () => {
    const BOUNTY_ID = 'bounty-123';
    const TOKEN_ID = 'security_v1';
    const STAKE_AMOUNT = 50n;

    beforeEach(async () => {
      // Pre-fund the auditor for these tests
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
        100n,
      );
    });

    it('should allow an auditor to reserve a bounty, and update balances correctly', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      const res = await auditHubActor.reserve_bounty(
        BOUNTY_ID,
        TOKEN_ID,
        STAKE_AMOUNT,
      );
      expect(res).toHaveProperty('ok');

      // Check balances
      const available = await auditHubActor.get_available_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      const staked = await auditHubActor.get_staked_balance(
        auditor1Identity.getPrincipal(),
        TOKEN_ID,
      );
      expect(available).toBe(50n);
      expect(staked).toBe(50n);

      // Check lock status
      const lock = await auditHubActor.get_bounty_lock(BOUNTY_ID);
      expect(lock).not.toBeNull();
      // @ts-ignore
      expect(lock[0].claimant.toText()).toBe(
        auditor1Identity.getPrincipal().toText(),
      );
      // @ts-ignore
      expect(lock[0].stake_amount).toBe(STAKE_AMOUNT);
    });

    it('should REJECT reserving a bounty with insufficient available balance', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      const res = await auditHubActor.reserve_bounty(
        BOUNTY_ID,
        TOKEN_ID,
        200n, // More than the 100n they have
      );
      expect(res).toHaveProperty('err');
      // @ts-ignore
      expect(res.err).toMatch(/Insufficient available balance to stake./);
    });

    it('should REJECT reserving a bounty that is already locked', async () => {
      // Auditor 1 locks the bounty
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID, STAKE_AMOUNT);

      // Auditor 2 (also funded) tries to lock it
      auditHubActor.setIdentity(daoIdentity);
      await auditHubActor.mint_tokens(
        auditor2Identity.getPrincipal(),
        TOKEN_ID,
        100n,
      );
      auditHubActor.setIdentity(auditor2Identity);
      const res = await auditHubActor.reserve_bounty(
        BOUNTY_ID,
        TOKEN_ID,
        STAKE_AMOUNT,
      );
      expect(res).toHaveProperty('err');
      // @ts-ignore
      expect(res.err).toMatch(/Bounty is already locked./);
    });

    it('should correctly verify that a bounty is ready for collection by the claimant', async () => {
      auditHubActor.setIdentity(auditor1Identity);
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID, STAKE_AMOUNT);

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
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID, STAKE_AMOUNT);

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
      await auditHubActor.reserve_bounty(BOUNTY_ID, TOKEN_ID, STAKE_AMOUNT);

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
});
