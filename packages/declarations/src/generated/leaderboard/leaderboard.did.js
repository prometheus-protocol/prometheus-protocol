export const idlFactory = ({ IDL }) => {
  const Time = IDL.Int;
  const ServerLeaderboardEntry = IDL.Record({
    'total_invocations' : IDL.Nat,
    'rank' : IDL.Nat,
    'server' : IDL.Principal,
  });
  const UserLeaderboardEntry = IDL.Record({
    'total_invocations' : IDL.Nat,
    'rank' : IDL.Nat,
    'user' : IDL.Principal,
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Leaderboard = IDL.Service({
    'get_last_updated' : IDL.Func([], [Time], ['query']),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'get_server_leaderboard' : IDL.Func(
        [],
        [IDL.Vec(ServerLeaderboardEntry)],
        ['query'],
      ),
    'get_tool_invocations_for_server' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat))],
        ['query'],
      ),
    'get_user_leaderboard' : IDL.Func(
        [],
        [IDL.Vec(UserLeaderboardEntry)],
        ['query'],
      ),
    'init' : IDL.Func([IDL.Principal], [], []),
    'trigger_manual_update' : IDL.Func([], [Result], []),
  });
  return Leaderboard;
};
export const init = ({ IDL }) => { return []; };
