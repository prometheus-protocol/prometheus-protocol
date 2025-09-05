// packages/canisters/mcp_registry/test/mcp_registry_icrc126.pic.test.ts

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

// --- Import Declarations ---
// Registry
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type { _SERVICE as RegistryService } from '@declarations/mcp_registry/mcp_registry.did';
// NEW: Audit Hub
import { idlFactory as auditHubIdlFactory } from '@declarations/audit_hub/audit_hub.did.js';
import type { _SERVICE as AuditHubService } from '@declarations/audit_hub/audit_hub.did';
import { Identity } from '@dfinity/agent';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);
// NEW: Audit Hub Wasm Path
const AUDIT_HUB_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/audit_hub/audit_hub.wasm',
);

// --- Identities ---
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const securityAuditorIdentity: Identity = createIdentity('security-auditor');
const maliciousAuditorIdentity: Identity = createIdentity('malicious-auditor');
const randomUserIdentity: Identity = createIdentity('random-user');

describe('MCP Registry ICRC-126 Integration with Audit Hub', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let auditHubActor: Actor<AuditHubService>; // NEW
  let wasmId: string;
  let bountyId: bigint;
  const wasmHash = new Uint8Array([1, 2, 3, 4]);
  const reputationTokenId = 'security_v1';
  const reputationStakeAmount = 100n;

  // Use beforeEach for a clean state for every test
  beforeEach(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy the NEW Audit Hub Canister
    const auditHubFixture = await pic.setupCanister<AuditHubService>({
      idlFactory: auditHubIdlFactory,
      wasm: AUDIT_HUB_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    auditHubActor = auditHubFixture.actor;

    // 2. Deploy Registry
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]),
    });
    registryActor = registryFixture.actor;

    // 3. Setup Permissions and Reputation Tokens
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      auditHubFixture.canisterId,
    );
    auditHubActor.setIdentity(daoIdentity);
    await auditHubActor.mint_tokens(
      securityAuditorIdentity.getPrincipal(),
      reputationTokenId,
      1000n,
    );
    await auditHubActor.mint_tokens(
      maliciousAuditorIdentity.getPrincipal(),
      reputationTokenId,
      1000n,
    );

    // 4. Create the auditable entity and a corresponding bounty
    registryActor.setIdentity(developerIdentity);
    wasmId = Buffer.from(wasmHash).toString('hex');
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/test/app',
      commit_hash: new Uint8Array([5, 6, 7, 8]),
      metadata: [],
    });
    // A bounty must exist for an attestation to be valid in the new system
    registryActor.setIdentity(daoIdentity); // DAO can create bounties
    const createResult = await registryActor.icrc127_create_bounty({
      bounty_id: [],
      validation_canister_id: registryFixture.canisterId,
      timeout_date: BigInt(Date.now() + 8.64e10) * 1000000n,
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHash }],
          ['126:audit_type', { Text: reputationTokenId }],
        ],
      },
      bounty_metadata: [
        /* No reward needed for this test */
      ],
      start_date: [],
    });
    bountyId = ('Ok' in createResult && createResult.Ok.bounty_id) || 0n;
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should REJECT an attestation if the auditor has not reserved the bounty', async () => {
    registryActor.setIdentity(securityAuditorIdentity);

    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [['bounty_id', { Nat: bountyId }]],
    });

    expect(result).toHaveProperty('Error');
    // @ts-ignore
    expect(result.Error).toHaveProperty('Unauthorized');
  });

  it('should REJECT an attestation from a different auditor who did not reserve the bounty', async () => {
    // The legitimate auditor reserves the bounty
    auditHubActor.setIdentity(securityAuditorIdentity);
    await auditHubActor.reserve_bounty(
      bountyId.toString(),
      reputationTokenId,
      reputationStakeAmount,
    );

    // The malicious (but qualified) auditor tries to file the attestation
    registryActor.setIdentity(maliciousAuditorIdentity);
    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [['bounty_id', { Nat: bountyId }]],
    });

    expect(result).toHaveProperty('Error');
    // @ts-ignore
    expect(result.Error).toHaveProperty('Unauthorized');
  });

  it('should ACCEPT an attestation from the auditor who correctly reserved the bounty', async () => {
    // Step 1: Reserve the bounty
    auditHubActor.setIdentity(securityAuditorIdentity);
    await auditHubActor.reserve_bounty(
      bountyId.toString(),
      reputationTokenId,
      reputationStakeAmount,
    );

    // Step 2: File the attestation
    registryActor.setIdentity(securityAuditorIdentity);
    const result = await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }],
        ['bounty_id', { Nat: bountyId }],
        ['custom:notes', { Text: 'Looks good to me.' }],
      ],
    });

    expect(result).toHaveProperty('Ok');
  });

  it('should log the successful attestation to the ICRC-3 log', async () => {
    // This test relies on the previous test's flow
    auditHubActor.setIdentity(securityAuditorIdentity);
    await auditHubActor.reserve_bounty(
      bountyId.toString(),
      reputationTokenId,
      reputationStakeAmount,
    );
    registryActor.setIdentity(securityAuditorIdentity);
    await registryActor.icrc126_file_attestation({
      wasm_id: wasmId,
      metadata: [
        ['126:audit_type', { Text: reputationTokenId }],
        ['bounty_id', { Nat: bountyId }],
      ],
    });

    // Now check the log
    const logResult = await registryActor.icrc3_get_blocks([
      { start: 0n, length: 100n },
    ]);
    const attestBlock = logResult.blocks
      .reverse()
      .find(
        (b) =>
          'Map' in b.block &&
          b.block.Map.find(
            ([k, v]) => k === 'btype' && 'Text' in v && v.Text === '126attest',
          ),
      );
    expect(attestBlock).toBeDefined();
  });

  describe('MCP Registry Finalization Logic', () => {
    // Use new, distinct hashes for these tests to ensure they are isolated.
    const wasmHashToVerify = new Uint8Array([10, 11, 12]);
    const wasmIdToVerify = Buffer.from(wasmHashToVerify).toString('hex');
    const wasmHashToReject = new Uint8Array([20, 21, 22]);
    const wasmIdToReject = Buffer.from(wasmHashToReject).toString('hex');

    // This `beforeEach` will run for each test below, ensuring isolation.
    // We create the requests here so they are available for each test.
    beforeEach(async () => {
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
    });

    it('should initially report a Wasm as not verified', async () => {
      const isVerified = await registryActor.is_wasm_verified(wasmIdToVerify);
      expect(isVerified).toBe(false);
    });

    it('should REJECT finalization from a non-owner principal', async () => {
      registryActor.setIdentity(randomUserIdentity); // A random user

      const result = await registryActor.finalize_verification(
        wasmIdToVerify,
        { Verified: null },
        [],
      );

      expect(result).toHaveProperty('err');
      // @ts-ignore
      expect(result.err).toEqual('Caller is not the owner');
    });

    // COMBINED TEST: This test now verifies the state change AND the log entry.
    it('should allow the owner to finalize as #Verified and log it to ICRC-3', async () => {
      // --- ACT ---
      registryActor.setIdentity(daoIdentity); // The owner
      const result = await registryActor.finalize_verification(
        wasmIdToVerify,
        { Verified: null },
        [['notes', { Text: 'DAO vote passed.' }]],
      );
      expect(result).toHaveProperty('ok');

      // --- ASSERT 1: Check the state hook ---
      const isVerified = await registryActor.is_wasm_verified(wasmIdToVerify);
      expect(isVerified).toBe(true);

      // --- ASSERT 2: Check the ICRC-3 log ---
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
      expect(verifiedBlock).toBeDefined(); // This will now pass

      let txDataMap: any[] = [];
      if (verifiedBlock && 'Map' in verifiedBlock.block) {
        const txEntry = verifiedBlock.block.Map.find(([k, v]) => k === 'tx');
        if (txEntry && 'Map' in txEntry[1]) {
          txDataMap = txEntry[1].Map;
        }
      }
      const wasmIdEntry = txDataMap.find(([k, v]) => k === 'wasm_id');
      // @ts-ignore
      expect(wasmIdEntry[1].Text).toEqual(wasmIdToVerify);
    });

    it('should allow the owner to finalize a request as #Rejected', async () => {
      registryActor.setIdentity(daoIdentity); // The owner

      await registryActor.finalize_verification(
        wasmIdToReject,
        { Rejected: null },
        [['notes', { Text: 'Divergence report was critical.' }]],
      );

      // Check the hook, it should now be explicitly false
      const isVerified = await registryActor.is_wasm_verified(wasmIdToReject);
      expect(isVerified).toBe(false);
    });
  });
});
