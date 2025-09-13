import Nat "mo:base/Nat";
import ICRC126 "../../../../libs/icrc126/src/lib";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Array "mo:base/Array";

module {

  // A variant to represent the calculated security tier.
  public type SecurityTier = {
    #Gold;
    #Silver;
    #Bronze;
    // For apps that are listed but haven't met the Bronze criteria yet.
    #Unranked;
  };

  public type AppListingStatus = {
    #Pending;
    #Verified;
    #Rejected : { reason : Text };
  };

  public type AppListing = {
    id : Text; // This is the hex string of the WASM hash
    namespace : Text;
    name : Text;
    description : Text;
    category : Text;
    // Fields from the app_info_v1 attestation
    publisher : Text;
    icon_url : Text;
    banner_url : Text;
    security_tier : SecurityTier;
    status : AppListingStatus;
  };

  public type AppListingFilter = {
    #namespace : Text;
    #publisher : Text;
    #name : Text;
  };

  public type AppListingRequest = {
    filter : ?[AppListingFilter];
    prev : ?Text; // Pagination: previous namespace to start from
    take : ?Nat; // Pagination: number of results to return
  };

  public type AppListingResponse = Result.Result<[AppListing], Text>;

  // 1. The generic, low-level helper. It finds a key and returns the entire ICRC16 variant.
  //    This is the foundation for the other helpers.
  public func getICRC16Field(map : ICRC126.ICRC16Map, key : Text) : ?ICRC126.ICRC16 {
    for ((k, v) in map.vals()) { if (k == key) return ?v };
    null;
  };

  // 2. A specific helper for safely extracting a Text value.
  //    It uses the generic helper and provides a safe default.
  public func getICRC16Text(map : ICRC126.ICRC16Map, key : Text) : Text {
    switch (getICRC16Field(map, key)) {
      case (null) { return "" }; // Not found, return default empty string
      case (?(#Text(t))) { return t }; // Found and is Text, return the value
      case (_) { return "" }; // Found but is wrong type, return default
    };
  };

  // 3. A specific helper for safely extracting a Nat value.
  //    This matches the pattern from your commented-out example.
  public func getICRC16Nat(map : ICRC126.ICRC16Map, key : Text) : ?Nat {
    switch (getICRC16Field(map, key)) {
      case (null) { return null }; // Not found, return null
      case (?(#Nat(n))) { return ?n }; // Found and is Nat, return the optional value
      case (_) { return null }; // Found but is wrong type, return null
    };
  };

  // Add this new helper function. It's designed specifically for filtering.
  public func getICRC16TextOptional(map : ICRC126.ICRC16Map, key : Text) : ?Text {
    switch (getICRC16Field(map, key)) {
      case (null) { return null }; // Not found, return null
      case (?(#Text(t))) { return ?t }; // Found and is Text, return the optional value
      case (_) { return null }; // Found but is wrong type, return null
    };
  };

  // Get ICRC16 Blob Optional:
  public func getICRC16BlobOptional(map : ICRC126.ICRC16Map, key : Text) : ?Blob {
    switch (getICRC16Field(map, key)) {
      case (null) { return null }; // Not found, return null
      case (?(#Blob(b))) { return ?b }; // Found and is Blob, return the optional value
      case (_) { return null }; // Found but is wrong type, return null
    };
  };

  // getICRC16MapOptional
  public func getICRC16MapOptional(map : ICRC126.ICRC16Map, key : Text) : ?ICRC126.ICRC16Map {
    switch (getICRC16Field(map, key)) {
      case (null) { return null }; // Not found, return null
      case (?(#Map(m))) { return ?m }; // Found and is Map, return the optional value
      case (_) { return null }; // Found but is wrong type, return null
    };
  };

  // Helper function to determine the security tier based on a definitive verification status
  // and a list of completed declarative audits.
  public func calculate_security_tier(
    is_build_verified : Bool,
    completed_declarative_audits : [Text],
  ) : SecurityTier {
    // Helper to check if a specific declarative audit is present.
    func has_audit(audit_type : Text) : Bool {
      return Option.isSome(Array.find<Text>(completed_declarative_audits, func(a) { a == audit_type }));
    };

    // The core logic now relies on the `is_build_verified` boolean, which is the
    // unambiguous result of the ICRC-126 verification lifecycle.

    // Gold: Requires a verified build AND all key declarative audits.
    if (
      is_build_verified and
      has_audit("app_info_v1") and
      has_audit("tools_v1") and
      has_audit("data_safety_v1")
    ) {
      return #Gold;
    };

    // Silver: Verified build, app info, and tools.
    if (
      is_build_verified and
      has_audit("app_info_v1") and
      has_audit("tools_v1")
    ) {
      return #Silver;
    };

    // Bronze: The foundation of trust - a verified build and basic app info.
    if (
      is_build_verified and
      has_audit("app_info_v1")
    ) {
      return #Bronze;
    };

    return #Unranked;
  };
};
