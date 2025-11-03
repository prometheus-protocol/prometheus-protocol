import type { Principal } from '@icp-sdk/core/principal';
import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';

export interface Indexer {
  'search' : ActorMethod<[string], Array<string>>,
  'set_registry_canister_id' : ActorMethod<[Principal], Result>,
  'update_index' : ActorMethod<[string, string], undefined>,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export interface _SERVICE extends Indexer {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
