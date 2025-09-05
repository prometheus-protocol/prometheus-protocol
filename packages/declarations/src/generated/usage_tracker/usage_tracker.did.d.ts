import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface CallerActivity {
  'call_count' : bigint,
  'tool_id' : string,
  'caller' : Principal,
}
export interface LogEntry {
  'server_id' : Principal,
  'stats' : UsageStats,
  'timestamp' : Time,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : Array<LogEntry> } |
  { 'err' : string };
export interface ServerMetricsShared {
  'total_invocations' : bigint,
  'invocations_by_tool' : Array<[string, bigint]>,
  'invocations_by_user' : Array<[Principal, bigint]>,
}
export type Time = bigint;
export interface UsageStats {
  'start_timestamp_ns' : Time,
  'end_timestamp_ns' : Time,
  'activity' : Array<CallerActivity>,
}
export interface UsageTracker {
  'add_approved_wasm_hash' : ActorMethod<[Uint8Array | number[]], Result>,
  'get_admin' : ActorMethod<[], Principal>,
  'get_and_clear_logs' : ActorMethod<[], Result_1>,
  'get_metrics_for_server' : ActorMethod<
    [Principal],
    [] | [ServerMetricsShared]
  >,
  'get_payout_canister' : ActorMethod<[], [] | [Principal]>,
  'is_wasm_hash_approved' : ActorMethod<[Uint8Array | number[]], boolean>,
  'log_call' : ActorMethod<[UsageStats], Result>,
  'remove_approved_wasm_hash' : ActorMethod<[Uint8Array | number[]], Result>,
  'set_payout_canister' : ActorMethod<[Principal], Result>,
  'transfer_admin' : ActorMethod<[Principal], Result>,
}
export interface _SERVICE extends UsageTracker {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
