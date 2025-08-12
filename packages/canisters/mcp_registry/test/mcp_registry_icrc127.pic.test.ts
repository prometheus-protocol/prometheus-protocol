// packages/canisters/mcp_registry/test/mcp_registry_icrc127.pic.test.ts

import path from 'node:path';
import { PocketIc, createIdentity } from '@dfinity/pic';
import { describe, beforeAll, it, expect, afterAll, inject } from 'vitest';
import { IDL } from '@dfinity/candid';
import type { Actor } from '@dfinity/pic';
import { Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// --- Import Declarations ---
// Registry
import {
  idlFactory as registryIdlFactory,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';
import type { _SERVICE as RegistryService } from '@declarations/mcp_registry/mcp_registry.did.js';
// ICRC-1 Ledger
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import type { _SERVICE as LedgerService } from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
// Auditor Credential
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
const daoIdentity: Identity = createIdentity('dao-principal');
const developerIdentity: Identity = createIdentity('developer-principal');
const bountyCreatorIdentity: Identity = createIdentity('bounty-creator');
const bountyClaimantIdentity: Identity = createIdentity('bounty-claimant');
const auditorIdentity: Identity = createIdentity('auditor-for-test');

describe('MCP Registry ICRC-127 Integration', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let registryCanisterId: Principal;
  let ledgerActor: Actor<LedgerService>;
  let ledgerActorCanisterId: Principal;
  let credentialActor: Actor<CredentialService>;
  let credentialActorCanisterId: Principal;
  let bountyId: bigint;
  let fee: bigint = 10_000n; // Fee for ICRC-2 approve
  const wasmHashToVerify = new Uint8Array([10, 11, 12]);
  const wasmIdToVerify = Buffer.from(wasmHashToVerify).toString('hex');
  const bountyAmount = 500_000n;

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);

    // 1. Deploy the REAL ICRC-1 Ledger Canister, owned by the DAO
    const ledgerFixture = await pic.setupCanister<LedgerService>({
      idlFactory: ledgerIdlFactory,
      wasm: LEDGER_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(
        // Use the init function from the generated .did.js file to get the correct type definition
        ledgerInit({ IDL }),
        [
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
              // Provide the mandatory archive_options
              archive_options: {
                num_blocks_to_archive: 1000n,
                trigger_threshold: 2000n,
                controller_id: daoIdentity.getPrincipal(),
                // Optional fields can be empty arrays
                max_message_size_bytes: [],
                cycles_for_archive_creation: [],
                node_max_memory_size_bytes: [],
                more_controller_ids: [],
                max_transactions_per_response: [],
              },
              // Other optional fields
              decimals: [],
              fee_collector_account: [],
              max_memo_length: [],
              index_principal: [],
              feature_flags: [],
            },
          },
        ],
      ),
    });
    ledgerActor = ledgerFixture.actor;
    ledgerActorCanisterId = ledgerFixture.canisterId;

    const credentialFixture = await pic.setupCanister<CredentialService>({
      idlFactory: credentialIdlFactory,
      wasm: CREDENTIAL_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
    });
    credentialActor = credentialFixture.actor;
    credentialActorCanisterId = credentialFixture.canisterId;

    // 2. Deploy Registry (no special init args needed for ICRC-127 as it uses hooks)
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdlFactory,
      wasm: REGISTRY_WASM_PATH,
      sender: daoIdentity.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [
        {
          icrc118wasmregistryArgs: [],
          ttArgs: [],
        },
      ]),
    });
    registryActor = registryFixture.actor;
    registryCanisterId = registryFixture.canisterId;

    // 3. Setup Funds and Permissions
    registryActor.setIdentity(daoIdentity);
    await registryActor.set_auditor_credentials_canister_id(
      credentialFixture.canisterId,
    );
    // Mint tokens to the bounty creator
    ledgerActor.setIdentity(daoIdentity);
    await ledgerActor.icrc1_transfer({
      from_subaccount: [],
      to: { owner: bountyCreatorIdentity.getPrincipal(), subaccount: [] },
      amount: (bountyAmount + fee) * 2n, // Mint double the bounty amount for testing
      fee: [],
      memo: [],
      created_at_time: [],
    });

    // Bounty creator approves the registry canister to spend their funds for the bounty
    ledgerActor.setIdentity(bountyCreatorIdentity);
    await ledgerActor.icrc2_approve({
      spender: { owner: registryFixture.canisterId, subaccount: [] },
      amount: bountyAmount + fee + fee, // Total amount including fee to pay bounty
      fee: [],
      memo: [],
      created_at_time: [],
      from_subaccount: [],
      expected_allowance: [],
      expires_at: [],
    });

    // 4. Create the auditable entity (the Wasm to be verified)
    registryActor.setIdentity(developerIdentity);
    await registryActor.icrc126_verification_request({
      wasm_hash: wasmHashToVerify,
      repo: 'https://github.com/prometheus/to-verify-app',
      commit_hash: new Uint8Array([1]),
      metadata: [],
    });

    credentialActor.setIdentity(daoIdentity);
    await credentialActor.issue_credential(
      auditorIdentity.getPrincipal(),
      'security',
    );
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  it('should create a bounty for verifying a specific Wasm hash', async () => {
    registryActor.setIdentity(bountyCreatorIdentity);
    const createResult = await registryActor.icrc127_create_bounty({
      bounty_id: [],
      validation_canister_id: registryCanisterId, // The registry validates itself
      timeout_date:
        BigInt((await pic.getTime()) * 1_000_000) + 86_400_000_000_000n,
      start_date: [],
      challenge_parameters: {
        Map: [
          ['wasm_hash', { Blob: wasmHashToVerify }],
          ['audit_type', { Text: 'security' }],
        ],
      },
      bounty_metadata: [
        ['icrc127:reward_canister', { Principal: ledgerActorCanisterId }],
        ['icrc127:reward_amount', { Nat: bountyAmount }],
      ],
    });

    expect('Ok' in createResult).toBe(true);
    if ('Ok' in createResult) {
      bountyId = createResult.Ok.bounty_id;
    }
    // Check that the funds were escrowed from the creator's account
    const creatorBalance = await ledgerActor.icrc1_balance_of({
      owner: bountyCreatorIdentity.getPrincipal(),
      subaccount: [],
    });
    expect(creatorBalance).toBe(1_000_000n - bountyAmount - fee);
  });

  it('should REJECT a claim because the Wasm is not yet verified', async () => {
    registryActor.setIdentity(bountyClaimantIdentity);
    const submitResult = await registryActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty' }, // Submission data can be anything here
      account: [],
    });

    expect('Ok' in submitResult).toBe(true);
    if ('Ok' in submitResult) {
      expect(
        submitResult.Ok.result &&
          submitResult.Ok.result[0] &&
          submitResult.Ok.result[0].result,
      ).toHaveProperty('Invalid');
    }
  });

  it('should ACCEPT a claim after the required attestation has been filed', async () => {
    // First, the auditor must file the attestation. This is the "work".
    registryActor.setIdentity(auditorIdentity);
    const attestResult = await registryActor.icrc126_file_attestation({
      wasm_id: wasmIdToVerify,
      metadata: [['126:audit_type', { Text: 'security' }]],
    });
    expect('Ok' in attestResult).toBe(true);

    // Now, the claimant can submit the claim, which should be valid.
    registryActor.setIdentity(bountyClaimantIdentity);
    const submitResult = await registryActor.icrc127_submit_bounty({
      bounty_id: bountyId,
      submission: { Text: 'I claim this bounty now' },
      account: [],
    });
    expect('Ok' in submitResult).toBe(true);
    if (
      'Ok' in submitResult &&
      submitResult.Ok.result &&
      submitResult.Ok.result[0] &&
      submitResult.Ok.result[0].result
    ) {
      expect(submitResult.Ok.result[0].result).toHaveProperty('Valid');
    }

    const claimantBalance = await ledgerActor.icrc1_balance_of({
      owner: bountyClaimantIdentity.getPrincipal(),
      subaccount: [],
    });
    expect(claimantBalance).toBe(bountyAmount);
  });

  it('should log the successful bounty run to the ICRC-3 log', async () => {
    // This test relies on the previous test successfully filing and claiming.
    const logResult = await registryActor.icrc3_get_blocks([
      { start: 0n, length: 100n },
    ]);
    const runBlock = logResult.blocks.reverse().find((b) => {
      const blockMap = 'Map' in b.block ? b.block.Map : [];
      const btypeEntry = blockMap.find(([key, _]) => key === 'btype');
      return (
        btypeEntry &&
        'Text' in btypeEntry[1] &&
        btypeEntry[1].Text === '127bounty_run'
      );
    });
    expect(runBlock).toBeDefined();

    const blockMap =
      runBlock && 'Map' in runBlock.block ? runBlock.block.Map : [];
    const txEntry = blockMap.find(([key, _]) => key === 'tx');
    const txDataMap = txEntry && 'Map' in txEntry[1] ? txEntry[1].Map : [];
    const resultEntry = txDataMap.find(([key, _]) => key === 'result');
    expect(resultEntry?.[1]).toEqual({ Text: 'Valid' }); // This will now pass
  });
});
