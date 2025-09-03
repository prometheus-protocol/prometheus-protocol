// import path from 'node:path';
// import { Actor, PocketIc, createIdentity } from '@dfinity/pic';
// import { Principal } from '@dfinity/principal';
// import { describe, beforeAll, it, expect, inject, beforeEach } from 'vitest';
// import { AnonymousIdentity, Identity } from '@dfinity/agent';
// import { IDL } from '@dfinity/candid';
// import { sha256 } from '@noble/hashes/sha2.js';
// import { readFile } from 'node:fs/promises';

// // --- Import declarations for the new canister ---
// import { idlFactory as trackerIdl } from '@declarations/usage_tracker';
// import {
//   _SERVICE as UsageTrackerService,
//   UsageStats,
//   CallerActivity,
//   init,
// } from '@declarations/usage_tracker/usage_tracker.did.js';

// import { idlFactory as serverIdl } from '@declarations/mcp_server';
// import { init as mcpServerInit } from '@declarations/mcp_server/mcp_server.did.js';

// const USAGE_TRACKER_WASM_PATH = path.resolve(
//   __dirname,
//   '../../../../',
//   '.dfx/local/canisters/usage_tracker/usage_tracker.wasm',
// );

// const MCP_SERVER_DUMMY_WASM_PATH = path.resolve(
//   __dirname,
//   '../../../../',
//   '.dfx/local/canisters/mcp_server/mcp_server.wasm',
// );

// describe('Usage Tracker Canister (Wasm Hash Allowlist)', () => {
//   let pic: PocketIc;
//   let trackerActor: Actor<UsageTrackerService>;
//   let trackerCanisterId: Principal;

//   const ADMIN_IDENTITY: Identity = createIdentity('admin');
//   const PAYOUT_CANISTER_IDENTITY: Identity = createIdentity('payout-canister');

//   beforeAll(async () => {
//     const url = inject('PIC_URL');
//     pic = await PocketIc.create(url);
//   });

//   beforeEach(async () => {
//     const fixture = await pic.setupCanister<UsageTrackerService>({
//       idlFactory: trackerIdl,
//       wasm: USAGE_TRACKER_WASM_PATH,
//       sender: ADMIN_IDENTITY.getPrincipal(),
//       arg: IDL.encode(init({ IDL }), []),
//     });
//     trackerActor = fixture.actor;
//     trackerCanisterId = fixture.canisterId;
//   });

//   describe('log_call Method (Wasm Verification)', () => {
//     let serverActor: Actor<any>;
//     let serverPrincipal: Principal;
//     let serverWasmHash: Uint8Array;

//     beforeEach(async () => {
//       // Deploy a fresh dummy server for each test
//       const serverFixture = await pic.setupCanister({
//         idlFactory: serverIdl,
//         wasm: MCP_SERVER_DUMMY_WASM_PATH,
//         sender: ADMIN_IDENTITY.getPrincipal(),
//         arg: IDL.encode(mcpServerInit({ IDL }), []),
//       });
//       serverActor = serverFixture.actor;
//       serverPrincipal = serverFixture.canisterId;

//       // Get the Wasm hash for this canister
//       const wasm = await readFile(MCP_SERVER_DUMMY_WASM_PATH);
//       serverWasmHash = sha256(wasm);
//     });

//     it('should REJECT a log from a canister whose Wasm hash is not on the allowlist', async () => {
//       // The serverActor will call the trackerActor
//       // We need a method on the dummy server like `callTracker(trackerId, stats)`
//       await expect(
//         serverActor.callTracker(trackerCanisterId, {
//           /* stats */
//         }),
//       ).rejects.toThrow(/Wasm hash not approved/);
//     });

//     it("should ACCEPT a log after the canister's Wasm hash is added to the allowlist", async () => {
//       // Step 1: Admin adds the server's Wasm hash to the allowlist
//       trackerActor.setIdentity(ADMIN_IDENTITY);
//       await trackerActor.add_approved_wasm_hash(serverWasmHash);

//       // Step 2: The server canister calls the tracker
//       // This should now succeed
//       await serverActor.callTracker(trackerCanisterId, {
//         /* stats */
//       });

//       // Verify state
//       trackerActor.setIdentity(PAYOUT_CANISTER_IDENTITY);
//       const logs = await trackerActor.get_and_clear_logs();
//       expect(logs).toHaveProperty('Ok');
//       // @ts-ignore
//       expect(logs['Ok']).toHaveLength(1);
//       // @ts-ignore
//       expect(logs['Ok'][0].server_id.toText()).toBe(serverPrincipal.toText());
//     });

//     it('should REJECT a log from a canister after its Wasm hash is removed', async () => {
//       // Add and then remove the hash
//       trackerActor.setIdentity(ADMIN_IDENTITY);
//       await trackerActor.add_approved_wasm_hash(serverWasmHash);
//       await trackerActor.remove_approved_wasm_hash(serverWasmHash);

//       await expect(
//         serverActor.callTracker(trackerCanisterId, {
//           /* stats */
//         }),
//       ).rejects.toThrow(/Wasm hash not approved/);
//     });
//   });
// });
