import Nat "mo:base/Nat";
import ICRC126 "../../../../libs/icrc126/src/lib";
import ICRC127 "../../../../libs/icrc127/src/lib";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";

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

  // Details specific to a single version of an app.
  public type AppVersionSummary = {
    wasm_id : Text; // The WASM Hash of this version
    version_string : Text; // e.g., "1.2.0"
    security_tier : SecurityTier;
    status : AppListingStatus; // #Verified or #Pending
  };

  // The main object for the app store's list view.
  public type AppListing = {
    // --- Stable App Identity ---
    namespace : Text; // The new primary identifier
    name : Text;
    deployment_type : Text; // "global" or "provisioned"
    description : Text;
    category : Text;
    publisher : Text;
    icon_url : Text;
    banner_url : Text;
    tags : [Text];

    // --- Details of the Latest Published Version ---
    latest_version : AppVersionSummary;
  };

  // Detailed build information for a specific version.
  public type BuildInfo = {
    status : Text; // "success" | "failure" | "unknown"
    git_commit : ?Text;
    repo_url : ?Text;
    failure_reason : ?Text;
  };

  // Data safety information for a specific version.
  public type DataSafetyInfo = {
    overall_description : Text;
    data_points : [ICRC126.ICRC16Map];
  };

  public type AppVersionDetails = {
    wasm_id : Text;
    version_string : Text;
    status : AppListingStatus;
    security_tier : SecurityTier;
    build_info : BuildInfo;
    tools : [ICRC126.ICRC16Map];
    data_safety : DataSafetyInfo;
    bounties : [ICRC127.Bounty];
    audit_records : [ICRC126.AuditRecord];
  };

  public type AppDetailsResponse = {
    // Stable, app-level identity
    namespace : Text;
    name : Text;
    mcp_path : Text;
    publisher : Text;
    category : Text;
    icon_url : Text;
    banner_url : Text;
    deployment_type : Text;
    gallery_images : [Text];
    description : Text;
    key_features : [Text];
    why_this_app : Text;
    tags : [Text];

    // Version-specific details
    latest_version : AppVersionDetails;
    all_versions : [AppVersionSummary];
  };

  public type AppStoreError = {
    #NotFound : Text;
    #InternalError : Text;
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

  /**
   * Safely extracts an array of maps from an ICRC-16 metadata map.
   * It finds the key, ensures the value is an #Array variant, and then filters
   * that array to only include elements that are themselves #Map variants.
   *
   * @param meta The metadata map (as an array of tuples) to search in.
   * @param key The key for the desired array (e.g., "tools", "data_points").
   * @returns An array of ICRC16Map, or an empty array if not found or types don't match.
   */
  public func getICRC16ArrayOfMaps(meta : ICRC126.ICRC16Map, key : Text) : [ICRC126.ICRC16Map] {
    // First, find the value associated with the key in our tuple-array map.
    let found_value = Array.find<(Text, ICRC126.ICRC16)>(
      meta,
      func(entry) { entry.0 == key },
    );

    switch (found_value) {
      case (?(_, #Array(vals))) {
        // The key exists and its value is an #Array variant. Now, we filter it.
        var out = Buffer.Buffer<ICRC126.ICRC16Map>(vals.size());
        for (val in vals.vals()) {
          // Only add the element to our output if it's a #Map variant.
          switch (val) {
            case (#Map(map_val)) {
              // The element is a map, so we add its value (the array of tuples) to our output.
              out.add(map_val);
            };
            case (_) {
              // Ignore other types like #Text, #Nat, etc.
            };
          };
        };
        return Buffer.toArray(out);
      };
      case (_) {
        // The key was not found or its value was not an #Array variant. Return empty.
        return [];
      };
    };
  };

  // Get ICRC16 Text Array:
  public func getICRC16TextArray(map : ICRC126.ICRC16Map, key : Text) : [Text] {
    switch (getICRC16Field(map, key)) {
      case (null) { return [] }; // Not found, return default empty array
      case (?(#Array(arr))) {
        // We found an array, but we need to ensure all elements are Text.
        var texts = Buffer.Buffer<Text>(arr.size());
        for (item in arr.vals()) {
          switch (item) {
            case (#Text(t)) { texts.add(t) };
            case (_) { /* Ignore non-Text items */ };
          };
        };
        return Buffer.toArray(texts);
      };
      case (_) { return [] }; // Found but is wrong type, return default
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

  // getICRC16Principal
  public func getICRC16Principal(map : ICRC126.ICRC16Map, key : Text) : Principal {
    switch (getICRC16Field(map, key)) {
      case (null) { return Principal.fromText("aaaaa-aa") }; // Not found, return default anonymous principal
      case (?(#Principal(p))) { return p }; // Found and is Principal, return the value
      case (_) { return Principal.fromText("aaaaa-aa") }; // Found but is wrong type, return default anonymous principal
    };
  };

  /**
   * A helper function that filters a raw list of audit records and returns
   * an array of the audit types for which a successful attestation exists.
   * It ignores all divergence reports.
   *
   * @param records The raw array of AuditRecord variants from the registry.
   * @returns An array of strings, where each string is a successfully completed audit_type.
   */
  public func get_completed_audit_types(records : [ICRC126.AuditRecord]) : [Text] {
    // Use a buffer for efficient appends.
    var completed_types = Buffer.Buffer<Text>(records.size());

    // Iterate through all records for the WASM.
    for (record in records.vals()) {
      // We only care about successful attestations.
      switch (record) {
        case (#Attestation(att)) {
          // This is a successful audit. Add its type to our list.
          // We specifically exclude build_reproducibility_v1 as it's a prerequisite
          // for listing, not a factor in the security tier itself.
          if (att.audit_type != "build_reproducibility_v1") {
            completed_types.add(att.audit_type);
          };
        };
        case (#Divergence(_)) {
          // This is a failure report. We ignore it for tier calculation.
        };
      };
    };

    return Buffer.toArray(completed_types);
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
