import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { describe, beforeAll, it, expect, beforeEach, inject } from 'vitest';
import { Identity } from '@icp-sdk/core/agent';
import { IDL } from '@icp-sdk/core/candid';

// --- Import declarations for the canisters ---
import { idlFactory as registryIdl } from '@declarations/mcp_registry';
import {
  _SERVICE as RegistryService,
  init as registryInit,
} from '@declarations/mcp_registry/mcp_registry.did.js';

import { idlFactory as indexerIdl } from '@declarations/search_index';
import {
  _SERVICE as IndexerService,
  init as indexerInit,
} from '@declarations/search_index/search_index.did.js';

const REGISTRY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_registry/mcp_registry.wasm.gz',
);

const INDEXER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/search_index/search_index.wasm',
);

describe('Indexer Canister', () => {
  let pic: PocketIc;
  let registryActor: Actor<RegistryService>;
  let indexerActor: Actor<IndexerService>;
  let registryCanisterId: Principal;

  const ADMIN_IDENTITY: Identity = createIdentity('admin');
  const RANDOM_USER_IDENTITY: Identity = createIdentity('random-user');

  beforeAll(async () => {
    // Use the injected URL for the running PocketIc instance
    pic = await PocketIc.create(inject('PIC_URL'));
  });

  // Deploy fresh canisters for each test to ensure a clean state
  beforeEach(async () => {
    // 1. Deploy the Registry Canister first
    const registryFixture = await pic.setupCanister<RegistryService>({
      idlFactory: registryIdl,
      wasm: REGISTRY_WASM_PATH,
      sender: ADMIN_IDENTITY.getPrincipal(),
      arg: IDL.encode(registryInit({ IDL }), [[]]),
    });
    registryActor = registryFixture.actor;
    registryCanisterId = registryFixture.canisterId;

    // 2. Deploy the Indexer Canister, giving it the real Registry's ID
    const indexerFixture = await pic.setupCanister<IndexerService>({
      idlFactory: indexerIdl,
      wasm: INDEXER_WASM_PATH,
      sender: ADMIN_IDENTITY.getPrincipal(),
      arg: IDL.encode(indexerInit({ IDL }), []),
    });
    indexerActor = indexerFixture.actor;

    // 3. Configure the Registry to know about the Search Index Canister
    registryActor.setIdentity(ADMIN_IDENTITY);
    const res = await registryActor.set_search_index_canister_id(
      indexerFixture.canisterId,
    );
    expect(res).toEqual({ ok: null });

    // 4. Configure the Indexer to know about the Registry Canister
    indexerActor.setIdentity(ADMIN_IDENTITY);
    const res2 = await indexerActor.set_registry_canister_id(
      registryFixture.canisterId,
    );
    expect(res2).toEqual({ ok: null });
  });

  describe('update_index Method (Security)', () => {
    it('should REJECT calls from any principal except the registry canister', async () => {
      // Attempt to call the indexer from a random user identity
      indexerActor.setIdentity(RANDOM_USER_IDENTITY);

      // We expect this to trap, so we use `rejects.toThrow()`
      await expect(
        indexerActor.update_index('com.example.app', 'some content'),
      ).rejects.toThrow(
        /Unauthorized: Only the registry canister can update the index./,
      );
    });

    it('should ACCEPT calls originating from the registry canister', async () => {
      // Use the admin identity to call the test helper on the registry
      registryActor.setIdentity(ADMIN_IDENTITY);

      // This call should succeed without throwing an error
      await expect(
        registryActor.test_only_notify_indexer(
          'io.github.jneums.taskpad',
          'A simple to-do list app',
        ),
      ).resolves.toEqual(null);
    });
  });

  describe('search Method (Query Logic)', () => {
    // Before running search tests, pre-populate the index with some data
    beforeEach(async () => {
      registryActor.setIdentity(ADMIN_IDENTITY);
      await registryActor.test_only_notify_indexer(
        'io.github.jneums.taskpad',
        'A simple on-chain to-do list for agents. Productivity and tasks.',
      );
      await registryActor.test_only_notify_indexer(
        'io.github.jneums.ratestream',
        'An on-chain oracle for financial exchange rates. Finance and data.',
      );
    });

    it('should return an empty array for a query with no matches', async () => {
      const results = await indexerActor.search('nonexistentword');
      expect(results).toEqual([]);
    });

    it('should return a single match for a unique keyword', async () => {
      const results = await indexerActor.search('todo');
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('io.github.jneums.taskpad');
    });

    it('should be case-insensitive', async () => {
      const results = await indexerActor.search('FINANCE');
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('io.github.jneums.ratestream');
    });

    it('should return multiple matches for a common keyword', async () => {
      const results = await indexerActor.search('on-chain');
      expect(results).toHaveLength(2);
      expect(results).toContain('io.github.jneums.taskpad');
      expect(results).toContain('io.github.jneums.ratestream');
    });

    it('should return the intersection of results for a multi-word query', async () => {
      const results = await indexerActor.search('list productivity');
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('io.github.jneums.taskpad');
    });

    it('should return an empty array if one word in a multi-word query does not match', async () => {
      const results = await indexerActor.search('list finance');
      expect(results).toEqual([]);
    });
  });
});
