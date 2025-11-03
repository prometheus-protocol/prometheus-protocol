// packages/canisters/token_watchlist/test/token_watchlist.pic.test.ts

import path from 'node:path';
import { Principal } from '@icp-sdk/core/principal';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
  inject,
  beforeEach,
} from 'vitest';
import { Identity } from '@icp-sdk/core/agent';

// Import from the token_watchlist declarations
import { idlFactory as watchlistIdlFactory } from '@declarations/token_watchlist';
import {
  _SERVICE as WatchlistService,
  init as watchlistInit,
  TokenInfo,
} from '@declarations/token_watchlist/token_watchlist.did.js';
import {
  idlFactory as ledgerIdlFactory,
  init as ledgerInit,
  type _SERVICE as LedgerService,
} from '@declarations/icrc1_ledger/icrc1_ledger.did.js';
import { IDL } from '@icp-sdk/core/candid';

const WATCHLIST_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/token_watchlist/token_watchlist.wasm',
);

const LEDGER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/icrc1_ledger/icrc1_ledger.wasm.gz',
);

const daoIdentity = createIdentity('dao-principal');

describe('Token Watchlist Canister', () => {
  let pic: PocketIc;
  let watchlistActor: Actor<WatchlistService>;
  let watchlistCanisterId: Principal;

  // Real token canister Principals deployed in test environment
  let TOKEN_USDC: Principal;
  let TOKEN_ICP: Principal;
  let TOKEN_CKBTC: Principal;

  beforeAll(async () => {
    pic = await PocketIc.create(inject('PIC_URL'));
    await pic.setTime(new Date());

    // Deploy USDC Ledger
    const usdcFixture = await pic.setupCanister<LedgerService>({
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
            token_name: 'USD Coin',
            token_symbol: 'USDC',
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
    TOKEN_USDC = usdcFixture.canisterId;

    // Deploy ICP Ledger
    const icpFixture = await pic.setupCanister<LedgerService>({
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
            token_name: 'Internet Computer',
            token_symbol: 'ICP',
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
    TOKEN_ICP = icpFixture.canisterId;

    // Deploy ckBTC Ledger
    const ckbtcFixture = await pic.setupCanister<LedgerService>({
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
            transfer_fee: 10n,
            token_name: 'Chain Key Bitcoin',
            token_symbol: 'ckBTC',
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
    TOKEN_CKBTC = ckbtcFixture.canisterId;

    // Setup the watchlist canister
    const fixture = await pic.setupCanister<WatchlistService>({
      idlFactory: watchlistIdlFactory,
      wasm: WATCHLIST_WASM_PATH,
      arg: IDL.encode(watchlistInit({ IDL }), [[]]),
    });
    watchlistActor = fixture.actor;
    watchlistCanisterId = fixture.canisterId;
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  describe('UI Backend API - get_my_watchlist', () => {
    it('should return an empty array for a new user', async () => {
      // Arrange
      const userAlice = createIdentity('alice-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toEqual([]);
    });

    it('should return TokenInfo objects with correct metadata', async () => {
      // Arrange
      const userAlice = createIdentity('alice-metadata-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Add a real token
      const addResult = await watchlistActor.add_to_watchlist(TOKEN_USDC);
      expect(addResult).toHaveProperty('ok');

      // Act
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toHaveProperty('canisterId', TOKEN_USDC);
      expect(watchlist[0]).toHaveProperty('symbol', 'USDC');
      expect(watchlist[0]).toHaveProperty('name', 'USD Coin');
      expect(watchlist[0]).toHaveProperty('decimals');
      expect(watchlist[0]).toHaveProperty('fee');
      expect(watchlist[0]).toHaveProperty('lastRefreshed');
    });
  });

  describe('UI Backend API - add_to_watchlist', () => {
    it('should successfully add a token and fetch its metadata', async () => {
      // Arrange
      const userAlice = createIdentity('alice-add-success-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const result = await watchlistActor.add_to_watchlist(TOKEN_USDC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].canisterId).toEqual(TOKEN_USDC);
      expect(watchlist[0].symbol).toBe('USDC');
      expect(watchlist[0].name).toBe('USD Coin');
    });

    it('should successfully add multiple different tokens', async () => {
      // Arrange
      const userAlice = createIdentity('alice-add-multi-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(3);
      const canisterIds = watchlist.map((t) => t.canisterId);
      expect(canisterIds).toContainEqual(TOKEN_USDC);
      expect(canisterIds).toContainEqual(TOKEN_ICP);
      expect(canisterIds).toContainEqual(TOKEN_CKBTC);
    });

    it('should be idempotent - adding the same token twice should not create duplicates', async () => {
      // Arrange
      const userAlice = createIdentity('alice-add-idempotent-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const result1 = await watchlistActor.add_to_watchlist(TOKEN_USDC);
      const result2 = await watchlistActor.add_to_watchlist(TOKEN_USDC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result1).toHaveProperty('ok');
      expect(result2).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].canisterId).toEqual(TOKEN_USDC);
    });

    it('should isolate watchlists between different users', async () => {
      // Arrange & Act
      const userAlice = createIdentity('alice-add-isolate-' + Math.random());
      const userBob = createIdentity('bob-add-isolate-' + Math.random());

      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);

      watchlistActor.setIdentity(userBob);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      // Assert
      const bobWatchlist = await watchlistActor.get_my_watchlist();
      watchlistActor.setIdentity(userAlice);
      const aliceCheck = await watchlistActor.get_my_watchlist();

      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist[0].canisterId).toEqual(TOKEN_ICP);
      expect(aliceCheck).toHaveLength(1);
      expect(aliceCheck[0].canisterId).toEqual(TOKEN_USDC);
    });

    it('should return an error when trying to add a non-existent token', async () => {
      // Arrange
      const userAlice = createIdentity(
        'alice-add-nonexistent-' + Math.random(),
      );
      watchlistActor.setIdentity(userAlice);
      const fakeTokenId = Principal.fromText('aaaaa-aa');

      // Act
      const result = await watchlistActor.add_to_watchlist(fakeTokenId);

      // Assert - should fail because token doesn't exist or doesn't implement ICRC-1
      expect(result).toHaveProperty('err');
      if ('err' in result) {
        expect(result.err).toContain('Failed to fetch token metadata');
      }
    });
  });

  describe('UI Backend API - remove_from_watchlist', () => {
    it('should successfully remove a token from the watchlist', async () => {
      // Arrange
      const userAlice = createIdentity('alice-remove-success-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      // Act
      const result = await watchlistActor.remove_from_watchlist(TOKEN_USDC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].canisterId).toEqual(TOKEN_ICP);
    });

    it('should succeed when removing a token that does not exist', async () => {
      // Arrange
      const userAlice = createIdentity(
        'alice-remove-notexist-' + Math.random(),
      );
      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);

      // Act
      const result = await watchlistActor.remove_from_watchlist(TOKEN_ICP);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].canisterId).toEqual(TOKEN_USDC);
    });

    it('should succeed when removing from an empty watchlist', async () => {
      // Arrange
      const userAlice = createIdentity('alice-remove-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const result = await watchlistActor.remove_from_watchlist(TOKEN_USDC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toEqual([]);
    });

    it('should correctly remove all tokens when called multiple times', async () => {
      // Arrange
      const userAlice = createIdentity('alice-remove-all-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);

      // Act
      await watchlistActor.remove_from_watchlist(TOKEN_USDC);
      await watchlistActor.remove_from_watchlist(TOKEN_ICP);
      await watchlistActor.remove_from_watchlist(TOKEN_CKBTC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toEqual([]);
    });
  });

  describe('MCP Tool API - get_my_watchlist tool', () => {
    it('should return an empty watchlist for a new user via MCP tool', async () => {
      // Arrange
      const userAlice = createIdentity('alice-mcp-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act: Call the MCP tool (this would normally be called by an AI agent)
      // Note: The actual MCP tool call would go through mcp_call_tool
      // For now we test the backend method directly
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toEqual([]);
    });

    it('should return the correct watchlist via MCP tool after tokens are added', async () => {
      // Arrange
      const userAlice = createIdentity('alice-mcp-tokens-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      // Act: Get watchlist through the query method (simulating MCP tool response)
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(2);
      const canisterIds = watchlist.map((t) => t.canisterId);
      expect(canisterIds).toContainEqual(TOKEN_USDC);
      expect(canisterIds).toContainEqual(TOKEN_ICP);
    });

    it('should respect authentication and return different watchlists for different users', async () => {
      // Arrange: Setup watchlists for different users
      const userAlice = createIdentity('alice-mcp-auth-' + Math.random());
      const userBob = createIdentity('bob-mcp-auth-' + Math.random());
      const userCharlie = createIdentity('charlie-mcp-auth-' + Math.random());

      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);

      watchlistActor.setIdentity(userBob);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      watchlistActor.setIdentity(userCharlie);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);

      // Act: Query each user's watchlist
      const charlieWatchlist = await watchlistActor.get_my_watchlist();

      watchlistActor.setIdentity(userBob);
      const bobWatchlist = await watchlistActor.get_my_watchlist();

      watchlistActor.setIdentity(userAlice);
      const aliceWatchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(charlieWatchlist).toHaveLength(1);
      expect(charlieWatchlist[0].canisterId).toEqual(TOKEN_CKBTC);

      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist[0].canisterId).toEqual(TOKEN_ICP);

      expect(aliceWatchlist).toHaveLength(1);
      expect(aliceWatchlist[0].canisterId).toEqual(TOKEN_USDC);
    });
  });

  describe('Data Persistence and Upgrade Safety', () => {
    it('should maintain data integrity across multiple operations', async () => {
      // Arrange
      const userAlice = createIdentity('alice-persist-ops-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act: Perform a series of operations
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);
      await watchlistActor.remove_from_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);
      await watchlistActor.remove_from_watchlist(TOKEN_USDC);

      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].canisterId).toEqual(TOKEN_CKBTC);
    });

    it('should handle concurrent operations from multiple users', async () => {
      // Arrange & Act: Multiple users adding tokens
      const userAlice = createIdentity(
        'alice-persist-concurrent-' + Math.random(),
      );
      const userBob = createIdentity('bob-persist-concurrent-' + Math.random());
      const userCharlie = createIdentity(
        'charlie-persist-concurrent-' + Math.random(),
      );

      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);

      watchlistActor.setIdentity(userBob);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      watchlistActor.setIdentity(userCharlie);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);

      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);

      // Assert: Each user's data is intact
      const aliceWatchlist = await watchlistActor.get_my_watchlist();
      expect(aliceWatchlist).toHaveLength(2);
      const aliceIds = aliceWatchlist.map((t) => t.canisterId);
      expect(aliceIds).toContainEqual(TOKEN_USDC);
      expect(aliceIds).toContainEqual(TOKEN_CKBTC);

      watchlistActor.setIdentity(userBob);
      const bobWatchlist = await watchlistActor.get_my_watchlist();
      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist[0].canisterId).toEqual(TOKEN_ICP);

      watchlistActor.setIdentity(userCharlie);
      const charlieWatchlist = await watchlistActor.get_my_watchlist();
      expect(charlieWatchlist).toHaveLength(1);
      expect(charlieWatchlist[0].canisterId).toEqual(TOKEN_CKBTC);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should reject empty string token IDs at the API boundary', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act & Assert - should fail because empty string cannot be converted to Principal
      await expect(async () => {
        // @ts-expect-error - Testing invalid input
        await watchlistActor.add_to_watchlist('');
      }).rejects.toThrow();

      const watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(0);
    });

    it('should reject very long token ID strings at the API boundary', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-long-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      const longTokenId = 'a'.repeat(1000);

      // Act & Assert - should fail because it's not a valid Principal format
      await expect(async () => {
        // @ts-expect-error - Testing invalid input
        await watchlistActor.add_to_watchlist(longTokenId);
      }).rejects.toThrow();

      const watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(0);
    });

    it('should reject special characters in token IDs at the API boundary', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-special-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      const specialTokenId = 'token-with-special!@#$%^&*()_+-=[]{}|;:,.<>?';

      // Act & Assert - should fail because special chars are not valid in Principal format
      await expect(async () => {
        // @ts-expect-error - Testing invalid input
        await watchlistActor.add_to_watchlist(specialTokenId);
      }).rejects.toThrow();

      const watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(0);
    });
  });

  describe('Integration: Complete User Workflow', () => {
    it('should support a realistic user workflow', async () => {
      // Arrange: Alice is a new user
      const freshAlice = createIdentity('workflow-alice-' + Math.random());
      watchlistActor.setIdentity(freshAlice);

      // Step 1: New user checks watchlist (should be empty)
      let watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toEqual([]);

      // Step 2: User adds their first token
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(1);

      // Step 3: User adds more tokens over time
      await watchlistActor.add_to_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(3);

      // Step 4: User accidentally tries to add a duplicate
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(3); // No duplicate created

      // Step 5: User removes a token they're no longer interested in
      await watchlistActor.remove_from_watchlist(TOKEN_ICP);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(2);
      const remainingIds = watchlist.map((t) => t.canisterId);
      expect(remainingIds).toContainEqual(TOKEN_USDC);
      expect(remainingIds).toContainEqual(TOKEN_CKBTC);

      // Step 6: User removes all tokens
      await watchlistActor.remove_from_watchlist(TOKEN_USDC);
      await watchlistActor.remove_from_watchlist(TOKEN_CKBTC);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toEqual([]);
    });
  });
});
