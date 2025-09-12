import Map "mo:map/Map";
import { nhash } "mo:map/Map";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Array "mo:base/Array";
import Order "mo:base/Order";
import Iter "mo:base/Iter";

shared ({ caller = deployer }) persistent actor class AppBounties() {

  // ==================================================================================
  // == TYPES
  // ==================================================================================

  // A unique identifier for a bounty.
  public type BountyId = Nat;

  // A timestamp in nanoseconds since the epoch.
  public type Timestamp = Time.Time;

  // The main record representing an app bounty.
  // This structure is designed to match the mock data from the frontend.
  public type Bounty = {
    id : BountyId;
    title : Text;
    short_description : Text;
    reward_amount : Nat;
    reward_token : Text;
    status : Text; // Note: For production, consider a variant type like {#Open; #InProgress; #Closed}
    details_markdown : Text;
    created_at : Timestamp;
  };

  // ==================================================================================
  // == STATE
  // ==================================================================================

  // The owner of the canister, with administrative privileges.
  var owner : Principal = deployer;

  // The primary storage for all bounties, mapping an ID to the bounty record.
  var bounties = Map.new<BountyId, Bounty>();

  // A simple counter to ensure each new bounty gets a unique ID.
  var next_bounty_id : BountyId = 0;

  // ==================================================================================
  // == HELPER FUNCTIONS
  // ==================================================================================

  private func is_owner(caller : Principal) : Bool {
    return Principal.equal(owner, caller);
  };

  // ==================================================================================
  // == ADMIN (OWNER-ONLY) METHODS
  // ==================================================================================

  public shared query func get_owner() : async Principal {
    return owner;
  };

  public shared (msg) func transfer_ownership(new_owner : Principal) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can transfer ownership.");
    };
    owner := new_owner;
    return #ok(());
  };

  // Creates a new bounty and stores it.
  public shared (msg) func create_bounty(
    title : Text,
    short_description : Text,
    reward_amount : Nat,
    reward_token : Text,
    status : Text,
    details_markdown : Text,
  ) : async Result.Result<BountyId, Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can create bounties.");
    };

    let bounty_id = next_bounty_id;
    next_bounty_id += 1;

    let new_bounty : Bounty = {
      id = bounty_id;
      title = title;
      short_description = short_description;
      reward_amount = reward_amount;
      reward_token = reward_token;
      status = status;
      details_markdown = details_markdown;
      created_at = Time.now();
    };

    Map.set(bounties, nhash, bounty_id, new_bounty);
    return #ok(bounty_id);
  };

  // Updates an existing bounty.
  public shared (msg) func update_bounty(
    id : BountyId,
    title : Text,
    short_description : Text,
    reward_amount : Nat,
    reward_token : Text,
    status : Text,
    details_markdown : Text,
  ) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can update bounties.");
    };

    switch (Map.get(bounties, nhash, id)) {
      case (null) {
        return #err("Bounty not found.");
      };
      case (?existing_bounty) {
        let updated_bounty : Bounty = {
          // Preserve original ID and creation timestamp
          id = existing_bounty.id;
          created_at = existing_bounty.created_at;
          // Use new values for all other fields
          title = title;
          short_description = short_description;
          reward_amount = reward_amount;
          reward_token = reward_token;
          status = status;
          details_markdown = details_markdown;
        };
        Map.set(bounties, nhash, id, updated_bounty);
        return #ok(());
      };
    };
  };

  // Deletes a bounty from storage.
  public shared (msg) func delete_bounty(id : BountyId) : async Result.Result<(), Text> {
    if (not is_owner(msg.caller)) {
      return #err("Unauthorized: Only the owner can delete bounties.");
    };

    if (Map.get(bounties, nhash, id) == null) {
      return #err("Bounty not found.");
    };

    Map.delete(bounties, nhash, id);
    return #ok(());
  };

  // ==================================================================================
  // == PUBLIC QUERY METHODS
  // ==================================================================================

  // Retrieves a single bounty by its ID.
  public shared query func get_bounty(id : BountyId) : async ?Bounty {
    return Map.get(bounties, nhash, id);
  };

  // Retrieves all bounties, sorted with the most recently created ones first.
  public shared query func get_all_bounties() : async [Bounty] {
    // Convert the map values iterator to a mutable array
    let bounties_array = Iter.toArray(Map.vals(bounties));

    // Sort the array in descending order of creation time
    let sorted = Array.sort<Bounty>(
      bounties_array,
      func(a, b) {
        // Time.compare returns #lt, #eq, or #gt.
        // We want b to come before a if b is newer, so we compare b to a.
        if (a.created_at == b.created_at) {
          return #equal;
        } else if (b.created_at < a.created_at) {
          return #less; // b is newer, so it should come first
        } else {
          return #greater; // a is newer, so it should come first
        };
      },
    );

    return sorted;
  };
};
