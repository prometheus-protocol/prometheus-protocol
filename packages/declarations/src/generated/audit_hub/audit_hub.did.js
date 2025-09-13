export const idlFactory = ({ IDL }) => {
  const TokenId = IDL.Text;
  const Balance = IDL.Nat;
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const BountyId = IDL.Nat;
  const AuditorProfile = IDL.Record({
    'available_balances' : IDL.Vec(IDL.Tuple(TokenId, Balance)),
    'staked_balances' : IDL.Vec(IDL.Tuple(TokenId, Balance)),
    'reputation' : IDL.Vec(IDL.Tuple(TokenId, Balance)),
  });
  const Timestamp = IDL.Int;
  const BountyLock = IDL.Record({
    'stake_token_id' : TokenId,
    'claimant' : IDL.Principal,
    'stake_amount' : Balance,
    'expires_at' : Timestamp,
  });
  const AuditHub = IDL.Service({
    'burn_tokens' : IDL.Func([IDL.Principal, TokenId, Balance], [Result], []),
    'cleanup_expired_lock' : IDL.Func([BountyId], [Result], []),
    'get_auditor_profile' : IDL.Func(
        [IDL.Principal],
        [AuditorProfile],
        ['query'],
      ),
    'get_available_balance' : IDL.Func(
        [IDL.Principal, TokenId],
        [Balance],
        ['query'],
      ),
    'get_bounty_lock' : IDL.Func([BountyId], [IDL.Opt(BountyLock)], ['query']),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'get_stake_requirement' : IDL.Func(
        [TokenId],
        [IDL.Opt(Balance)],
        ['query'],
      ),
    'get_staked_balance' : IDL.Func(
        [IDL.Principal, TokenId],
        [Balance],
        ['query'],
      ),
    'is_bounty_ready_for_collection' : IDL.Func(
        [BountyId, IDL.Principal],
        [IDL.Bool],
        ['query'],
      ),
    'mint_tokens' : IDL.Func([IDL.Principal, TokenId, Balance], [Result], []),
    'release_stake' : IDL.Func([BountyId], [Result], []),
    'reserve_bounty' : IDL.Func([BountyId, TokenId], [Result], []),
    'set_stake_requirement' : IDL.Func([TokenId, Balance], [Result], []),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
  });
  return AuditHub;
};
export const init = ({ IDL }) => { return []; };
