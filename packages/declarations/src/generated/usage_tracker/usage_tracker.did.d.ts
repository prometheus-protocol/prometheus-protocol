import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AppMetrics {
  'authenticated_unique_users' : bigint,
  'total_invocations' : bigint,
  'anonymous_invocations' : bigint,
  'total_tools' : bigint,
}
export interface CallerActivity {
  'call_count' : bigint,
  'tool_id' : string,
  'caller' : Principal,
}
export interface LogEntry {
  'canister_id' : Principal,
  'stats' : UsageStats,
  'wasm_id' : string,
  'timestamp' : Time,
}
export interface NamespaceMetrics {
  'authenticated_unique_users' : bigint,
  'total_invocations' : bigint,
  'anonymous_invocations' : bigint,
  'total_instances' : bigint,
  'total_tools' : bigint,
  'namespace' : string,
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
  'add_approved_wasm_hash' : ActorMethod<[string], Result>,
  'get_all_server_metrics' : ActorMethod<
    [],
    Array<[string, ServerMetricsShared]>
  >,
  'get_and_clear_logs' : ActorMethod<[], Result_1>,
  'get_app_metrics' : ActorMethod<[Principal], [] | [AppMetrics]>,
  'get_metrics_for_server' : ActorMethod<[string], [] | [ServerMetricsShared]>,
  'get_namespace_metrics' : ActorMethod<[string], [] | [NamespaceMetrics]>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_payout_canister' : ActorMethod<[], [] | [Principal]>,
  'is_wasm_hash_approved' : ActorMethod<[string], boolean>,
  'log_call' : ActorMethod<[UsageStats], Result>,
  'register_canister_namespace' : ActorMethod<[Principal, string], Result>,
  'remove_approved_wasm_hash' : ActorMethod<[string], Result>,
  'seed_log' : ActorMethod<[Principal, string, UsageStats], Result>,
  'set_orchestrator_canister' : ActorMethod<[Principal], Result>,
  'set_owner' : ActorMethod<[Principal], Result>,
  'set_payout_canister' : ActorMethod<[Principal], Result>,
  'set_registry_canister' : ActorMethod<[Principal], Result>,
}
export interface _SERVICE extends UsageTracker {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
