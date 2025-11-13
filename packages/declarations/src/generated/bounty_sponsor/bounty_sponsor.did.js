export const idlFactory = ({ IDL }) => {
  const ICRC16__1 = IDL.Rec();
  const BountyId = IDL.Nat;
  const WasmId = IDL.Text;
  const SponsoredBountyInfo = IDL.Record({
    'audit_type' : IDL.Text,
    'wasm_id' : WasmId,
    'timestamp' : IDL.Int,
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
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const ICRC16Property = IDL.Record({
    'value' : ICRC16__1,
    'name' : IDL.Text,
    'immutable' : IDL.Bool,
  });
  ICRC16__1.fill(
    IDL.Variant({
      'Int' : IDL.Int,
      'Map' : IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1)),
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
      'Class' : IDL.Vec(ICRC16Property),
    })
  );
  const Result_1 = IDL.Variant({
    'ok' : IDL.Record({
      'bounty_ids' : IDL.Vec(BountyId),
      'total_sponsored' : IDL.Nat,
    }),
    'err' : IDL.Text,
  });
  const BountySponsorActor = IDL.Service({
    'get_bounty_info' : IDL.Func(
        [BountyId],
        [IDL.Opt(SponsoredBountyInfo)],
        ['query'],
      ),
    'get_config' : IDL.Func(
        [],
        [
          IDL.Record({
            'registry_canister_id' : IDL.Opt(IDL.Principal),
            'reward_amounts' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat)),
            'reward_token_canister_id' : IDL.Opt(IDL.Principal),
            'required_verifiers' : IDL.Nat,
          }),
        ],
        ['query'],
      ),
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
    'get_reward_amount_for_audit_type' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Nat)],
        ['query'],
      ),
    'get_sponsored_audit_types_for_wasm' : IDL.Func(
        [WasmId],
        [IDL.Vec(IDL.Text)],
        ['query'],
      ),
    'get_sponsored_bounties_for_wasm' : IDL.Func(
        [WasmId],
        [IDL.Vec(BountyId)],
        ['query'],
      ),
    'get_total_sponsored_bounties' : IDL.Func([], [IDL.Nat], ['query']),
    'is_wasm_sponsored' : IDL.Func([WasmId], [IDL.Bool], ['query']),
    'set_audit_hub_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_registry_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'set_reward_amount_for_audit_type' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [Result],
        [],
      ),
    'set_reward_token_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'sponsor_bounties_for_wasm' : IDL.Func(
        [
          WasmId,
          IDL.Vec(IDL.Nat8),
          IDL.Vec(IDL.Text),
          IDL.Text,
          IDL.Text,
          IDL.Vec(IDL.Tuple(IDL.Text, ICRC16__1)),
          IDL.Nat,
        ],
        [Result_1],
        [],
      ),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
  });
  return BountySponsorActor;
};
export const init = ({ IDL }) => { return []; };
