export const idlFactory = ({ IDL }) => {
  const ICRC16 = IDL.Rec();
  const ICRC16Map__2 = IDL.Rec();
  const ICRC16__1 = IDL.Rec();
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
  const Result_4 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const Result_5 = IDL.Variant({ 'ok' : IDL.Vec(IDL.Nat), 'err' : IDL.Text });
  const TokenId = IDL.Text;
  const Balance = IDL.Nat;
  const RunBountyResult = IDL.Record({
    'result' : IDL.Variant({ 'Invalid' : IDL.Null, 'Valid' : IDL.Null }),
    'metadata' : ICRC16,
    'trx_id' : IDL.Opt(IDL.Nat),
  });
  const Account__1 = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const ClaimRecord = IDL.Record({
    'result' : IDL.Opt(RunBountyResult),
    'claim_account' : IDL.Opt(Account__1),
    'time_submitted' : IDL.Nat,
    'claim_id' : IDL.Nat,
    'caller' : IDL.Principal,
    'claim_metadata' : ICRC16Map,
    'submission' : ICRC16,
  });
  const Bounty = IDL.Record({
    'claims' : IDL.Vec(ClaimRecord),
    'created' : IDL.Nat,
    'creator' : IDL.Principal,
    'token_amount' : IDL.Nat,
    'bounty_metadata' : ICRC16Map,
    'claimed' : IDL.Opt(IDL.Nat),
    'token_canister_id' : IDL.Principal,
    'challenge_parameters' : ICRC16,
    'validation_call_timeout' : IDL.Nat,
    'bounty_id' : IDL.Nat,
    'validation_canister_id' : IDL.Principal,
    'claimed_date' : IDL.Opt(IDL.Nat),
    'timeout_date' : IDL.Opt(IDL.Nat),
    'payout_fee' : IDL.Nat,
  });
  const Timestamp__1 = IDL.Int;
  const BountyLock = IDL.Record({
    'stake_token_id' : TokenId,
    'claimant' : IDL.Principal,
    'stake_amount' : Balance,
    'expires_at' : Timestamp__1,
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
  const VerificationJob = IDL.Record({
    'audit_type' : IDL.Text,
    'creator' : IDL.Principal,
    'repo' : IDL.Text,
    'bounty_ids' : IDL.Vec(BountyId),
    'completed_count' : IDL.Nat,
    'created_at' : Timestamp__1,
    'build_config' : ICRC16Map,
    'assigned_count' : IDL.Nat,
    'wasm_id' : IDL.Text,
    'required_verifiers' : IDL.Nat,
    'commit_hash' : IDL.Text,
  });
  const VerifierProfile = IDL.Record({
    'reputation_score' : IDL.Nat,
    'total_verifications' : IDL.Nat,
    'total_earnings' : Balance,
  });
  const ICRC16Property__1 = IDL.Record({
    'value' : ICRC16__1,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__1.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : ICRC16Map__2,
      'Nat' : IDL.Nat,
      'Set' : IDL.Vec(ICRC16__1),
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
      'Option' : IDL.Opt(ICRC16__1),
      'Floats' : IDL.Vec(IDL.Float64),
      'Float' : IDL.Float64,
      'Principal' : IDL.Principal,
      'Array' : IDL.Vec(ICRC16__1),
      'ValueMap' : IDL.Vec(IDL.Tuple(ICRC16__1, ICRC16__1)),
      'Class' : IDL.Vec(ICRC16Property__1),
    })
  );
  ICRC16Map__2.fill(IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1)));
  const CreateBountyRequest = IDL.Record({
    'bounty_metadata' : ICRC16Map__2,
    'challenge_parameters' : ICRC16__1,
    'start_date' : IDL.Opt(IDL.Nat),
    'bounty_id' : IDL.Opt(IDL.Nat),
    'validation_canister_id' : IDL.Principal,
    'timeout_date' : IDL.Nat,
  });
  const CreateBountyResult = IDL.Variant({
    'Ok' : IDL.Record({ 'trx_id' : IDL.Opt(IDL.Nat), 'bounty_id' : IDL.Nat }),
    'Error' : IDL.Variant({
      'InsufficientAllowance' : IDL.Null,
      'Generic' : IDL.Text,
    }),
  });
  const RunBountyResult__1 = IDL.Record({
    'result' : IDL.Variant({ 'Invalid' : IDL.Null, 'Valid' : IDL.Null }),
    'metadata' : ICRC16__1,
    'trx_id' : IDL.Opt(IDL.Nat),
  });
  const ClaimRecord__1 = IDL.Record({
    'result' : IDL.Opt(RunBountyResult__1),
    'claim_account' : IDL.Opt(Account__1),
    'time_submitted' : IDL.Nat,
    'claim_id' : IDL.Nat,
    'caller' : IDL.Principal,
    'claim_metadata' : ICRC16Map__2,
    'submission' : ICRC16__1,
  });
  const Bounty__1 = IDL.Record({
    'claims' : IDL.Vec(ClaimRecord__1),
    'created' : IDL.Nat,
    'creator' : IDL.Principal,
    'token_amount' : IDL.Nat,
    'bounty_metadata' : ICRC16Map__2,
    'claimed' : IDL.Opt(IDL.Nat),
    'token_canister_id' : IDL.Principal,
    'challenge_parameters' : ICRC16__1,
    'validation_call_timeout' : IDL.Nat,
    'bounty_id' : IDL.Nat,
    'validation_canister_id' : IDL.Principal,
    'claimed_date' : IDL.Opt(IDL.Nat),
    'timeout_date' : IDL.Opt(IDL.Nat),
    'payout_fee' : IDL.Nat,
  });
  const ListBountiesFilter = IDL.Variant({
    'claimed_by' : Account__1,
    'validation_canister' : IDL.Principal,
    'metadata' : ICRC16Map__2,
    'claimed' : IDL.Bool,
    'created_after' : IDL.Nat,
    'created_before' : IDL.Nat,
  });
  const BountySubmissionRequest = IDL.Record({
    'account' : IDL.Opt(Account__1),
    'bounty_id' : IDL.Nat,
    'submission' : ICRC16__1,
  });
  const Timestamp = IDL.Nat64;
  const TransferError = IDL.Variant({
    'GenericError' : IDL.Record({
      'message' : IDL.Text,
      'error_code' : IDL.Nat,
    }),
    'TemporarilyUnavailable' : IDL.Null,
    'BadBurn' : IDL.Record({ 'min_burn_amount' : IDL.Nat }),
    'Duplicate' : IDL.Record({ 'duplicate_of' : IDL.Nat }),
    'BadFee' : IDL.Record({ 'expected_fee' : IDL.Nat }),
    'CreatedInFuture' : IDL.Record({ 'ledger_time' : Timestamp }),
    'TooOld' : IDL.Null,
    'InsufficientFunds' : IDL.Record({ 'balance' : IDL.Nat }),
  });
  const BountySubmissionResult = IDL.Variant({
    'Ok' : IDL.Record({
      'result' : IDL.Opt(RunBountyResult__1),
      'claim_id' : IDL.Nat,
    }),
    'Error' : IDL.Variant({
      'Generic' : IDL.Text,
      'NoMatch' : IDL.Null,
      'PayoutFailed' : TransferError,
    }),
  });
  const ApiCredential = IDL.Record({
    'api_key' : IDL.Text,
    'created_at' : Timestamp__1,
    'last_used' : IDL.Opt(Timestamp__1),
    'is_active' : IDL.Bool,
    'verifier_principal' : IDL.Principal,
  });
  const AssignedJob = IDL.Record({
    'audit_type' : IDL.Text,
    'verifier' : IDL.Principal,
    'assigned_at' : Timestamp__1,
    'wasm_id' : IDL.Text,
    'bounty_id' : BountyId,
    'expires_at' : Timestamp__1,
  });
  const BountyStatus = IDL.Variant({ 'Claimed' : IDL.Null, 'Open' : IDL.Null });
  const BountyFilter = IDL.Variant({
    'status' : BountyStatus,
    'audit_type' : IDL.Text,
    'creator' : IDL.Principal,
    'wasm_id' : IDL.Text,
  });
  const BountyListingRequest = IDL.Record({
    'prev' : IDL.Opt(IDL.Nat),
    'take' : IDL.Opt(IDL.Nat),
    'filter' : IDL.Opt(IDL.Vec(BountyFilter)),
  });
  const BountyListingResponse = IDL.Variant({
    'ok' : IDL.Vec(Bounty),
    'err' : IDL.Text,
  });
  const VerificationJobAssignment = IDL.Record({
    'repo' : IDL.Text,
    'build_config' : ICRC16Map,
    'wasm_id' : IDL.Text,
    'bounty_id' : BountyId,
    'commit_hash' : IDL.Text,
    'expires_at' : Timestamp__1,
  });
  const Result_3 = IDL.Variant({
    'ok' : VerificationJobAssignment,
    'err' : IDL.Text,
  });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Principal, 'err' : IDL.Text });
  const Subaccount = IDL.Vec(IDL.Nat8);
  const Account = IDL.Record({
    'owner' : IDL.Principal,
    'subaccount' : IDL.Opt(Subaccount),
  });
  const TreasuryError = IDL.Variant({
    'LedgerTrap' : IDL.Text,
    'NotOwner' : IDL.Null,
    'TransferFailed' : TransferError,
  });
  const Result_1 = IDL.Variant({ 'ok' : IDL.Nat, 'err' : TreasuryError });
  const AuditHub = IDL.Service({
    'add_verification_job' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Text,
          ICRC16Map,
          IDL.Text,
          IDL.Nat,
          IDL.Vec(BountyId),
        ],
        [Result],
        [],
      ),
    'admin_add_bounties_by_queue_key' : IDL.Func(
        [IDL.Text, IDL.Vec(IDL.Nat)],
        [Result],
        [],
      ),
    'admin_add_bounties_to_job' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat)],
        [Result],
        [],
      ),
    'admin_add_to_deny_list' : IDL.Func([IDL.Principal], [Result], []),
    'admin_add_verifier_to_job' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'admin_claim_bounty_for_verifier' : IDL.Func(
        [BountyId, IDL.Principal, IDL.Text],
        [Result],
        [],
      ),
    'admin_cleanup_orphaned_stakes' : IDL.Func([], [Result_4], []),
    'admin_clear_bounty_verifier' : IDL.Func([BountyId], [Result], []),
    'admin_fix_job_assigned_count' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [Result],
        [],
      ),
    'admin_force_release_lock' : IDL.Func([BountyId], [Result], []),
    'admin_remove_from_deny_list' : IDL.Func([IDL.Principal], [Result], []),
    'admin_remove_verifier_from_job' : IDL.Func(
        [IDL.Text, IDL.Principal],
        [Result],
        [],
      ),
    'attach_bounties_to_job' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat)],
        [Result],
        [],
      ),
    'cleanup_expired_lock' : IDL.Func([BountyId], [Result], []),
    'create_local_bounties_for_job' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat, IDL.Nat, IDL.Principal, IDL.Int],
        [Result_5],
        [],
      ),
    'deposit_stake' : IDL.Func([TokenId, Balance], [Result], []),
    'generate_api_key' : IDL.Func([], [Result_4], []),
    'get_available_balance_by_audit_type' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [Balance],
        ['query'],
      ),
    'get_bounties_for_job' : IDL.Func([IDL.Text], [IDL.Vec(Bounty)], ['query']),
    'get_bounties_with_locks_for_job' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(IDL.Tuple(Bounty, IDL.Opt(BountyLock)))],
        ['query'],
      ),
    'get_bounty_lock' : IDL.Func([BountyId], [IDL.Opt(BountyLock)], ['query']),
    'get_deny_list' : IDL.Func([], [IDL.Vec(IDL.Principal)], ['query']),
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
    'get_pending_job' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(VerificationJob)],
        ['query'],
      ),
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
    'get_verifier_leaderboard' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Principal, VerifierProfile))],
        ['query'],
      ),
    'get_verifier_profile' : IDL.Func(
        [IDL.Principal, TokenId],
        [VerifierProfile],
        ['query'],
      ),
    'has_active_bounty_lock' : IDL.Func([IDL.Principal], [IDL.Bool], ['query']),
    'has_available_jobs' : IDL.Func([IDL.Text], [IDL.Bool], ['query']),
    'icrc10_supported_standards' : IDL.Func(
        [],
        [IDL.Vec(IDL.Record({ 'url' : IDL.Text, 'name' : IDL.Text }))],
        ['query'],
      ),
    'icrc127_create_bounty' : IDL.Func(
        [CreateBountyRequest],
        [CreateBountyResult],
        [],
      ),
    'icrc127_get_bounty' : IDL.Func([IDL.Nat], [IDL.Opt(Bounty__1)], ['query']),
    'icrc127_list_bounties' : IDL.Func(
        [
          IDL.Opt(IDL.Vec(ListBountiesFilter)),
          IDL.Opt(IDL.Nat),
          IDL.Opt(IDL.Nat),
        ],
        [IDL.Vec(Bounty)],
        ['query'],
      ),
    'icrc127_metadata' : IDL.Func([], [ICRC16Map], ['query']),
    'icrc127_submit_bounty' : IDL.Func(
        [BountySubmissionRequest],
        [BountySubmissionResult],
        [],
      ),
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
    'list_bounties' : IDL.Func(
        [BountyListingRequest],
        [BountyListingResponse],
        ['query'],
      ),
    'list_pending_jobs' : IDL.Func(
        [IDL.Opt(IDL.Nat), IDL.Opt(IDL.Nat)],
        [
          IDL.Record({
            'total' : IDL.Nat,
            'jobs' : IDL.Vec(IDL.Tuple(IDL.Text, VerificationJob)),
          }),
        ],
        ['query'],
      ),
    'mark_verification_complete' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'release_job_assignment' : IDL.Func([BountyId], [Result], []),
    'release_stake' : IDL.Func([BountyId], [Result], []),
    'request_verification_job_with_api_key' : IDL.Func(
        [IDL.Text],
        [Result_3],
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
    'validate_api_key' : IDL.Func([IDL.Text], [Result_2], ['query']),
    'withdraw' : IDL.Func([IDL.Principal, IDL.Nat, Account], [Result_1], []),
    'withdraw_stake' : IDL.Func([TokenId, Balance], [Result], []),
  });
  return AuditHub;
};
export const init = ({ IDL }) => { return []; };
