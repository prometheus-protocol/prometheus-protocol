// packages/canisters/mcp_registry/test/mcp_registry_e2e.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// --- Import Declarations ---
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type {
  CreateCanisterType,
  _SERVICE as RegistryService,
  UpdateWasmRequest,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import type { _SERVICE as LedgerService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import { idlFactory as credentialIdlFactory } from '@declarations/auditor_credentials/auditor_credentials.did.js';
import type { _SERVICE as CredentialService } from '@declarations/auditor_credentials/auditor_credentials.did.js';

// --- Wasm Paths ---
const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm',
);
const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);
const CREDENTIAL_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/auditor_credentials/auditor_credentials.wasm',
);

// --- Identities ---
const daoIdentity = createIdentity('dao-principal'); // Also the canister owner
const developerIdentity = createIdentity('developer-principal');
const bountyCreatorIdentity = createIdentity('bounty-creator');
const reproAuditorIdentity = createIdentity('repro-auditor');
const securityAuditorIdentity = createIdentity('security-auditor');
const qualityAuditorIdentity = createIdentity('quality-auditor');

describe('MCP Registry Full E2E Lifecycle', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let ledgerActor: Actor<LedgerService>;
  let registryCanisterId: Principal;
  let ledgerCanisterId: Principal;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy Dependencies
    const credentialFixture = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
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

    // 2. Deploy Registry with real dependency IDs
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [
        {
          auditorCredentialCanisterId: credentialFixture.canisterId,
          icrc118wasmregistryArgs: [],
          ttArgs: [],
        },
      ]),
    });
    registryActor = registryFixture.actor;
    registryCanisterId = registryFixture.canisterId;

    // 3. Setup Permissions and Funds
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      credentialFixture.canisterId,
    );
    credentialFixture.actor.setIdentity(daoIdentity);
    await credentialFixture.actor.issue_credential(
      reproAuditorIdentity.getPrincipal(),
      'build',
    );
    await credentialFixture.actor.issue_credential(
      securityAuditorIdentity.getPrincipal(),
      'security',
    );
    await credentialFixture.actor.issue_credential(
      qualityAuditorIdentity.getPrincipal(),
      'quality',
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
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should orchestrate the full developer-to-auditor-to-upgrade lifecycle', async () => {
    const wasmHash = new Uint8Array([1, 2, 3, 4, 5]);
    const wasmId = Buffer.from(wasmHash).toString('hex');
    const bountyAmount = 100_000n;
    const appNamespace = 'com.prometheus.test-server';

    // === PHASE 1: Developer creates a namespace for their application ===
    registryActor.setIdentity(developerIdentity);
    const request: CreateCanisterType = {
      canister_type_namespace: appNamespace,
      canister_type_name: 'Prometheus Test Server',
      controllers: [[developerIdentity.getPrincipal()]],
      description: 'A test server for our isolated test suite.',
      repo: 'https://github.com/prometheus-protocol/test-server',
      metadata: [['prom_cert:tier', { Text: 'Gold' }]],
      forked_from: [],
    };

    const createResult = await registryActor.icrc118_create_canister_type([
      request,
    ]);
    expect('Ok' in createResult[0]).toBe(true);

    // === PHASE 2: Developer requests formal verification for a PROPOSED new version ===
    const reqResult = await registryActor.icrc126_verification_request({
      wasm_hash: wasmHash,
      repo: 'https://github.com/final-boss/app',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });
    expect(reqResult).toBeGreaterThanOrEqual(0n);

    // === PHASE 3: Bounties are created to attract auditors ===
    registryActor.setIdentity(bountyCreatorIdentity);
    const auditTypes = ['build', 'security', 'quality'];
    const bountyIds: { [key: string]: bigint } = {};
    for (const auditType of auditTypes) {
      const createResult = await registryActor.icrc127_create_bounty({
        bounty_id: [],
        validation_canister_id: registryCanisterId,
        timeout_date:
          BigInt((await pic.getTime()) * 1_000_000) + 86_400_000_000_000n,
        start_date: [],
        challenge_parameters: {
          Map: [
            ['wasm_hash', { Blob: wasmHash }],
            ['audit_type', { Text: auditType }],
          ],
        },
        bounty_metadata: [
          ['icrc127:reward_canister', { Principal: ledgerCanisterId }],
          ['icrc127:reward_amount', { Nat: bountyAmount }],
        ],
      });
      if (!('Ok' in createResult))
        throw new Error(`Bounty creation failed for ${auditType}`);
      bountyIds[auditType] = createResult.Ok.bounty_id;
    }

    // === PHASE 4: Auditors complete audits and claim bounties ===
    const auditors = [
      { identity: reproAuditorIdentity, type: 'build' },
      { identity: securityAuditorIdentity, type: 'security' },
      { identity: qualityAuditorIdentity, type: 'quality' },
    ];
    for (const auditor of auditors) {
      console.log(`  - ${auditor.type} audit...`);
      registryActor.setIdentity(auditor.identity);
      const res = await registryActor.icrc126_file_attestation({
        wasm_id: wasmId,
        metadata: [['126:audit_type', { Text: auditor.type }]],
      });
      expect('Ok' in res).toBe(true);

      const claimResult = await registryActor.icrc127_submit_bounty({
        bounty_id: bountyIds[auditor.type],
        submission: { Text: 'Attestation filed.' },
        account: [],
      });
      expect('Ok' in claimResult).toBe(true);
      if ('Ok' in claimResult) {
        const resArr = claimResult.Ok.result;
        if (resArr && resArr[0] && resArr[0].result) {
          expect(resArr[0].result).toHaveProperty('Valid');
        }
      }
    }

    // === PHASE 5: DAO Finalization ===
    console.log('PHASE 5: DAO finalizes the verification...');
    registryActor.setIdentity(daoIdentity);
    const finalizeResult = await registryActor.finalize_verification(
      wasmId,
      { Verified: null },
      [],
    );
    expect('ok' in finalizeResult).toBe(true);

    // === PHASE 6: Developer publishes the now-verified WASM ===
    console.log('PHASE 6: Developer publishes the verified WASM...');
    registryActor.setIdentity(developerIdentity);
    const updateRequest: UpdateWasmRequest = {
      canister_type_namespace: appNamespace,
      version_number: [1n, 0n, 0n],
      description: 'Initial release with verified Wasm',
      repo: 'https://github.com/final-boss/app',
      metadata: [],
      expected_hash: wasmHash,
      expected_chunks: [new Uint8Array([1])], // Dummy chunk hash
      previous: [],
    };
    const updateResult = await registryActor.icrc118_update_wasm(updateRequest);
    expect('Ok' in updateResult).toBe(true);
    console.log('E2E test completed successfully!');
  });
});
