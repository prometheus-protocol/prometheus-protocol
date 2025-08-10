// packages/canisters/auditor_credentials/src/Main.mo
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Iter "mo:base/Iter";

shared ({ caller = deployer }) persistent actor class AuditorCredentials() {
  // State: A map from an auditor's Principal to a Map of their credential types (as Text).
  var credentials = Map.new<Principal, Map.Map<Text, Null>>();
  var _owner : Principal = deployer;

  // Helper function to check if the caller is the owner.
  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(_owner, caller);
  };

  public shared query func get_owner() : async Principal {
    return _owner;
  };

  // Public function to transfer ownership to a new principal.
  public shared (msg) func transfer_ownership(new_owner : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can transfer ownership.");
    };
    _owner := new_owner;
    return #ok(());
  };

  // Public function to issue a credential.
  public shared (msg) func issue_credential(auditor : Principal, audit_type : Text) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can issue credentials.");
    };

    // 1. Check if the auditor already has an entry. If not, create one.
    if (Option.isNull(Map.get(credentials, phash, auditor))) {
      Map.set(credentials, phash, auditor, Map.new<Text, Null>());
    };

    let auditor_credentials = switch (Map.get(credentials, phash, auditor)) {
      case (null) {
        return #err("Auditor not found.");
      };
      case (?existing) {
        existing;
      };
    };

    // 3. Add the credential type to the map that is directly referenced from the state.
    Map.set(auditor_credentials, thash, audit_type, null);

    return #ok(());
  };

  // Public function to revoke a credential.
  public shared (msg) func revoke_credential(auditor : Principal, audit_type : Text) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can revoke credentials.");
    };

    // Check if the auditor has the credential type.
    switch (Map.get(credentials, phash, auditor)) {
      case (null) {
        return #err("Auditor does not have any credentials.");
      };
      case (?auditor_credentials) {
        if (Option.isSome(Map.get(auditor_credentials, thash, audit_type))) {
          Map.delete(auditor_credentials, thash, audit_type);
          return #ok(());
        } else {
          return #err("Auditor does not have the specified credential type.");
        };
      };
    };
  };

  // Public query function to verify a credential.
  public shared query func verify_credential(auditor : Principal, audit_type : Text) : async Bool {
    // Check if the auditor has the credential type.
    switch (Map.get(credentials, phash, auditor)) {
      case (null) {
        return false; // Auditor has no credentials.
      };
      case (?auditor_credentials) {
        return Option.isSome(Map.get(auditor_credentials, thash, audit_type));
      };
    };
  };

  // Public query function to get all credentials for a specific auditor.
  public shared query func get_credentials_for_auditor(auditor : Principal) : async [Text] {
    switch (Map.get(credentials, phash, auditor)) {
      case (null) {
        return []; // Return an empty array if the auditor has no credentials.
      };
      case (?auditor_credentials) {
        // Map.keys() returns an iterator, so we convert it to an array.
        return Iter.toArray(Map.keys(auditor_credentials));
      };
    };
  };
};
