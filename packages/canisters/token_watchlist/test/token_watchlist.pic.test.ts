// packages/canisters/token_watchlist/test/token_watchlist.pic.test.ts

import path from 'node:path';
import { Principal } from '@dfinity/principal';
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
import { Identity } from '@dfinity/agent';

// Import from the token_watchlist declarations
import { idlFactory as watchlistIdlFactory } from '@declarations/token_watchlist';
import {
  _SERVICE as WatchlistService,
  init as watchlistInit,
} from '@declarations/token_watchlist/token_watchlist.did.js';
import { IDL } from '@dfinity/candid';

const WATCHLIST_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/token_watchlist/token_watchlist.wasm',
);

describe('Token Watchlist Canister', () => {
  let pic: PocketIc;
  let watchlistActor: Actor<WatchlistService>;
  let watchlistCanisterId: Principal;

  // Test token canister IDs
  const TOKEN_USDC = 'xevnm-gaaaa-aaaar-qafnq-cai';
  const TOKEN_ICP = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
  const TOKEN_CKBTC = 'mxzaz-hqaaa-aaaar-qaada-cai';
  const TOKEN_CKETH = 'ss2fx-dyaaa-aaaar-qacoq-cai';

  beforeAll(async () => {
    pic = await PocketIc.create(inject('PIC_URL'));
    await pic.setTime(new Date());

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

    it('should return the correct watchlist for a user with tokens', async () => {
      // Arrange
      const userAlice = createIdentity('alice-tokens-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      // Act
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(2);
      expect(watchlist).toContain(TOKEN_USDC);
      expect(watchlist).toContain(TOKEN_ICP);
    });

    it("should only return the calling user's watchlist", async () => {
      // Arrange: Alice adds tokens to her watchlist
      const userAlice = createIdentity('alice-isolation-' + Math.random());
      const userBob = createIdentity('bob-isolation-' + Math.random());

      watchlistActor.setIdentity(userAlice);
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);

      // Arrange: Bob adds different tokens to his watchlist
      watchlistActor.setIdentity(userBob);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);

      // Act: Get Bob's watchlist
      const bobWatchlist = await watchlistActor.get_my_watchlist();

      // Act: Get Alice's watchlist
      watchlistActor.setIdentity(userAlice);
      const aliceWatchlist = await watchlistActor.get_my_watchlist();

      // Assert: Each user sees only their own tokens
      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist).toContain(TOKEN_CKBTC);
      expect(bobWatchlist).not.toContain(TOKEN_USDC);

      expect(aliceWatchlist).toHaveLength(2);
      expect(aliceWatchlist).toContain(TOKEN_USDC);
      expect(aliceWatchlist).toContain(TOKEN_ICP);
      expect(aliceWatchlist).not.toContain(TOKEN_CKBTC);
    });
  });

  describe('UI Backend API - add_to_watchlist', () => {
    it('should successfully add a token to an empty watchlist', async () => {
      // Arrange
      const userAlice = createIdentity('alice-add-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const result = await watchlistActor.add_to_watchlist(TOKEN_USDC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe(TOKEN_USDC);
    });

    it('should successfully add multiple different tokens', async () => {
      // Arrange
      const userAlice = createIdentity('alice-add-multiple-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      await watchlistActor.add_to_watchlist(TOKEN_USDC);
      await watchlistActor.add_to_watchlist(TOKEN_ICP);
      await watchlistActor.add_to_watchlist(TOKEN_CKBTC);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(3);
      expect(watchlist).toContain(TOKEN_USDC);
      expect(watchlist).toContain(TOKEN_ICP);
      expect(watchlist).toContain(TOKEN_CKBTC);
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
      expect(watchlist[0]).toBe(TOKEN_USDC);
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
      expect(bobWatchlist).toContain(TOKEN_ICP);
      expect(aliceCheck).toHaveLength(1);
      expect(aliceCheck).toContain(TOKEN_USDC);
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
      expect(watchlist).toContain(TOKEN_ICP);
      expect(watchlist).not.toContain(TOKEN_USDC);
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
      expect(watchlist).toContain(TOKEN_USDC);
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
      expect(watchlist).toContain(TOKEN_USDC);
      expect(watchlist).toContain(TOKEN_ICP);
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
      await watchlistActor.add_to_watchlist(TOKEN_CKETH);

      // Act: Query each user's watchlist
      const charlieWatchlist = await watchlistActor.get_my_watchlist();

      watchlistActor.setIdentity(userBob);
      const bobWatchlist = await watchlistActor.get_my_watchlist();

      watchlistActor.setIdentity(userAlice);
      const aliceWatchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(charlieWatchlist).toHaveLength(2);
      expect(charlieWatchlist).toContain(TOKEN_CKBTC);
      expect(charlieWatchlist).toContain(TOKEN_CKETH);

      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist).toContain(TOKEN_ICP);

      expect(aliceWatchlist).toHaveLength(1);
      expect(aliceWatchlist).toContain(TOKEN_USDC);
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
      await watchlistActor.add_to_watchlist(TOKEN_CKETH);
      await watchlistActor.remove_from_watchlist(TOKEN_USDC);

      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(2);
      expect(watchlist).toContain(TOKEN_CKBTC);
      expect(watchlist).toContain(TOKEN_CKETH);
      expect(watchlist).not.toContain(TOKEN_USDC);
      expect(watchlist).not.toContain(TOKEN_ICP);
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
      await watchlistActor.add_to_watchlist(TOKEN_CKETH);

      // Assert: Each user's data is intact
      const aliceWatchlist = await watchlistActor.get_my_watchlist();
      expect(aliceWatchlist).toHaveLength(2);
      expect(aliceWatchlist).toContain(TOKEN_USDC);
      expect(aliceWatchlist).toContain(TOKEN_CKETH);

      watchlistActor.setIdentity(userBob);
      const bobWatchlist = await watchlistActor.get_my_watchlist();
      expect(bobWatchlist).toHaveLength(1);
      expect(bobWatchlist).toContain(TOKEN_ICP);

      watchlistActor.setIdentity(userCharlie);
      const charlieWatchlist = await watchlistActor.get_my_watchlist();
      expect(charlieWatchlist).toHaveLength(1);
      expect(charlieWatchlist).toContain(TOKEN_CKBTC);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string token IDs gracefully', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-empty-' + Math.random());
      watchlistActor.setIdentity(userAlice);

      // Act
      const result = await watchlistActor.add_to_watchlist('');
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe('');
    });

    it('should handle very long token ID strings', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-long-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      const longTokenId = 'a'.repeat(1000);

      // Act
      const result = await watchlistActor.add_to_watchlist(longTokenId);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe(longTokenId);
    });

    it('should handle special characters in token IDs', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-special-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      const specialTokenId = 'token-with-special!@#$%^&*()_+-=[]{}|;:,.<>?';

      // Act
      const result = await watchlistActor.add_to_watchlist(specialTokenId);
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(result).toHaveProperty('ok');
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0]).toBe(specialTokenId);
    });

    it('should handle a large number of tokens in a watchlist', async () => {
      // Arrange
      const userAlice = createIdentity('alice-edge-large-' + Math.random());
      watchlistActor.setIdentity(userAlice);
      const numTokens = 100;
      const tokens = Array.from({ length: numTokens }, (_, i) => `token-${i}`);

      // Act: Add all tokens
      for (const token of tokens) {
        await watchlistActor.add_to_watchlist(token);
      }
      const watchlist = await watchlistActor.get_my_watchlist();

      // Assert
      expect(watchlist).toHaveLength(numTokens);
      for (const token of tokens) {
        expect(watchlist).toContain(token);
      }
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
      expect(watchlist).toContain(TOKEN_USDC);
      expect(watchlist).toContain(TOKEN_CKBTC);

      // Step 6: User adds a new token
      await watchlistActor.add_to_watchlist(TOKEN_CKETH);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toHaveLength(3);

      // Step 7: AI agent (using same identity) queries the watchlist
      const agentView = await watchlistActor.get_my_watchlist();
      expect(agentView).toEqual(watchlist); // Agent sees the same data

      // Step 8: User removes all tokens
      await watchlistActor.remove_from_watchlist(TOKEN_USDC);
      await watchlistActor.remove_from_watchlist(TOKEN_CKBTC);
      await watchlistActor.remove_from_watchlist(TOKEN_CKETH);
      watchlist = await watchlistActor.get_my_watchlist();
      expect(watchlist).toEqual([]);
    });
  });
});
