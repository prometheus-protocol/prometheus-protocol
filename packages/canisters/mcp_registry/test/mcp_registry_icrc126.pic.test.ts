// packages/canisters/mcp_registry/test/mcp_registry_icrc126.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';

// --- Import Declarations ---
// Registry
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type { _SERVICE as RegistryService } from '@declarations/mcp_registry/mcp_registry.did';
// Credential Canister
import { idlFactory as credentialIdlFactory } from '@declarations/auditor_credentials/auditor_credentials.did.js';
import type { _SERVICE as CredentialService } from '@declarations/auditor_credentials/auditor_credentials.did';
import { Identity } from '@dfinity/agent';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);
const CREDENTIAL_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auditor_credentials/auditor_credentials.wasm',
);

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal'); // Owner of credential canister
const developerIdentity: Identity = createIdentity('developer-principal'); // Owner of registry
const securityAuditorIdentity: Identity = createIdentity('security-auditor');
const cyclesAuditorIdentity: Identity = createIdentity('cycles-auditor');
const randomUserIdentity: Identity = createIdentity('random-user');

describe('MCP Registry ICRC-126 Integration', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let credentialActor: Actor<CredentialService>;
  let wasmId: string; // Using wasm hash as the ID for simplicity
  const wasmHash = new Uint8Array([1, 2, 3, 4]);

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy the REAL Credential Canister, owned by the DAO
    const credentialFixture = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    credentialActor = credentialFixture.actor;

    // 2. Deploy Registry, injecting the LIVE credential canister ID
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]),
    });
    registryActor = registryFixture.actor;

    // 3. Setup Permissions
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      credentialFixture.canisterId,
    );
    credentialActor.setIdentity(daoIdentity);

    await credentialActor.issue_credential(
      securityAuditorIdentity.getPrincipal(),
      'security',
    );
    await credentialActor.issue_credential(
      cyclesAuditorIdentity.getPrincipal(),
      'cycles',
    );

    // 4. Create the auditable entity using an ICRC-126 verification request
    registryActor.setIdentity(developerIdentity);
    wasmId = Buffer.from(wasmHash).toString('hex');
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/prometheus/final-test-app',
      commit_hash: new Uint8Array([5, 6, 7, 8]),
      metadata: [],
    });
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should REJECT an attestation from a user with NO credentials', async () => {
    registryActor.setIdentity(randomUserIdentity);

    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [['126:audit_type', { Text: 'security' }]],
    });

    expect('Error' in result).toBeTruthy();
    if ('Error' in result) {
      expect('Unauthorized' in result.Error).toBeTruthy();
    }
  });

  it('should REJECT an attestation for the wrong audit type', async () => {
    registryActor.setIdentity(securityAuditorIdentity);

    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [['126:audit_type', { Text: 'cycles' }]], // Incorrect type
    });

    expect('Error' in result).toBeTruthy();
    if ('Error' in result) {
      expect('Unauthorized' in result.Error).toBeTruthy();
    }
  });

  it('should ACCEPT an attestation from a correctly credentialed auditor', async () => {
    registryActor.setIdentity(securityAuditorIdentity);

    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: 'security' }],
        ['custom:notes', { Text: 'Looks good to me.' }],
      ],
    });

    expect('Ok' in result).toBeTruthy();
  });

  it('should log the successful attestation to the ICRC-3 log', async () => {
    // This test relies on the previous test successfully filing an attestation.

    const logResult = await registryActor.icrc3_get_blocks([
      { start: 0n, length: 100n },
    ]);

    const attestBlock = logResult.blocks.reverse().find((b) => {
      const blockMap = 'Map' in b.block ? b.block.Map : [];
      const btypeEntry = blockMap.find(([key, _]) => key === 'btype');
      return (
        btypeEntry &&
        'Text' in btypeEntry[1] &&
        btypeEntry[1].Text === '126attest'
      );
    });

    expect(attestBlock).toBeDefined();

    const blockMap =
      attestBlock && 'Map' in attestBlock.block ? attestBlock.block.Map : [];
    const txEntry = blockMap.find(([key, _]) => key === 'tx');
    expect(txEntry).toBeDefined();

    const txDataMap = txEntry && 'Map' in txEntry[1] ? txEntry[1].Map : [];
    const wasmIdEntry = txDataMap.find(([key, _]) => key === 'wasm_id');
    expect(
      wasmIdEntry && 'Text' in wasmIdEntry[1] && wasmIdEntry[1].Text,
    ).toEqual(wasmId);
  });

  describe('MCP Registry Finalization Logic', () => {
    // Use new, distinct hashes for these tests to ensure they are isolated.
    const wasmHashToVerify = new Uint8Array([10, 11, 12]);
    const wasmIdToVerify = Buffer.from(wasmHashToVerify).toString('hex');
    const wasmHashToReject = new Uint8Array([20, 21, 22]);
    const wasmIdToReject = Buffer.from(wasmHashToReject).toString('hex');

    // Create the necessary verification requests before the tests run.
    beforeAll(async () => {
      registryActor.setIdentity(developerIdentity);
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHashToVerify,
        repo: 'https://github.com/prometheus/to-verify-app',
        commit_hash: new Uint8Array([1]),
        metadata: [],
      });
      await registryActor.icrc126_verification_request({
        wasm_hash: wasmHashToReject,
        repo: 'https://github.com/prometheus/to-reject-app',
        commit_hash: new Uint8Array([2]),
        metadata: [],
      });
      await pic.tick();
    });

    it('should initially report a Wasm as not verified', async () => {
      const isVerified = await registryActor.is_wasm_verified(wasmHashToVerify);
      expect(isVerified).toBe(false);
    });

    it('should REJECT finalization from a non-owner principal', async () => {
      registryActor.setIdentity(randomUserIdentity); // A random user

      const result = await registryActor.finalize_verification(
        wasmIdToVerify,
        { Verified: null },
        [],
      );

      expect('err' in result).toBeTruthy();
      if ('err' in result) {
        expect(result.err).toEqual('Caller is not the owner');
      }
    });

    it('should allow the owner to finalize a request as #Verified', async () => {
      registryActor.setIdentity(daoIdentity); // The owner

      const result = await registryActor.finalize_verification(
        wasmIdToVerify,
        { Verified: null },
        [['notes', { Text: 'DAO vote passed.' }]],
      );

      expect('ok' in result).toBeTruthy();
      await pic.tick(); // Commit the state change

      // Now check the hook
      const isVerified = await registryActor.is_wasm_verified(wasmHashToVerify);
      expect(isVerified).toBe(true);
    });

    it('should log a `126verified` block to ICRC-3', async () => {
      // This test relies on the previous test successfully finalizing.
      const logResult = await registryActor.icrc3_get_blocks([
        { start: 0n, length: 100n },
      ]);

      const verifiedBlock = logResult.blocks
        .reverse()
        .find(
          (b) =>
            'Map' in b.block &&
            b.block.Map.find(
              ([k, v]) =>
                k === 'btype' && 'Text' in v && v.Text === '126verified',
            ),
        );
      expect(verifiedBlock).toBeDefined();

      let txDataMap: any[] = [];
      if (verifiedBlock && 'Map' in verifiedBlock.block) {
        const txEntry = verifiedBlock.block.Map.find(([k, v]) => k === 'tx');
        if (txEntry && 'Map' in txEntry[1]) {
          txDataMap = txEntry[1].Map;
        }
      }
      const wasmIdEntry = txDataMap.find(([k, v]) => k === 'wasm_id');
      expect(wasmIdEntry && wasmIdEntry[1].Text).toEqual(wasmIdToVerify);
    });

    it('should REJECT finalizing an already finalized request', async () => {
      registryActor.setIdentity(daoIdentity);

      const result = await registryActor.finalize_verification(
        wasmIdToVerify, // Try to finalize the same one again
        { Rejected: null },
        [],
      );

      expect('err' in result).toBeTruthy();
      if ('err' in result) {
        expect(result.err).toEqual('This wasm_id has already been finalized.');
      }
    });

    it('should allow the owner to finalize a request as #Rejected', async () => {
      registryActor.setIdentity(developerIdentity);

      await registryActor.finalize_verification(
        wasmIdToReject,
        { Rejected: null },
        [['notes', { Text: 'Divergence report was critical.' }]],
      );
      await pic.tick();

      // Check the hook, it should now be explicitly false
      const isVerified = await registryActor.is_wasm_verified(wasmHashToReject);
      expect(isVerified).toBe(false);
    });
  });
});
