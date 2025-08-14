import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface AuditorCredentials {
  'get_credentials_for_auditor' : ActorMethod<[Principal], Array<string>>,
  'get_owner' : ActorMethod<[], Principal>,
  'issue_credential' : ActorMethod<[Principal, string], Result>,
  'revoke_credential' : ActorMethod<[Principal, string], Result>,
  'transfer_ownership' : ActorMethod<[Principal], Result>,
  'verify_credential' : ActorMethod<[Principal, string], boolean>,
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export interface _SERVICE extends AuditorCredentials {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
