export const idlFactory = ({ IDL }) => {
  const BountyId = IDL.Nat;
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const TokenId = IDL.Text;
  const Balance = IDL.Nat;
  const Result_2 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const Timestamp = IDL.Int;
  const BountyLock = IDL.Record({
    'stake_token_id' : TokenId,
    'claimant' : IDL.Principal,
    'stake_amount' : Balance,
    'expires_at' : Timestamp,
  });
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
  const VerifierProfile = IDL.Record({
    'staked_balance_usdc' : Balance,
    'available_balance_usdc' : Balance,
    'reputation_score' : IDL.Nat,
    'total_verifications' : IDL.Nat,
    'total_earnings' : Balance,
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
    'deposit_stake' : IDL.Func([TokenId, Balance], [Result], []),
    'generate_api_key' : IDL.Func([], [Result_2], []),
    'get_available_balance' : IDL.Func(
        [IDL.Principal, TokenId],
        [Balance],
        ['query'],
      ),
    'get_available_balance_by_audit_type' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [Balance],
        ['query'],
      ),
    'get_bounty_lock' : IDL.Func([BountyId], [IDL.Opt(BountyLock)], ['query']),
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
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'get_payment_token_config' : IDL.Func(
        [],
        [
          IDL.Record({
            'decimals' : IDL.Nat8,
            'ledger_id' : IDL.Opt(IDL.Principal),
            'symbol' : IDL.Text,
          }),
        ],
        ['query'],
      ),
    'get_registry_canister_id' : IDL.Func(
        [],
        [IDL.Opt(IDL.Principal)],
        ['query'],
      ),
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
        [IDL.Principal, TokenId],
        [VerifierProfile],
        ['query'],
      ),
    'is_bounty_ready_for_collection' : IDL.Func(
        [BountyId, IDL.Principal],
        [IDL.Bool],
        ['query'],
      ),
    'list_api_keys' : IDL.Func([], [IDL.Vec(ApiCredential)], []),
    'register_audit_type' : IDL.Func([IDL.Text, TokenId], [Result], []),
    'release_stake' : IDL.Func([BountyId], [Result], []),
    'reserve_bounty' : IDL.Func([BountyId, TokenId], [Result], []),
    'reserve_bounty_with_api_key' : IDL.Func(
        [IDL.Text, BountyId, TokenId],
        [Result],
        [],
      ),
    'revoke_api_key' : IDL.Func([IDL.Text], [Result], []),
    'set_dashboard_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_payment_token_config' : IDL.Func(
        [IDL.Principal, IDL.Text, IDL.Nat8],
        [Result],
        [],
      ),
    'set_registry_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_stake_requirement' : IDL.Func([TokenId, Balance], [Result], []),
    'set_usdc_ledger_id' : IDL.Func([IDL.Principal], [Result], []),
    'slash_stake_for_incorrect_consensus' : IDL.Func([BountyId], [Result], []),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
    'validate_api_key' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'withdraw_stake' : IDL.Func([TokenId, Balance], [Result], []),
  });
  return AuditHub;
};
export const init = ({ IDL }) => { return []; };
