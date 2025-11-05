export const idlFactory = ({ IDL }) => {
  const BountyId = IDL.Nat;
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Balance = IDL.Nat;
  const Result_2 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const TokenId = IDL.Text;
  const Timestamp = IDL.Int;
  const BountyLock = IDL.Record({
    'stake_token_id' : TokenId,
    'claimant' : IDL.Principal,
    'stake_amount' : Balance,
    'expires_at' : Timestamp,
  });
  const VerifierProfile = IDL.Record({
    'staked_balance_usdc' : Balance,
    'available_balance_usdc' : Balance,
    'reputation_score' : IDL.Nat,
    'total_verifications' : IDL.Nat,
  });
  const ApiCredential = IDL.Record({
    'api_key' : IDL.Text,
    'created_at' : Timestamp,
    'last_used' : IDL.Opt(Timestamp),
    'is_active' : IDL.Bool,
    'verifier_principal' : IDL.Principal,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
  const AuditHub = IDL.Service({
    'cleanup_expired_lock' : IDL.Func([BountyId], [Result], []),
    'deposit_stake' : IDL.Func([Balance], [Result], []),
    'generate_api_key' : IDL.Func([], [Result_2], []),
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
    'get_verifier_profile' : IDL.Func(
        [IDL.Principal],
        [VerifierProfile],
        ['query'],
      ),
    'is_bounty_ready_for_collection' : IDL.Func(
        [BountyId, IDL.Principal],
        [IDL.Bool],
        ['query'],
      ),
    'list_api_keys' : IDL.Func([], [IDL.Vec(ApiCredential)], []),
    'release_stake' : IDL.Func([BountyId], [Result], []),
    'reserve_bounty' : IDL.Func([BountyId, TokenId], [Result], []),
    'reserve_bounty_with_api_key' : IDL.Func(
        [IDL.Text, BountyId, TokenId],
        [Result],
        [],
      ),
    'revoke_api_key' : IDL.Func([IDL.Text], [Result], []),
    'set_dashboard_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_stake_requirement' : IDL.Func([TokenId, Balance], [Result], []),
    'set_usdc_ledger_id' : IDL.Func([IDL.Principal], [Result], []),
    'slash_stake_for_incorrect_consensus' : IDL.Func([BountyId], [Result], []),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
    'validate_api_key' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'withdraw_stake' : IDL.Func([Balance], [Result], []),
  });
  return AuditHub;
};
export const init = ({ IDL }) => { return []; };
