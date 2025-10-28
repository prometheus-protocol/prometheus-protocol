export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const ServerMetricsShared = IDL.Record({
    'total_invocations' : IDL.Nat,
    'invocations_by_tool' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)),
    'invocations_by_user' : IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
  });
  const Time = IDL.Int;
  const CallerActivity = IDL.Record({
    'call_count' : IDL.Nat,
    'tool_id' : IDL.Text,
    'caller' : IDL.Principal,
  });
  const UsageStats = IDL.Record({
    'start_timestamp_ns' : Time,
    'end_timestamp_ns' : Time,
    'activity' : IDL.Vec(CallerActivity),
  });
  const LogEntry = IDL.Record({
    'canister_id' : IDL.Principal,
    'stats' : UsageStats,
    'wasm_id' : IDL.Text,
    'timestamp' : Time,
  });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Vec(LogEntry), 'err' : IDL.Text });
  const AppMetrics = IDL.Record({
    'authenticated_unique_users' : IDL.Nat,
    'total_invocations' : IDL.Nat,
    'anonymous_invocations' : IDL.Nat,
    'total_tools' : IDL.Nat,
  });
  const NamespaceMetrics = IDL.Record({
    'authenticated_unique_users' : IDL.Nat,
    'total_invocations' : IDL.Nat,
    'anonymous_invocations' : IDL.Nat,
    'total_instances' : IDL.Nat,
    'total_tools' : IDL.Nat,
    'namespace' : IDL.Text,
  });
  const ToolMetrics = IDL.Record({
    'total_invocations' : IDL.Nat,
    'tool_id' : IDL.Text,
  });
  const NamespaceMetricsDetailed = IDL.Record({
    'tools' : IDL.Vec(ToolMetrics),
    'authenticated_unique_users' : IDL.Nat,
    'total_invocations' : IDL.Nat,
    'anonymous_invocations' : IDL.Nat,
    'total_instances' : IDL.Nat,
    'namespace' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const UsageTracker = IDL.Service({
    'add_approved_wasm_hash' : IDL.Func([IDL.Text], [Result], []),
    'get_all_server_metrics' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, ServerMetricsShared))],
        ['query'],
      ),
    'get_and_clear_logs' : IDL.Func([], [Result_2], []),
    'get_app_metrics' : IDL.Func(
        [IDL.Principal],
        [IDL.Opt(AppMetrics)],
        ['query'],
      ),
    'get_metrics_for_server' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(ServerMetricsShared)],
        ['query'],
      ),
    'get_namespace_metrics' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(NamespaceMetrics)],
        ['query'],
      ),
    'get_namespace_metrics_detailed' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(NamespaceMetricsDetailed)],
        ['query'],
      ),
    'get_namespace_tools' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(ToolMetrics)],
        ['query'],
      ),
    'get_namespace_wasms' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(IDL.Text)],
        ['query'],
      ),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'get_payout_canister' : IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
    'is_wasm_hash_approved' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'list_all_wasm_ids' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat, IDL.Nat))],
        ['query'],
      ),
    'log_call' : IDL.Func([UsageStats], [Result], []),
    'rebuild_namespace_wasm_mappings' : IDL.Func([], [Result_1], []),
    'register_canister_namespace' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [Result],
        [],
      ),
    'register_historical_wasm' : IDL.Func([IDL.Text, IDL.Text], [Result_1], []),
    'remove_approved_wasm_hash' : IDL.Func([IDL.Text], [Result], []),
    'seed_log' : IDL.Func([IDL.Principal, IDL.Text, UsageStats], [Result], []),
    'set_orchestrator_canister' : IDL.Func([IDL.Principal], [Result], []),
    'set_owner' : IDL.Func([IDL.Principal], [Result], []),
    'set_payout_canister' : IDL.Func([IDL.Principal], [Result], []),
    'set_registry_canister' : IDL.Func([IDL.Principal], [Result], []),
  });
  return UsageTracker;
};
export const init = ({ IDL }) => { return []; };
