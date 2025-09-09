import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { sha256 } from '@noble/hashes/sha2.js';
import { readFile } from 'node:fs/promises';

// --- Import declarations for all necessary canisters ---
import { idlFactory as trackerIdl } from '@declarations/usage_tracker';
import {
  _SERVICE as UsageTrackerService,
  init as trackerInit,
} from '@declarations/usage_tracker/usage_tracker.did.js';

import { idlFactory as aggregatorIdl } from '@declarations/leaderboard';
import {
  _SERVICE as AggregatorService,
  init as aggregatorInit,
} from '@declarations/leaderboard/leaderboard.did.js';

import { idlFactory as serverIdl } from '@declarations/mcp_server';
import {
  _SERVICE as MCPService,
  init as mcpServerInit,
} from '@declarations/mcp_server/mcp_server.did.js';

// --- Wasm Paths ---
const USAGE_TRACKER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/usage_tracker/usage_tracker.wasm',
);
const AGGREGATOR_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/leaderboard/leaderboard.wasm',
);
const MCP_SERVER_DUMMY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_server/mcp_server.wasm',
);

describe('Leaderboard Aggregator Canister', () => {
  let pic: PocketIc;
  let trackerActor: Actor<UsageTrackerService>;
  let trackerCanisterId: Principal;
  let aggregatorActor: Actor<AggregatorService>;
  let aggregatorCanisterId: Principal;

  const ADMIN_IDENTITY: Identity = createIdentity('admin');

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
  });

  // This setup is more complex as it requires deploying multiple canisters
  beforeEach(async () => {
    // 1. Deploy the UsageTracker first
    const trackerFixture = await pic.setupCanister<UsageTrackerService>({
      idlFactory: trackerIdl,
      wasm: USAGE_TRACKER_WASM_PATH,
      sender: ADMIN_IDENTITY.getPrincipal(),
      arg: IDL.encode(trackerInit({ IDL }), []),
    });
    trackerActor = trackerFixture.actor;
    trackerCanisterId = trackerFixture.canisterId;

    // Set the payout canister identity for the tracker
    trackerActor.setIdentity(ADMIN_IDENTITY);
    await trackerActor.set_payout_canister(ADMIN_IDENTITY.getPrincipal());

    // 2. Deploy the LeaderboardAggregator, passing the tracker's ID
    const aggregatorFixture = await pic.setupCanister<AggregatorService>({
      idlFactory: aggregatorIdl,
      wasm: AGGREGATOR_WASM_PATH,
      sender: ADMIN_IDENTITY.getPrincipal(),
      arg: IDL.encode(aggregatorInit({ IDL }), []),
    });
    aggregatorActor = aggregatorFixture.actor;
    aggregatorCanisterId = aggregatorFixture.canisterId;

    // Initialize the aggregator with the tracker's canister ID
    await aggregatorActor.init(trackerCanisterId);
  });

  it('should have empty leaderboards initially', async () => {
    const userBoard = await aggregatorActor.get_user_leaderboard();
    const serverBoard = await aggregatorActor.get_server_leaderboard();

    expect(userBoard).toEqual([]);
    expect(serverBoard).toEqual([]);
  });

  it('should correctly rank servers and users after processing logs', async () => {
    // ARRANGE: Setup two servers and three users with overlapping activity
    const wasm = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
    const serverWasmHash = sha256(wasm);

    // Approve the dummy server Wasm in the tracker
    trackerActor.setIdentity(ADMIN_IDENTITY);
    const approvalRes =
      await trackerActor.add_approved_wasm_hash(serverWasmHash);
    expect(approvalRes).toEqual({ ok: null });

    // Deploy Server A
    const serverAFixture = await pic.setupCanister<MCPService>({
      idlFactory: serverIdl,
      wasm: MCP_SERVER_DUMMY_WASM_PATH,
    });
    const serverAActor = serverAFixture.actor;
    const serverAPrincipal = serverAFixture.canisterId;

    // Deploy Server B
    const serverBFixture = await pic.setupCanister<MCPService>({
      idlFactory: serverIdl,
      wasm: MCP_SERVER_DUMMY_WASM_PATH,
    });
    const serverBActor = serverBFixture.actor;
    const serverBPrincipal = serverBFixture.canisterId;

    // Define users
    const user1 = createIdentity('user1').getPrincipal();
    const user2 = createIdentity('user2').getPrincipal();
    const user3 = createIdentity('user3').getPrincipal();

    // Log data from Server A: User1 (10 calls), User2 (5 calls) -> Total 15
    const callTrackerResA = await serverAActor.call_tracker(trackerCanisterId, {
      start_timestamp_ns: 0n,
      end_timestamp_ns: 1n,
      activity: [
        { caller: user1, tool_id: 'tool', call_count: 10n },
        { caller: user2, tool_id: 'tool', call_count: 5n },
      ],
    });
    expect(callTrackerResA).toEqual({ ok: null });

    // Log data from Server B: User1 (20 calls), User3 (8 calls) -> Total 28
    const callTrackerResB = await serverBActor.call_tracker(trackerCanisterId, {
      start_timestamp_ns: 0n,
      end_timestamp_ns: 1n,
      activity: [
        { caller: user1, tool_id: 'tool', call_count: 20n },
        { caller: user3, tool_id: 'tool', call_count: 8n },
      ],
    });
    expect(callTrackerResB).toEqual({ ok: null });

    // ACT: Trigger the aggregation
    aggregatorActor.setIdentity(ADMIN_IDENTITY);
    const manualUpdateRes = await aggregatorActor.trigger_manual_update();
    // PocketIC processes timers automatically after an update call, but manual trigger is more explicit.
    expect(manualUpdateRes).toEqual({ ok: null });
    // ASSERT: Check the leaderboards

    // ACT: Query the metrics for that server.

    // --- User Leaderboard Assertions ---
    // Expected: User1 (30), User3 (8), User2 (5)
    const userBoard = await aggregatorActor.get_user_leaderboard();
    expect(userBoard).toHaveLength(3);

    // Rank 1: User1
    expect(userBoard[0].rank).toBe(1n);
    expect(userBoard[0].user.toText()).toBe(user1.toText());
    expect(userBoard[0].total_invocations).toBe(30n);

    // Rank 2: User3
    expect(userBoard[1].rank).toBe(2n);
    expect(userBoard[1].user.toText()).toBe(user3.toText());
    expect(userBoard[1].total_invocations).toBe(8n);

    // Rank 3: User2
    expect(userBoard[2].rank).toBe(3n);
    expect(userBoard[2].user.toText()).toBe(user2.toText());
    expect(userBoard[2].total_invocations).toBe(5n);

    // --- Server Leaderboard Assertions ---
    // Expected: Server B (28), Server A (15)
    const serverBoard = await aggregatorActor.get_server_leaderboard();
    expect(serverBoard).toHaveLength(2);

    // Rank 1: Server B
    expect(serverBoard[0].rank).toBe(1n);
    expect(serverBoard[0].server.toText()).toBe(serverBPrincipal.toText());
    expect(serverBoard[0].total_invocations).toBe(28n);

    // Rank 2: Server A
    expect(serverBoard[1].rank).toBe(2n);
    expect(serverBoard[1].server.toText()).toBe(serverAPrincipal.toText());
    expect(serverBoard[1].total_invocations).toBe(15n);
  });

  it('should update automatically via its internal timer', async () => {
    // ARRANGE (Phase 1): Log some initial data.
    const wasm = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
    const serverWasmHash = sha256(wasm);
    trackerActor.setIdentity(ADMIN_IDENTITY);
    await trackerActor.add_approved_wasm_hash(serverWasmHash);

    const serverFixture = await pic.setupCanister<MCPService>({
      idlFactory: serverIdl,
      wasm: MCP_SERVER_DUMMY_WASM_PATH,
    });
    const serverActor = serverFixture.actor;
    const user1 = createIdentity('user1-timer').getPrincipal();

    await serverActor.call_tracker(trackerCanisterId, {
      start_timestamp_ns: 0n,
      end_timestamp_ns: 1n,
      activity: [{ caller: user1, tool_id: 'tool', call_count: 10n }],
    });

    // At this point, the leaderboard should still be empty.
    const initialBoard = await aggregatorActor.get_user_leaderboard();
    expect(initialBoard).toEqual([]);

    // ACT (Phase 1): Advance time past the initial 1-hour timer set in init().
    // PocketIC requires time in milliseconds. 1 hour = 3,600,000 ms.
    await pic.advanceTime(3_600_000 + 1000); // Add a small buffer to ensure we pass the timer
    // We need to make one more call to the IC to process the timer queue.
    await pic.tick();

    // ASSERT (Phase 1): The leaderboard should now be populated by the first automatic update.
    const boardAfterFirstTimer = await aggregatorActor.get_user_leaderboard();
    expect(boardAfterFirstTimer).toHaveLength(1);
    expect(boardAfterFirstTimer[0].user.toText()).toBe(user1.toText());
    expect(boardAfterFirstTimer[0].total_invocations).toBe(10n);

    // ARRANGE (Phase 2): Log new data. This data should not be on the board yet.
    const user2 = createIdentity('user2-timer').getPrincipal();
    await serverActor.call_tracker(trackerCanisterId, {
      start_timestamp_ns: 2n,
      end_timestamp_ns: 3n,
      activity: [{ caller: user2, tool_id: 'tool', call_count: 25n }], // User2 is now the leader
    });

    // ACT (Phase 2): Advance time past the recurring 1-hour timer.
    // 1 hour = 3,600 seconds = 3,600,000 ms.
    await pic.advanceTime(3_600_000);
    await pic.tick();

    // ASSERT (Phase 2): The leaderboard should be updated and re-ranked.
    const boardAfterSecondTimer = await aggregatorActor.get_user_leaderboard();
    expect(boardAfterSecondTimer).toHaveLength(2);

    // Rank 1 should now be User2
    expect(boardAfterSecondTimer[0].rank).toBe(1n);
    expect(boardAfterSecondTimer[0].user.toText()).toBe(user2.toText());
    expect(boardAfterSecondTimer[0].total_invocations).toBe(25n);

    // Rank 2 should be User1
    expect(boardAfterSecondTimer[1].rank).toBe(2n);
    expect(boardAfterSecondTimer[1].user.toText()).toBe(user1.toText());
    expect(boardAfterSecondTimer[1].total_invocations).toBe(10n);
  });
});
