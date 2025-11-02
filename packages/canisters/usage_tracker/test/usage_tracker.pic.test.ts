import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@icp-sdk/core/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { Identity } from '@icp-sdk/core/agent';
import { IDL } from '@icp-sdk/core/candid';
import { sha256 } from '@noble/hashes/sha2.js';
import { readFile } from 'node:fs/promises';

// --- Import declarations for the new canister ---
import { idlFactory as trackerIdl } from '@declarations/usage_tracker';
import {
  _SERVICE as UsageTrackerService,
  init,
} from '@declarations/usage_tracker/usage_tracker.did.js';

import { idlFactory as serverIdl } from '@declarations/mcp_server';
import { init as mcpServerInit } from '@declarations/mcp_server/mcp_server.did.js';

const USAGE_TRACKER_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/usage_tracker/usage_tracker.wasm',
);

const MCP_SERVER_DUMMY_WASM_PATH = path.resolve(
  __dirname,
  '../../../../',
  '.dfx/local/canisters/mcp_server/mcp_server.wasm',
);

describe('Usage Tracker Canister (Wasm Hash Allowlist)', () => {
  let pic: PocketIc;
  let trackerActor: Actor<UsageTrackerService>;
  let trackerCanisterId: Principal;

  const ADMIN_IDENTITY: Identity = createIdentity('admin');
  const PAYOUT_CANISTER_IDENTITY: Identity = createIdentity('payout-canister');

  beforeAll(async () => {
    const url = inject('PIC_URL');
    pic = await PocketIc.create(url);
  });

  beforeEach(async () => {
    const fixture = await pic.setupCanister<UsageTrackerService>({
      idlFactory: trackerIdl,
      wasm: USAGE_TRACKER_WASM_PATH,
      sender: ADMIN_IDENTITY.getPrincipal(),
      arg: IDL.encode(init({ IDL }), []),
    });
    trackerActor = fixture.actor;
    trackerCanisterId = fixture.canisterId;
  });

  describe('log_call Method (Wasm Verification)', () => {
    let serverActor: Actor<any>;
    let serverPrincipal: Principal;
    let serverWasmHash: Uint8Array;

    beforeEach(async () => {
      // Deploy a fresh dummy server for each test
      const serverFixture = await pic.setupCanister({
        idlFactory: serverIdl,
        wasm: MCP_SERVER_DUMMY_WASM_PATH,
        sender: ADMIN_IDENTITY.getPrincipal(),
        arg: IDL.encode(mcpServerInit({ IDL }), [[]]),
      });
      serverActor = serverFixture.actor;
      serverPrincipal = serverFixture.canisterId;

      // Get the Wasm hash for this canister
      const wasm = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
      serverWasmHash = sha256(wasm);

      // Set the payout canister identity for the tracker
      trackerActor.setIdentity(ADMIN_IDENTITY);
      await trackerActor.set_payout_canister(
        PAYOUT_CANISTER_IDENTITY.getPrincipal(),
      );
    });

    it('should REJECT a log from a canister whose Wasm hash is not on the allowlist', async () => {
      // The serverActor will call the trackerActor
      // We need a method on the dummy server like `call_tracker(trackerId, stats)`
      const res = await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [],
      });

      expect(res).toHaveProperty('err');
      expect(res.err).toMatch(
        /Wasm hash not approved. The canister is not authorized to submit logs./,
      );
    });

    it("should ACCEPT a log after the canister's Wasm hash is added to the allowlist", async () => {
      // Step 1: Admin adds the server's Wasm hash to the allowlist
      trackerActor.setIdentity(ADMIN_IDENTITY);
      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);

      // Step 2: The server canister calls the tracker
      // This should now succeed
      await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [
          {
            caller: Principal.fromText('aaaaa-aa'),
            tool_id: 'example_tool',
            call_count: 1,
          },
        ],
      });

      // Verify state
      trackerActor.setIdentity(PAYOUT_CANISTER_IDENTITY);
      const logs = await trackerActor.get_and_clear_logs();

      expect(logs).toHaveProperty('ok');
      // @ts-ignore
      expect(logs.ok).toHaveLength(1);
      // @ts-ignore
      expect(logs.ok[0].canister_id.toText()).toBe(serverPrincipal.toText());
    });

    it('should REJECT a log from a canister after its Wasm hash is removed', async () => {
      // Add and then remove the hash
      trackerActor.setIdentity(ADMIN_IDENTITY);
      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);
      await trackerActor.remove_approved_wasm_hash(serverHashId);

      const res = await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [],
      });

      expect(res).toHaveProperty('err');
      expect(res.err).toMatch(
        /Wasm hash not approved. The canister is not authorized to submit logs./,
      );
    });
  });

  // Test block for public query methods
  describe('Public Queries', () => {
    let serverActor: Actor<any>;
    let serverPrincipal: Principal;
    let serverWasmHash: Uint8Array;

    beforeEach(async () => {
      const serverFixture = await pic.setupCanister({
        idlFactory: serverIdl,
        wasm: MCP_SERVER_DUMMY_WASM_PATH,
        sender: ADMIN_IDENTITY.getPrincipal(),
        arg: IDL.encode(mcpServerInit({ IDL }), [[]]),
      });
      serverActor = serverFixture.actor;
      serverPrincipal = serverFixture.canisterId;
      const wasm = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
      serverWasmHash = sha256(wasm);
    });

    it('should return empty for a server that has not logged data', async () => {
      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      const metrics = await trackerActor.get_metrics_for_server(serverHashId);
      // Motoko's `?T` (Option<T>) is represented as `[]` (empty array) in candid.js
      expect(metrics).toEqual([]);
    });

    it('should return correct server metrics after a log has been processed', async () => {
      // ARRANGE: Approve the server and have it log some data.
      trackerActor.setIdentity(ADMIN_IDENTITY);
      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);

      const userPrincipal = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');
      const toolId = 'example_tool';
      const callCount = 5n;

      await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [
          {
            caller: userPrincipal,
            tool_id: toolId,
            call_count: callCount,
          },
        ],
      });

      // ACT: Query the metrics for that server.
      const metricsResult =
        await trackerActor.get_metrics_for_server(serverHashId);

      // ASSERT: Check the returned data.
      expect(metricsResult).not.toEqual([]); // It should return a value
      const metrics = metricsResult[0]; // Unpack the option

      expect(metrics).toBeDefined();
      expect(metrics?.total_invocations).toBe(callCount);

      // Check invocations_by_user (array of [Principal, Nat])
      expect(metrics?.invocations_by_user).toHaveLength(1);
      const userMetric = metrics?.invocations_by_user[0];

      expect(userMetric).toBeDefined();
      expect(userMetric![0].toText()).toBe(userPrincipal.toText());
      expect(userMetric![1]).toBe(callCount);

      // Check invocations_by_tool (array of [Text, Nat])
      expect(metrics).toBeDefined();
      expect(metrics!.invocations_by_tool).toHaveLength(1);
      const toolMetric = metrics!.invocations_by_tool[0];
      expect(toolMetric[0]).toBe(toolId);
      expect(toolMetric[1]).toBe(callCount);
    });

    // In describe('Public Queries', ...), after the existing 'it' block...

    it('should return correct app metrics by canister_id after a log has been processed', async () => {
      // ARRANGE: Approve the server and prepare complex activity data.
      trackerActor.setIdentity(ADMIN_IDENTITY);
      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);

      const user1 = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');
      const user2 = Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai');
      const anon1 = Principal.fromText('aaaaa-aa'); // Anonymous user

      // Have the server log activity from 2 users across 2 different tools.
      await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [
          {
            caller: user1,
            tool_id: 'tool_A',
            call_count: 5n,
          },
          {
            caller: user1,
            tool_id: 'tool_B',
            call_count: 3n,
          },
          {
            caller: user2,
            tool_id: 'tool_A',
            call_count: 10n,
          },
          {
            caller: anon1,
            tool_id: 'tool_B',
            call_count: 7n,
          },
        ],
      });

      // ACT: Query the new app-specific metrics using the server's canister ID.
      const metricsResult = await trackerActor.get_app_metrics(serverPrincipal);

      // ASSERT: Check the returned data.
      expect(metricsResult).not.toEqual([]); // It should return a value
      const metrics = metricsResult[0]; // Unpack the option

      expect(metrics).toBeDefined();
      // Total invocations should be the sum of all call counts (5 + 3 + 10)
      expect(metrics?.total_invocations).toBe(25n);
      // There were 2 unique user principals
      expect(metrics?.authenticated_unique_users).toBe(2n);
      // There were 2 unique tool IDs ('tool_A' and 'tool_B')
      expect(metrics?.anonymous_invocations).toBe(7n);
      expect(metrics?.total_tools).toBe(2n);
    });

    it('should correctly aggregate unique users across multiple app versions (namespace metrics)', async () => {
      // ARRANGE: Deploy two server canisters with different WASM hashes (simulating v1 and v2)
      trackerActor.setIdentity(ADMIN_IDENTITY);

      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);

      // Deploy a second server (same code, but represents different version)
      const server2Fixture = await pic.setupCanister({
        idlFactory: serverIdl,
        wasm: MCP_SERVER_DUMMY_WASM_PATH,
        sender: ADMIN_IDENTITY.getPrincipal(),
        arg: IDL.encode(mcpServerInit({ IDL }), [[]]),
      });
      const server2Actor = server2Fixture.actor;
      const server2Principal = server2Fixture.canisterId;

      // Register both canisters to the same namespace
      const testNamespace = 'test-app';
      await trackerActor.register_canister_namespace(
        serverPrincipal,
        testNamespace,
      );
      await trackerActor.register_canister_namespace(
        server2Principal,
        testNamespace,
      );

      // Define test users - user1 and user2 use both versions, user3 only uses v1
      const user1 = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');
      const user2 = Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai');
      const user3 = Principal.fromText('renrk-eyaaa-aaaaa-aaada-cai');

      // Server 1 (v1): user1, user2, and user3 use it
      await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [
          { caller: user1, tool_id: 'tool_A', call_count: 5n },
          { caller: user2, tool_id: 'tool_B', call_count: 3n },
          { caller: user3, tool_id: 'tool_A', call_count: 2n },
        ],
      });

      // Server 2 (v2): user1 and user2 also use this version (should NOT double-count)
      await server2Actor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: [
          { caller: user1, tool_id: 'tool_C', call_count: 7n },
          { caller: user2, tool_id: 'tool_C', call_count: 4n },
        ],
      });

      // ACT: Query namespace-level metrics
      const namespaceMetrics =
        await trackerActor.get_namespace_metrics(testNamespace);

      // ASSERT: Check that unique users are counted correctly
      expect(namespaceMetrics).not.toEqual([]);
      const metrics = namespaceMetrics[0];

      expect(metrics).toBeDefined();
      // Should have 3 unique authenticated users (user1, user2, user3) - NOT 5!
      expect(metrics?.authenticated_unique_users).toBe(3n);
      // Total invocations should be sum of all calls: 5 + 3 + 2 + 7 + 4 = 21
      expect(metrics?.total_invocations).toBe(21n);
      // Should have 3 unique tools across all versions
      expect(metrics?.total_tools).toBe(3n);
      // Should have 2 instances (2 canister deployments)
      expect(metrics?.total_instances).toBe(2n);
    });

    it('should preserve Genesis Users count when a canister is upgraded to a new version', async () => {
      // ARRANGE: Setup and log activity with version 1
      trackerActor.setIdentity(ADMIN_IDENTITY);

      const serverHashId = Buffer.from(serverWasmHash).toString('hex');
      await trackerActor.add_approved_wasm_hash(serverHashId);

      const testNamespace = 'upgraded-app';
      await trackerActor.register_canister_namespace(
        serverPrincipal,
        testNamespace,
      );

      // Define 5 genesis users (using valid principal IDs)
      const users = [
        Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai'),
        Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai'),
        Principal.fromText('renrk-eyaaa-aaaaa-aaada-cai'),
        Principal.fromText('rwlgt-iiaaa-aaaaa-aaaaa-cai'),
        Principal.fromText('rno2w-sqaaa-aaaaa-aaacq-cai'),
      ];

      // V1: 5 users use the original version
      await serverActor.call_tracker(trackerCanisterId, {
        start_timestamp_ns: 0n,
        end_timestamp_ns: 1_000_000n,
        activity: users.map((user, i) => ({
          caller: user,
          tool_id: 'tool_A',
          call_count: BigInt(i + 1),
        })),
      });

      // Check metrics after v1
      let namespaceMetrics =
        await trackerActor.get_namespace_metrics(testNamespace);
      expect(namespaceMetrics[0]?.authenticated_unique_users).toBe(5n);

      // ACT: Simulate upgrading the canister to v2 (different WASM)
      // We'll use a seed_log call with a different wasm_id to simulate this
      const v2WasmId =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      await trackerActor.add_approved_wasm_hash(v2WasmId);

      // Simulate v2 usage (only 2 of the original users use the new version)
      await trackerActor.seed_log(serverPrincipal, v2WasmId, {
        start_timestamp_ns: 1_000_000n,
        end_timestamp_ns: 2_000_000n,
        activity: [
          { caller: users[0], tool_id: 'tool_B', call_count: 3n },
          { caller: users[1], tool_id: 'tool_B', call_count: 4n },
        ],
      });

      // ASSERT: Genesis Users should STILL be 5, not reset to 2!
      namespaceMetrics =
        await trackerActor.get_namespace_metrics(testNamespace);
      const metrics = namespaceMetrics[0];

      expect(metrics).toBeDefined();
      // Should STILL have all 5 genesis users from v1, not just the 2 from v2
      expect(metrics?.authenticated_unique_users).toBe(5n);
      // Total invocations should be: (1+2+3+4+5) from v1 + (3+4) from v2 = 22
      expect(metrics?.total_invocations).toBe(22n);
    });
  });
});
