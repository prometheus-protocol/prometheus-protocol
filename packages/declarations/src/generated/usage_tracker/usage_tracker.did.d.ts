import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

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
export interface EnvConfig {
  'key' : string,
  'value_type' : string,
  'setter' : string,
  'required' : boolean,
  'current_value' : [] | [string],
}
export interface EnvDependency {
  'key' : string,
  'setter' : string,
  'required' : boolean,
  'canister_name' : string,
  'current_value' : [] | [Principal],
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
export interface NamespaceMetricsDetailed {
  'tools' : Array<ToolMetrics>,
  'authenticated_unique_users' : bigint,
  'total_invocations' : bigint,
  'anonymous_invocations' : bigint,
  'total_instances' : bigint,
  'namespace' : string,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : string } |
  { 'err' : string };
export type Result_2 = { 'ok' : Array<LogEntry> } |
  { 'err' : string };
export interface ServerMetricsShared {
  'total_invocations' : bigint,
  'invocations_by_tool' : Array<[string, bigint]>,
  'invocations_by_user' : Array<[Principal, bigint]>,
}
export type Time = bigint;
export interface ToolMetrics {
  'total_invocations' : bigint,
  'tool_id' : string,
}
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
  'get_and_clear_logs' : ActorMethod<[], Result_2>,
  'get_app_metrics' : ActorMethod<[Principal], [] | [AppMetrics]>,
  'get_env_requirements' : ActorMethod<
    [],
    {
        'v1' : {
          'dependencies' : Array<EnvDependency>,
          'configuration' : Array<EnvConfig>,
        }
      }
  >,
  'get_metrics_for_server' : ActorMethod<[string], [] | [ServerMetricsShared]>,
  'get_namespace_metrics' : ActorMethod<[string], [] | [NamespaceMetrics]>,
  /**
   * / * Get detailed namespace metrics including per-tool invocation counts.
   * /    * Returns aggregated tool usage across all WASM versions of the namespace.
   */
  'get_namespace_metrics_detailed' : ActorMethod<
    [string],
    [] | [NamespaceMetricsDetailed]
  >,
  /**
   * / * Get tool invocations for a specific namespace.
   * /    * Returns an array of tools with their aggregated invocation counts.
   */
  'get_namespace_tools' : ActorMethod<[string], Array<ToolMetrics>>,
  /**
   * / * Gets all WASM IDs currently registered for a namespace.
   */
  'get_namespace_wasms' : ActorMethod<[string], Array<string>>,
  'get_owner' : ActorMethod<[], Principal>,
  'get_payout_canister' : ActorMethod<[], [] | [Principal]>,
  'is_wasm_hash_approved' : ActorMethod<[string], boolean>,
  /**
   * / * Lists all WASM IDs that have historical data in aggregated_metrics.
   * /    * This is useful for discovering which historical WASMs can be registered with namespaces.
   */
  'list_all_wasm_ids' : ActorMethod<[], Array<[string, bigint, bigint]>>,
  'log_call' : ActorMethod<[UsageStats], Result>,
  /**
   * / * Rebuilds the namespace_to_wasms mapping from existing canister_to_wasm and canister_to_namespace data.
   * /    * This is useful for migrating existing data or recovering from data inconsistencies.
   * /    * Should be called by the owner after upgrading to ensure all historical WASMs are tracked.
   */
  'rebuild_namespace_wasm_mappings' : ActorMethod<[], Result_1>,
  /**
   * / * Registers the namespace for a canister. This should be called by the orchestrator
   * /    * when a new canister is provisioned or when an existing canister is upgraded.
   */
  'register_canister_namespace' : ActorMethod<[Principal, string], Result>,
  /**
   * / * Manually registers a historical WASM ID with a namespace.
   * /    * This is useful for recovering historical data from WASM versions that are no longer active.
   * /    *
   * /    * Use case: If a canister was upgraded from v1 (wasm_id_1) to v2 (wasm_id_2), and you want to
   * /    * include the v1 users in the namespace metrics, call this function with wasm_id_1.
   * /    *
   * /    * The WASM ID must exist in aggregated_metrics (meaning it has historical usage data).
   */
  'register_historical_wasm' : ActorMethod<[string, string], Result_1>,
  'remove_approved_wasm_hash' : ActorMethod<[string], Result>,
  'seed_log' : ActorMethod<[Principal, string, UsageStats], Result>,
  'set_orchestrator_canister' : ActorMethod<[Principal], Result>,
  'set_owner' : ActorMethod<[Principal], Result>,
  'set_payout_canister' : ActorMethod<[Principal], Result>,
  'set_registry_canister' : ActorMethod<[Principal], Result>,
}
/**
 * / * The UsageTracker canister serves as a high-throughput logbook for the "Proof-of-Use" system.
 * /  * It accepts usage statistics from approved MCP server canisters and makes them available to a designated payout canister.
 */
export interface _SERVICE extends UsageTracker {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
