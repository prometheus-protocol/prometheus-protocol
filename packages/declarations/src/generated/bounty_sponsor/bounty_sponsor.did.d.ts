import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type BountyId = bigint;
export interface BountySponsor {
  'get_bounty_info' : ActorMethod<
    [BountyId],
    [] | [{ 'audit_type' : string, 'wasm_id' : WasmId, 'timestamp' : bigint }]
  >,
  'get_config' : ActorMethod<
    [],
    {
      'registry_canister_id' : [] | [Principal],
      'reward_amounts' : Array<[string, bigint]>,
      'reward_token_canister_id' : [] | [Principal],
      'required_verifiers' : bigint,
    }
  >,
  'get_env_requirements' : ActorMethod<
    [],
    {
        'v1' : {
          'dependencies' : Array<EnvDependency>,
          'configuration' : Array<EnvConfig>,
        }
      }
  >,
  'get_owner' : ActorMethod<[], Principal>,
  'get_reward_amount_for_audit_type' : ActorMethod<[string], [] | [bigint]>,
  'get_sponsored_audit_types_for_wasm' : ActorMethod<[WasmId], Array<string>>,
  'get_sponsored_bounties_for_wasm' : ActorMethod<[WasmId], Array<BountyId>>,
  'get_total_sponsored_bounties' : ActorMethod<[], bigint>,
  'is_wasm_sponsored' : ActorMethod<[WasmId], boolean>,
  'set_registry_canister_id' : ActorMethod<[Principal], Result>,
  'set_reward_amount_for_audit_type' : ActorMethod<[string, bigint], Result>,
  'set_reward_token_canister_id' : ActorMethod<[Principal], Result>,
  'sponsor_bounties_for_wasm' : ActorMethod<
    [WasmId, Uint8Array | number[], Array<string>],
    Result_1
  >,
  'transfer_ownership' : ActorMethod<[Principal], Result>,
}
export interface EnvConfig {
  'key' : string,
  'value_type' : string,
  'setter' : string,
  'required' : boolean,
  'current_value' : [] | [string],
}
export interface EnvDependency {
  'key' : string,
  'setter' : string,
  'required' : boolean,
  'canister_name' : string,
  'current_value' : [] | [Principal],
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = {
    'ok' : { 'bounty_ids' : Array<BountyId>, 'total_sponsored' : bigint }
  } |
  { 'err' : string };
export type WasmId = string;
export interface _SERVICE extends BountySponsor {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
