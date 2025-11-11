import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Option "mo:base/Option";

import Types "Types";

module {

  // Helper to get a balance from a given map, returning 0 if not found.
  public func get_balance(balance_map : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>, verifier : Principal, token_id : Types.TokenId) : Types.Balance {
    switch (Map.get(balance_map, phash, verifier)) {
      case (null) { return 0 };
      case (?balances) {
        return Option.get(Map.get(balances, thash, token_id), 0);
      };
    };
  };

  // Helper to set a balance in a given map.
  public func set_balance(balance_map : Map.Map<Principal, Map.Map<Types.TokenId, Types.Balance>>, verifier : Principal, token_id : Types.TokenId, new_balance : Types.Balance) {
    let verifier_balances = switch (Map.get(balance_map, phash, verifier)) {
      case (null) {
        let new_map = Map.new<Types.TokenId, Types.Balance>();
        Map.set(balance_map, phash, verifier, new_map);
        new_map;
      };
      case (?existing) { existing };
    };
    Map.set(verifier_balances, thash, token_id, new_balance);
  };

  // Helper to get verifier stats
  public func get_verifier_stats(verifier_stats : Map.Map<Principal, Types.VerifierProfile>, verifier : Principal) : {
    total_verifications : Nat;
    reputation_score : Nat;
    total_earnings : Types.Balance;
  } {
    return Option.get(
      Map.get(verifier_stats, phash, verifier),
      { total_verifications = 0; reputation_score = 100; total_earnings = 0 }, // Default: new verifier starts with perfect score
    );
  };
};
