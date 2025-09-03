export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const CallerActivity = IDL.Record({
    'call_count' : IDL.Nat,
    'tool_id' : IDL.Text,
    'caller' : IDL.Principal,
  });
  const UsageStats = IDL.Record({
    'start_timestamp_ns' : IDL.Nat,
    'end_timestamp_ns' : IDL.Nat,
    'activity' : IDL.Vec(CallerActivity),
  });
  const Time = IDL.Int;
  const LogEntry = IDL.Record({
    'server_id' : IDL.Principal,
    'stats' : UsageStats,
    'timestamp' : Time,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Vec(LogEntry), 'err' : IDL.Text });
  const UsageTracker = IDL.Service({
    'add_approved_wasm_hash' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'get_admin' : IDL.Func([], [IDL.Principal], ['query']),
    'get_and_clear_logs' : IDL.Func([], [Result_1], []),
    'get_payout_canister' : IDL.Func([], [IDL.Opt(IDL.Principal)], ['query']),
    'is_wasm_hash_approved' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [IDL.Bool],
        ['query'],
      ),
    'log_call' : IDL.Func([UsageStats], [Result], []),
    'remove_approved_wasm_hash' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result], []),
    'set_payout_canister' : IDL.Func([IDL.Principal], [Result], []),
    'transfer_admin' : IDL.Func([IDL.Principal], [Result], []),
  });
  return UsageTracker;
};
export const init = ({ IDL }) => { return []; };
