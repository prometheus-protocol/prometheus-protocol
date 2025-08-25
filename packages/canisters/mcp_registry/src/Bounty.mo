import Result "mo:base/Result";
import ICRC127 "../../../../libs/icrc127/src/lib";

module {

  // Defines the possible states a bounty can be in for filtering.
  public type BountyStatus = {
    #Open;
    #Claimed;
  };

  // Defines the fields by which a user can filter the bounty list.
  public type BountyFilter = {
    #status : BountyStatus;
    #audit_type : Text;
    #creator : Principal;
  };

  // The request object for the list_bounties endpoint.
  public type BountyListingRequest = {
    filter : ?[BountyFilter];
    take : ?Nat;
    prev : ?Nat; // We use the bounty_id (a Nat) for cursor-based pagination.
  };

  // The response object for the list_bounties endpoint.
  public type BountyListingResponse = Result.Result<[ICRC127.Bounty], Text>;
};
