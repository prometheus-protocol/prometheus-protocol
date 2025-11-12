export const idlFactory = ({ IDL }) => {
  const EnvDependency = IDL.Record({
    'key' : IDL.Text,
    'setter' : IDL.Text,
    'required' : IDL.Bool,
    'canister_name' : IDL.Text,
    'current_value' : IDL.Opt(IDL.Principal),
  });
  const EnvConfig = IDL.Record({
    'key' : IDL.Text,
    'value_type' : IDL.Text,
    'setter' : IDL.Text,
    'required' : IDL.Bool,
    'current_value' : IDL.Opt(IDL.Text),
  });
  const Time = IDL.Int;
  const ServerLeaderboardEntry = IDL.Record({
    'total_invocations' : IDL.Nat,
    'rank' : IDL.Nat,
    'server' : IDL.Text,
  });
  const UserLeaderboardEntry = IDL.Record({
    'total_invocations' : IDL.Nat,
    'rank' : IDL.Nat,
    'user' : IDL.Principal,
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Leaderboard = IDL.Service({
    'get_env_requirements' : IDL.Func(
        [],
        [
          IDL.Variant({
            'v1' : IDL.Record({
              'dependencies' : IDL.Vec(EnvDependency),
              'configuration' : IDL.Vec(EnvConfig),
            }),
          }),
        ],
        ['query'],
      ),
    'get_last_updated' : IDL.Func([], [Time], ['query']),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'get_server_leaderboard' : IDL.Func(
        [],
        [IDL.Vec(ServerLeaderboardEntry)],
        ['query'],
      ),
    'get_timer_status' : IDL.Func(
        [],
        [
          IDL.Record({
            'update_interval_minutes' : IDL.Nat,
            'is_running' : IDL.Bool,
          }),
        ],
        ['query'],
      ),
    'get_tool_invocations_for_server' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat))],
        ['query'],
      ),
    'get_user_leaderboard' : IDL.Func(
        [],
        [IDL.Vec(UserLeaderboardEntry)],
        ['query'],
      ),
    'init' : IDL.Func([IDL.Principal], [], []),
    'restart_timer' : IDL.Func([], [Result], []),
    'start_timer' : IDL.Func([], [Result], []),
    'stop_timer' : IDL.Func([], [Result], []),
    'trigger_manual_update' : IDL.Func([], [Result], []),
  });
  return Leaderboard;
};
export const init = ({ IDL }) => { return []; };
