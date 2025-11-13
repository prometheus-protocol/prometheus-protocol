import Result "mo:base/Result";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Random "mo:base/Random";
import Text "mo:base/Text";
import Nat8 "mo:base/Nat8";
import Blob "mo:base/Blob";
import Types "Types";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";

module {

  /**
   * Record that an API key was used (for monitoring in dashboard).
   */
  private func _record_api_key_usage(api_credentials : Map.Map<Text, Types.ApiCredential>, api_key : Text) {
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { /* Invalid key, ignore */ };
      case (?cred) {
        let updated_cred : Types.ApiCredential = {
          api_key = cred.api_key;
          verifier_principal = cred.verifier_principal;
          created_at = cred.created_at;
          last_used = ?Time.now();
          is_active = cred.is_active;
        };
        Map.set(api_credentials, thash, api_key, updated_cred);
      };
    };
  };

  /**
   * Generate a random API key from entropy.
   * Returns a 32-character hexadecimal string (128 bits of entropy).
   */
  private func _generate_api_key(entropy : Blob) : Text {
    let bytes = Blob.toArray(entropy);
    let hex_chars = "0123456789abcdef";

    var result = "";
    var i = 0;

    while (i < 16 and i < bytes.size()) {
      let byte = bytes[i];
      let high = Nat8.toNat(byte / 16);
      let low = Nat8.toNat(byte % 16);

      result := result # Text.fromChar(Text.toArray(hex_chars)[high]);
      result := result # Text.fromChar(Text.toArray(hex_chars)[low]);

      i += 1;
    };

    return "vr_" # result; // Prefix with "vr_" for clarity
  };

  public func generate_api_key(caller : Principal, api_credentials : Map.Map<Text, Types.ApiCredential>, verifier_api_keys : Map.Map<Principal, [Text]>) : async Result.Result<Text, Text> {
    let verifier = caller;

    // Generate a random API key (128-bit hex string)
    let entropy = await Random.blob();
    let api_key = _generate_api_key(entropy);

    // Store credential
    let credential : Types.ApiCredential = {
      api_key = api_key;
      verifier_principal = verifier;
      created_at = Time.now();
      last_used = null;
      is_active = true;
    };

    Map.set(api_credentials, thash, api_key, credential);

    // Update verifier's API key list
    let existing_keys = Option.get(Map.get(verifier_api_keys, phash, verifier), []);
    Map.set(verifier_api_keys, phash, verifier, Array.append(existing_keys, [api_key]));

    return #ok(api_key);
  };

  /**
   * Revoke an API key (makes it inactive).
   */
  public func revoke_api_key(caller : Principal, api_credentials : Map.Map<Text, Types.ApiCredential>, api_key : Text) : Result.Result<(), Text> {
    let verifier = caller;

    // Check if this API key belongs to the caller
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("API key not found.") };
      case (?cred) {
        if (not Principal.equal(cred.verifier_principal, verifier)) {
          return #err("Unauthorized: This API key does not belong to you.");
        };

        // Deactivate the key
        let updated_cred : Types.ApiCredential = {
          api_key = cred.api_key;
          verifier_principal = cred.verifier_principal;
          created_at = cred.created_at;
          last_used = cred.last_used;
          is_active = false;
        };

        Map.set(api_credentials, thash, api_key, updated_cred);
        return #ok(());
      };
    };
  };

  /**
   * Validate an API key and return the associated verifier principal.
   * Used by the verifier bot to authenticate reserve_bounty requests.
   */
  public func validate_api_key(api_credentials : Map.Map<Text, Types.ApiCredential>, api_key : Text) : Result.Result<Principal, Text> {
    switch (Map.get(api_credentials, thash, api_key)) {
      case (null) { return #err("Invalid API key.") };
      case (?cred) {
        if (not cred.is_active) {
          return #err("API key has been revoked.");
        };
        return #ok(cred.verifier_principal);
      };
    };
  };

  /**
   * List all API keys for the authenticated verifier.
   */
  public func list_api_keys(caller : Principal, api_credentials : Map.Map<Text, Types.ApiCredential>, verifier_api_keys : Map.Map<Principal, [Text]>) : [Types.ApiCredential] {
    let verifier = caller;
    let api_keys = Option.get(Map.get(verifier_api_keys, phash, verifier), []);

    let credentials = Array.mapFilter<Text, Types.ApiCredential>(
      api_keys,
      func(key : Text) : ?Types.ApiCredential {
        Map.get(api_credentials, thash, key);
      },
    );

    return credentials;
  };

};
