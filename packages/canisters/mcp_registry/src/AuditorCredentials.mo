// packages/canisters/mcp_registry/src/AuditorCredentials.mo

import Principal "mo:base/Principal";
import Result "mo:base/Result";

// This module defines the public interface of the AuditorCredentialCanister,
// allowing the mcp_registry to make type-safe calls to it.
module {

  // --- TYPE DEFINITIONS (Translated from Candid) ---

  // from: type Result = variant { err: text; ok; };
  public type CallResult = Result.Result<(), Text>;

  // --- ACTOR SERVICE INTERFACE ---

  // from: service AuditorCredentialCanister { ... };
  public type Service = actor {
    // from: get_credentials_for_auditor: (auditor: principal) -> (vec text) query;
    get_credentials_for_auditor : (auditor : Principal) -> async [Text] query;

    // from: get_owner: () -> (principal) query;
    get_owner : () -> async Principal query;

    // from: issue_credential: (auditor: principal, audit_type: text) -> (Result);
    issue_credential : (auditor : Principal, audit_type : Text) -> async CallResult;

    // from: revoke_credential: (auditor: principal, audit_type: text) -> (Result);
    revoke_credential : (auditor : Principal, audit_type : Text) -> async CallResult;

    // from: transfer_ownership: (new_owner: principal) -> (Result);
    transfer_ownership : (new_owner : Principal) -> async CallResult;

    // from: verify_credential: (auditor: principal, audit_type: text) -> (bool) query;
    verify_credential : (auditor : Principal, audit_type : Text) -> async Bool query;
  };
};
