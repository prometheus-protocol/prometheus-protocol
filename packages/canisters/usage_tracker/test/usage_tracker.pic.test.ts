import path from 'node:path';
import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
import { Identity } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
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
  });
});
