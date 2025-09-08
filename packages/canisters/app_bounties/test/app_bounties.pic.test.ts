import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeEach, it, expect, inject } from 'vitest';
import { Identity } from '@dfinity/agent';

// --- 1. Update imports for the AppBounty canister ---
import { idlFactory } from '@declarations/app_bounties';
import {
  type _SERVICE as AppBountyService,
  type Bounty,
} from '@declarations/app_bounties/app_bounties.did.js';

// --- 2. Update the Wasm path ---
const APP_BOUNTY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/app_bounties/app_bounties.wasm',
);

describe('App Bounty Canister', () => {
  let pic: PocketIc;
  let appBountyActor: Actor<AppBountyService>;

  // --- 3. Define identities for testing permissions ---
  const ownerIdentity: Identity = createIdentity('owner-principal');
  const randomUserIdentity: Identity = createIdentity('random-user-principal');

  // Use beforeEach to ensure a clean state for each test
  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    const fixture = await pic.setupCanister<AppBountyService>({
      idlFactory,
      wasm: APP_BOUNTY_WASM_PATH,
      sender: ownerIdentity.getPrincipal(), // Deploy the canister as the owner
    });
    appBountyActor = fixture.actor;
  });

  // --- Suite 1: Admin & Ownership ---
  describe('Admin & Ownership', () => {
    it('should correctly set the initial owner on deployment', async () => {
      const owner = await appBountyActor.get_owner();
      expect(owner.toText()).toEqual(ownerIdentity.getPrincipal().toText());
    });

    it('should allow the owner to transfer ownership and verify new permissions', async () => {
      const newOwnerPrincipal = randomUserIdentity.getPrincipal();

      // 1. Transfer Ownership as the current owner
      appBountyActor.setIdentity(ownerIdentity);
      const transferResult =
        await appBountyActor.transfer_ownership(newOwnerPrincipal);
      expect(transferResult).toHaveProperty('ok');

      const ownerAfterTransfer = await appBountyActor.get_owner();
      expect(ownerAfterTransfer.toText()).toEqual(newOwnerPrincipal.toText());

      // 2. Verify the OLD owner is now UNAUTHORIZED
      appBountyActor.setIdentity(ownerIdentity);
      const resOldOwner = await appBountyActor.create_bounty(
        'Test',
        'Test',
        1.0,
        'ICP',
        'Open',
        '# Test',
      );
      expect(resOldOwner).toHaveProperty('err');
      // @ts-ignore
      expect(resOldOwner.err).toMatch(
        /Unauthorized: Only the owner can create bounties./,
      );

      // 3. Verify the NEW owner is now AUTHORIZED
      appBountyActor.setIdentity(randomUserIdentity);
      const resNewOwner = await appBountyActor.create_bounty(
        'Test',
        'Test',
        1.0,
        'ICP',
        'Open',
        '# Test',
      );
      expect(resNewOwner).toHaveProperty('ok');
    });

    it('should REJECT admin actions from a non-owner principal', async () => {
      appBountyActor.setIdentity(randomUserIdentity);

      const createRes = await appBountyActor.create_bounty(
        'Test',
        'Test',
        1.0,
        'ICP',
        'Open',
        '# Test',
      );
      expect(createRes).toHaveProperty('err');

      const updateRes = await appBountyActor.update_bounty(
        0n,
        'Test',
        'Test',
        1.0,
        'ICP',
        'Open',
        '# Test',
      );
      expect(updateRes).toHaveProperty('err');

      const deleteRes = await appBountyActor.delete_bounty(0n);
      expect(deleteRes).toHaveProperty('err');
    });
  });

  // --- Suite 2: Bounty CRUD & Public Queries ---
  describe('Bounty CRUD & Public Queries', () => {
    const bounty1Data = {
      title: 'PMP Token Faucet',
      short_description: 'Get PMP tokens for development.',
      reward_amount: 0.0001,
      reward_token: 'preMCPT',
      status: 'Open',
      details_markdown: '### Key Features...',
    };

    it('should initially return an empty list of bounties', async () => {
      const bounties = await appBountyActor.get_all_bounties();
      expect(bounties).toEqual([]);
    });

    it('should allow the owner to create a bounty and retrieve it', async () => {
      appBountyActor.setIdentity(ownerIdentity);

      // Create the bounty
      const createResult = await appBountyActor.create_bounty(
        ...Object.values(bounty1Data),
      );
      expect(createResult).toHaveProperty('ok');
      // @ts-ignore
      const newBountyId = createResult.ok;
      expect(newBountyId).toBe(0n);

      // Retrieve the bounty
      const retrievedBountyOpt = await appBountyActor.get_bounty(newBountyId);
      expect(retrievedBountyOpt).not.toEqual([]); // Not empty option
      const retrievedBounty = retrievedBountyOpt[0] as Bounty;

      // Verify its properties
      expect(retrievedBounty.id).toBe(newBountyId);
      expect(retrievedBounty.title).toBe(bounty1Data.title);
      expect(retrievedBounty.status).toBe(bounty1Data.status);
      expect(retrievedBounty.created_at).toBeGreaterThan(0n);
    });

    it('should allow the owner to update a bounty', async () => {
      appBountyActor.setIdentity(ownerIdentity);
      // @ts-ignore
      const { ok: bountyId } = await appBountyActor.create_bounty(
        ...Object.values(bounty1Data),
      );

      const updatedData = { ...bounty1Data, status: 'In Progress' };
      const updateResult = await appBountyActor.update_bounty(
        bountyId,
        ...Object.values(updatedData),
      );
      expect(updateResult).toHaveProperty('ok');

      const retrievedBounty = (await appBountyActor.get_bounty(bountyId))[0];
      expect(retrievedBounty?.status).toBe('In Progress');
      expect(retrievedBounty?.title).toBe(bounty1Data.title); // Ensure other fields are preserved
    });

    it('should allow the owner to delete a bounty', async () => {
      appBountyActor.setIdentity(ownerIdentity);
      // @ts-ignore
      const { ok: bountyId } = await appBountyActor.create_bounty(
        ...Object.values(bounty1Data),
      );

      // Verify it exists
      expect(await appBountyActor.get_bounty(bountyId)).not.toEqual([]);

      // Delete it
      const deleteResult = await appBountyActor.delete_bounty(bountyId);
      expect(deleteResult).toHaveProperty('ok');

      // Verify it's gone
      expect(await appBountyActor.get_bounty(bountyId)).toEqual([]);
    });

    it('should return all bounties sorted by most recent first', async () => {
      appBountyActor.setIdentity(ownerIdentity);

      // Create first bounty
      await appBountyActor.create_bounty(
        'First Bounty',
        'Oldest',
        1.0,
        'ICP',
        'Open',
        '',
      );

      // Advance time to ensure a different timestamp
      await pic.advanceTime(5000); // 5 seconds
      await pic.tick();

      // Create second bounty
      await appBountyActor.create_bounty(
        'Second Bounty',
        'Newest',
        2.0,
        'ICP',
        'Open',
        '',
      );

      const bounties = await appBountyActor.get_all_bounties();
      expect(bounties.length).toBe(2);

      // The second (newer) bounty should be the first item in the array
      expect(bounties[0].title).toBe('Second Bounty');
      expect(bounties[0].id).toBe(1n);

      // The first (older) bounty should be the second item
      expect(bounties[1].title).toBe('First Bounty');
      expect(bounties[1].id).toBe(0n);
    });
  });
});
