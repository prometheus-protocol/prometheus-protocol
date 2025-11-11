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
    let pending_audit_key = wasm_id # "::" # audit_type;

    switch (BTree.get(pending_audits, Text.compare, pending_audit_key)) {
      case (?existing) {
        let merged = Buffer.Buffer<Nat>(existing.bounty_ids.size() + additional_bounty_ids.size());
        for (id in existing.bounty_ids.vals()) {
          merged.add(id);
        };
        for (id in additional_bounty_ids.vals()) {
          merged.add(id);
        };

        let updated_job : Types.VerificationJob = {
          wasm_id = existing.wasm_id;
          repo = existing.repo;
          commit_hash = existing.commit_hash;
          build_config = existing.build_config;
          created_at = existing.created_at;
          required_verifiers = existing.required_verifiers;
          assigned_count = existing.assigned_count;
          bounty_ids = Buffer.toArray(merged);
        };

        ignore BTree.insert(pending_audits, Text.compare, pending_audit_key, updated_job);
        Debug.print("Added " # Nat.toText(additional_bounty_ids.size()) # " bounty_ids to job for WASM " # wasm_id # ". Total now: " # Nat.toText(updated_job.bounty_ids.size()));
        #ok();
      };
      case (null) {
        #err("No verification job found for wasm_id: " # wasm_id);
      };
    };
  };
};
