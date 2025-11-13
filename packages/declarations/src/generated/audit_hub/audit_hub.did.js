export const idlFactory = ({ IDL }) => {
  const ICRC16 = IDL.Rec();
  const ICRC16Property = IDL.Record({
    'value' : ICRC16,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : IDL.Vec(IDL.Tuple(IDL.Text, ICRC16)),
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16),
      'Nat16' : IDL.Nat16,
      'Nat32' : IDL.Nat32,
      'Nat64' : IDL.Nat64,
      'Blob' : IDL.Vec(IDL.Nat8),
      'Bool' : IDL.Bool,
      'Int8' : IDL.Int8,
      'Nat8' : IDL.Nat8,
      'Nats' : IDL.Vec(IDL.Nat),
      'Text' : IDL.Text,
      'Bytes' : IDL.Vec(IDL.Nat8),
      'Int16' : IDL.Int16,
      'Int32' : IDL.Int32,
      'Int64' : IDL.Int64,
      'Option' : IDL.Opt(ICRC16),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16, ICRC16)),
      'Class' : IDL.Vec(ICRC16Property),
    })
  );
  const ICRC16Map = IDL.Vec(IDL.Tuple(IDL.Text, ICRC16));
  const BountyId = IDL.Nat;
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const TokenId = IDL.Text;
  const Balance = IDL.Nat;
  const Result_3 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
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
  const AssignedJob = IDL.Record({
    'verifier' : IDL.Principal,
    'assigned_at' : Timestamp,
    'wasm_id' : IDL.Text,
    'bounty_id' : BountyId,
    'expires_at' : Timestamp,
  });
  const VerificationJob = IDL.Record({
    'repo' : IDL.Text,
    'bounty_ids' : IDL.Vec(BountyId),
    'created_at' : Timestamp,
    'build_config' : ICRC16Map,
    'assigned_count' : IDL.Nat,
    'wasm_id' : IDL.Text,
    'required_verifiers' : IDL.Nat,
    'commit_hash' : IDL.Text,
  });
  const VerificationJobAssignment = IDL.Record({
    'repo' : IDL.Text,
    'build_config' : ICRC16Map,
    'wasm_id' : IDL.Text,
    'bounty_id' : BountyId,
    'commit_hash' : IDL.Text,
    'expires_at' : Timestamp,
  });
  const Result_2 = IDL.Variant({
    'ok' : VerificationJobAssignment,
    'err' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
  const AuditHub = IDL.Service({
    'add_verification_job' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, ICRC16Map, IDL.Nat, IDL.Vec(BountyId)],
        [Result],
        [],
      ),
    'admin_add_bounties_to_job' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat)],
        [Result],
        [],
      ),
    'cleanup_expired_lock' : IDL.Func([BountyId], [Result], []),
    'debug_get_bounty' : IDL.Func([IDL.Nat], [IDL.Text], []),
    'deposit_stake' : IDL.Func([TokenId, Balance], [Result], []),
    'generate_api_key' : IDL.Func([], [Result_3], []),
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
    'get_stake_requirement' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Tuple(TokenId, Balance))],
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
    'has_active_bounty_lock' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'is_bounty_ready_for_collection' : IDL.Func(
        [BountyId, IDL.Principal],
        [IDL.Bool],
        ['query'],
      ),
    'list_api_keys' : IDL.Func([], [IDL.Vec(ApiCredential)], []),
    'list_assigned_jobs' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(BountyId, AssignedJob))],
        ['query'],
      ),
    'list_pending_jobs' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, VerificationJob))],
        ['query'],
      ),
    'mark_verification_complete' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'release_job_assignment' : IDL.Func([BountyId], [Result], []),
    'release_stake' : IDL.Func([BountyId], [Result], []),
    'request_verification_job_with_api_key' : IDL.Func(
        [IDL.Text],
        [Result_2],
        [],
      ),
    'reserve_bounty' : IDL.Func([BountyId, IDL.Text], [Result], []),
    'reserve_bounty_with_api_key' : IDL.Func(
        [IDL.Text, BountyId, IDL.Text],
        [Result],
        [],
      ),
    'revoke_api_key' : IDL.Func([IDL.Text], [Result], []),
    'set_bounty_sponsor_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_owner' : IDL.Func([IDL.Principal], [Result], []),
    'set_registry_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_stake_requirement' : IDL.Func(
        [IDL.Text, TokenId, Balance],
        [Result],
        [],
      ),
    'slash_stake_for_incorrect_consensus' : IDL.Func([BountyId], [Result], []),
    'validate_api_key' : IDL.Func([IDL.Text], [Result_1], ['query']),
    'withdraw_stake' : IDL.Func([TokenId, Balance], [Result], []),
  });
  return AuditHub;
};
export const init = ({ IDL }) => { return []; };
