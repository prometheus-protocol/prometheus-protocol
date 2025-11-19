import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";

import Types "Types";

module {

  // Admin method to manually re-add bounty_ids to a verification job
  // Used to fix cases where bounty_ids were overwritten instead of merged
  public func admin_add_bounties_to_job(
    pending_audits : BTree.BTree<Text, Types.VerificationJob>,
    wasm_id : Text,
    audit_type : Text,
    additional_bounty_ids : [Nat],
  ) : Result.Result<(), Text> {
    // Search for job by wasm_id and audit_type (key format is wasm_id::audit_type::timestamp)
    var found = false;
    let prefix = wasm_id # "::" # audit_type # "::";

    label job_search for ((key, job) in BTree.entries(pending_audits)) {
      // Check if this key matches our wasm_id and audit_type
      if (Text.startsWith(key, #text prefix)) {
        let merged = Buffer.Buffer<Nat>(job.bounty_ids.size() + additional_bounty_ids.size());
        for (id in job.bounty_ids.vals()) {
          merged.add(id);
        };
        for (id in additional_bounty_ids.vals()) {
          merged.add(id);
        };

        let updated_job : Types.VerificationJob = {
          job with bounty_ids = Buffer.toArray(merged);
        };

        ignore BTree.insert(pending_audits, Text.compare, key, updated_job);
        Debug.print("Added " # Nat.toText(additional_bounty_ids.size()) # " bounty_ids to job " # key # ". Total now: " # Nat.toText(updated_job.bounty_ids.size()));
        found := true;
        break job_search;
      };
    };

    if (found) {
      #ok();
    } else {
      #err("No verification job found for wasm_id: " # wasm_id # " and audit_type: " # audit_type);
    };
  };
};
