export const idlFactory = ({ IDL }) => {
  const BountyId = IDL.Nat;
  const Result_1 = IDL.Variant({ 'ok' : BountyId, 'err' : IDL.Text });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Timestamp = IDL.Int;
  const Bounty = IDL.Record({
    'id' : BountyId,
    'status' : IDL.Text,
    'title' : IDL.Text,
    'reward_token' : IDL.Text,
    'reward_amount' : IDL.Float64,
    'short_description' : IDL.Text,
    'created_at' : Timestamp,
    'details_markdown' : IDL.Text,
  });
  const AppBounties = IDL.Service({
    'create_bounty' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Float64, IDL.Text, IDL.Text, IDL.Text],
        [Result_1],
        [],
      ),
    'delete_bounty' : IDL.Func([BountyId], [Result], []),
    'get_all_bounties' : IDL.Func([], [IDL.Vec(Bounty)], ['query']),
    'get_bounty' : IDL.Func([BountyId], [IDL.Opt(Bounty)], ['query']),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
    'update_bounty' : IDL.Func(
        [
          BountyId,
          IDL.Text,
          IDL.Text,
          IDL.Float64,
          IDL.Text,
          IDL.Text,
          IDL.Text,
        ],
        [Result],
        [],
      ),
  });
  return AppBounties;
};
export const init = ({ IDL }) => { return []; };
