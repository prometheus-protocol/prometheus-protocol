// packages/canisters/auditor_credentials/test/auditor_credentials.pic.test.ts

import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import { Identity } from '@dfinity/agent';

// These will fail to import initially, which is expected.
import { idlFactory } from '@declarations/auditor_credentials';
import { type _SERVICE as CredentialService } from '@declarations/auditor_credentials/auditor_credentials.did.js';

// Wasm path for the new canister
const CREDENTIAL_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auditor_credentials/auditor_credentials.wasm',
);

describe('Auditor Credential Canister', () => {
  let pic: PocketIc;
  let credentialActor: Actor<CredentialService>;

  // Define our actors for the tests
  const daoIdentity: Identity = createIdentity('dao-principal');
  const auditorIdentity: Identity = createIdentity('auditor-principal');
  const randomUserIdentity: Identity = createIdentity('random-user-principal');

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // Deploy the canister, passing the DAO's principal as the owner in the init args.
    const fixture = await pic.setupCanister<CredentialService>({
      idlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    credentialActor = fixture.actor;
  });

  it('should initially report a credential as not verified', async () => {
    const isVerified = await credentialActor.verify_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
    expect(isVerified).toBe(false);
  });

  it('should REJECT issuing a credential from a non-DAO principal', async () => {
    // Set identity to a random user
    credentialActor.setIdentity(randomUserIdentity);

    // Expect this call to be rejected by the canister (trap)
    const res = await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
    expect(res).toHaveProperty('err');
    // @ts-ignore
    expect(res.err).toMatch(
      /Unauthorized: Only the owner can issue credentials./,
    );
  });

  it('should allow the DAO to issue a credential and then verify it', async () => {
    // Set identity to the DAO
    credentialActor.setIdentity(daoIdentity);

    // Issue the credential
    const issueResult = await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
    expect(issueResult).toHaveProperty('ok');

    // Verify the credential was granted
    const isVerified = await credentialActor.verify_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
    expect(isVerified).toBe(true);

    // Verify a different credential for the same auditor is still false
    const isCyclesVerified = await credentialActor.verify_credential(
      auditorIdentity.getPrincipal(),
      'cycles',
    );
    expect(isCyclesVerified).toBe(false);
  });

  it('should allow the DAO to revoke a credential', async () => {
    credentialActor.setIdentity(daoIdentity);

    // 1. Issue and confirm it exists
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'safety',
    );
    const isVerifiedInitially = await credentialActor.verify_credential(
      auditorIdentity.getPrincipal(),
      'safety',
    );
    expect(isVerifiedInitially).toBe(true);

    // 2. Revoke the credential
    const revokeResult = await credentialActor.revoke_credential(
      auditorIdentity.getPrincipal(),
      'safety',
    );
    expect(revokeResult).toHaveProperty('ok');

    // 3. Verify it is now gone
    const isVerifiedAfterRevoke = await credentialActor.verify_credential(
      auditorIdentity.getPrincipal(),
      'safety',
    );
    expect(isVerifiedAfterRevoke).toBe(false);
  });

  it('should handle multiple credentials for a single auditor', async () => {
    credentialActor.setIdentity(daoIdentity);

    // Issue two different credentials
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'reproducible_build',
    );
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'transactions',
    );

    // Verify both are true
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'reproducible_build',
      ),
    ).toBe(true);
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'transactions',
      ),
    ).toBe(true);

    // Revoke one
    await credentialActor.revoke_credential(
      auditorIdentity.getPrincipal(),
      'reproducible_build',
    );

    // Verify the revoked one is false and the other is still true
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'reproducible_build',
      ),
    ).toBe(false);
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'transactions',
      ),
    ).toBe(true);

    // Revoke the other one
    await credentialActor.revoke_credential(
      auditorIdentity.getPrincipal(),
      'transactions',
    );

    // Verify both are now false
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'reproducible_build',
      ),
    ).toBe(false);
    expect(
      await credentialActor.verify_credential(
        auditorIdentity.getPrincipal(),
        'transactions',
      ),
    ).toBe(false);
  });

  it('should return the current owner', async () => {
    // The owner is the deployer, which is daoIdentity
    const owner = await credentialActor.get_owner();
    expect(owner.toText()).toEqual(daoIdentity.getPrincipal().toText());
  });

  it('should return all credentials for a given auditor', async () => {
    credentialActor.setIdentity(daoIdentity);

    // Issue a few credentials
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'cycles',
    );

    // Get the list of credentials
    const creds = await credentialActor.get_credentials_for_auditor(
      auditorIdentity.getPrincipal(),
    );

    // Use a Set for order-independent comparison, as array order isn't guaranteed.
    const credSet = new Set(creds);
    expect(credSet.has('security')).toBe(true);
    expect(credSet.has('cycles')).toBe(true);
    expect(credSet.size).toBe(2);
  });

  it('should REJECT transferring ownership from a non-owner', async () => {
    credentialActor.setIdentity(randomUserIdentity);
    const newOwner = auditorIdentity.getPrincipal();

    const res = await credentialActor.transfer_ownership(newOwner);
    expect(res).toHaveProperty('err');
    // @ts-ignore
    expect(res.err).toMatch(
      /Unauthorized: Only the owner can transfer ownership./,
    );
  });

  it('should allow the owner to transfer ownership and verify new permissions', async () => {
    // --- ARRANGE ---
    // For this complex test, let's start with a fresh state by creating a new canister instance.
    // This avoids state pollution from previous tests.
    const fixture = await pic.setupCanister<CredentialService>({
      idlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    const localActor = fixture.actor;
    const newOwnerPrincipal = auditorIdentity.getPrincipal();

    // --- ACT 1: Transfer Ownership ---
    localActor.setIdentity(daoIdentity);
    const transferResult =
      await localActor.transfer_ownership(newOwnerPrincipal);

    // --- ASSERT 1: Transfer was successful ---
    expect(transferResult).toHaveProperty('ok');
    const ownerAfterTransfer = await localActor.get_owner();
    expect(ownerAfterTransfer.toText()).toEqual(newOwnerPrincipal.toText());

    // --- ACT 2: Test OLD owner's permissions ---
    localActor.setIdentity(daoIdentity); // Set back to old owner
    const issueAsOldOwner = await localActor.issue_credential(
      randomUserIdentity.getPrincipal(),
      'test',
    );

    // --- ASSERT 2: OLD owner is now UNAUTHORIZED ---
    expect(issueAsOldOwner).toHaveProperty('err');

    // --- ACT 3: Test NEW owner's permissions ---
    localActor.setIdentity(auditorIdentity); // Set to new owner
    const issueAsNewOwner = await localActor.issue_credential(
      randomUserIdentity.getPrincipal(),
      'test',
    );

    // --- ASSERT 3: NEW owner is now AUTHORIZED ---
    expect(issueAsNewOwner).toHaveProperty('ok');
  });
});
