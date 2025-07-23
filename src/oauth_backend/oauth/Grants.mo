import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Types "Types";
import Iter "mo:base/Iter";

module {

  /**
   * [READ] Lists all resource server IDs for which the caller has an active grant.
   */
  public func get_my_grants(
    context : Types.Context,
    caller : Principal,
  ) : [Text] {
    // Find the set of grants for the calling user.
    let grants_set = switch (Map.get(context.user_grants, phash, caller)) {
      case (null) return []; // User has no grants, return an empty array.
      case (?set) set;
    };

    // The keys of the inner map are the resource_server_ids.
    return Iter.toArray(Map.keys(grants_set));
  };

  /**
   * [DELETE] Revokes a user's grant for a specific resource server.
   * This removes the grant record and, in the future, will revoke the token allowance.
   */
  public func revoke_grant(
    context : Types.Context,
    caller : Principal,
    resource_server_id : Text,
  ) : async Result.Result<Text, Text> {
    // 1. Find the user's grant set.
    let grants_set = switch (Map.get(context.user_grants, phash, caller)) {
      case (null) {
        // The user has no grants, so there's nothing to revoke. This is a success case.
        return #ok("Grant was not found, nothing to revoke.");
      };
      case (?set) set;
    };

    // 2. Remove the specific resource server ID from their set of grants.
    Map.delete(grants_set, thash, resource_server_id);

    // 3. If the set is now empty, we can remove the user's entry entirely to save space.
    if (grants_set.size() == 0) {
      Map.delete(context.user_grants, phash, caller);
    } else {
      // Otherwise, put the modified set back.
      Map.set(context.user_grants, phash, caller, grants_set);
    };

    // 4. TODO: Future enhancement - Revoke the actual ICRC-2 allowance.
    // This would involve looking up the resource server, finding all its accepted
    // payment canisters, and making an inter-canister call to each one to
    // approve an allowance of 0 for the spender principal.

    return #ok("Grant revoked successfully.");
  };
};
