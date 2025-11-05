// Indexer.mo

import Map "mo:map/Map";
import Set "mo:map/Set";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Buffer "mo:base/Buffer";

shared ({ caller = deployer }) persistent actor class Indexer() {

  // --- STATE ---

  // The Inverted Index: Maps a search term (lowercase) to a Set of app namespaces.
  // Using a Set is efficient for storing unique values.
  var inverted_index : Map.Map<Text, Set.Set<Text>> = Map.new();
  var _registry_canister_id : ?Principal = null;
  var _owner : Principal = deployer;

  // --- PRIVATE HELPERS ---

  // CORRECTED: Helper function to normalize text without using Buffer.toText.
  // This removes characters that should be ignored, like hyphens.
  private func _normalizeText(text : Text) : Text {
    // 1. Create an array to hold the characters we want to keep.
    let char_array = Buffer.Buffer<Text>(Text.size(text));

    // 2. Iterate through the characters of the input text.
    for (char in text.chars()) {
      // 3. If the character is not a hyphen, convert it to Text and add it to our array.
      if (char != '-') {
        char_array.add(Text.fromChar(char));
      };
    };

    // 4. Join the array of single-character texts into a final, single string.
    return Text.join("", char_array.vals());
  };

  // UPDATED: Tokenizer now uses the normalization helper first.
  private func _tokenize(text : Text) : [Text] {
    // Step 1: Normalize the text (e.g., "to-do" becomes "todo").
    let normalized_text = _normalizeText(text);

    // Step 2: Convert to lowercase.
    let lower = Text.toLowercase(normalized_text);

    // Step 3: Split into tokens. The hyphen is no longer needed as a delimiter.
    let tokens = Text.split(
      lower,
      #predicate(
        func(c : Char) {
          c == ' ' or c == ',' or c == '.' or c == ':' or c == ';';
        }
      ),
    );

    // Step 4: Filter out any empty strings that might result from multiple delimiters.
    return Array.filter<Text>(Iter.toArray(tokens), func(t) { Text.size(t) > 0 });
  };

  // --- UPDATE METHOD (Called by Registry) ---

  /**
   * [SECURE] Updates the index for a given app.
   * This method can ONLY be called by the official Registry canister.
   */
  public shared ({ caller }) func update_index(namespace : Text, searchable_content : Text) : async () {
    // CRITICAL SECURITY CHECK: Ensure only the registry can update the index.
    switch (_registry_canister_id) {
      case (null) {
        Debug.trap("Registry canister ID not set. Cannot authorize update_index calls.");
      };
      case (?id) {
        if (caller != id) {
          Debug.trap("Unauthorized: Only the registry canister can update the index.");
        };
      };
    };

    // In a real-world scenario, you might first remove the old index entries for this namespace
    // to handle updates correctly. For simplicity, this example assumes additive indexing.

    let tokens = _tokenize(searchable_content);

    Debug.print("Indexing namespace: " # namespace # " with tokens: " # Text.join(", ", tokens.vals()));

    label searchLoop for (token in tokens.vals()) {
      if (Text.size(token) == 0) { continue searchLoop };

      let namespaces = Option.get(Map.get(inverted_index, Map.thash, token), Set.new<Text>());
      Set.add(namespaces, Map.thash, namespace);
      Map.set(inverted_index, Map.thash, token, namespaces);
    };
  };

  /**
   * Performs a search against the inverted index and returns matching app namespaces.
   * @param query_string The user's search string.
   * @returns An array of app namespaces that match ALL keywords in the query.
   */
  public query func search(query_string : Text) : async [Text] {
    let query_tokens = _tokenize(query_string);

    if (query_tokens.size() == 0) {
      return [];
    };

    // Find the set of matching namespaces for the first token.
    var matching_namespaces = Option.get(
      Map.get(inverted_index, Map.thash, query_tokens[0]),
      Set.new<Text>(),
    );

    // If the first token has no matches, we can stop early.
    if (Set.size(matching_namespaces) == 0) {
      return [];
    };

    // Iterate over the rest of the tokens to find the intersection.
    let remaining_tokens = Array.slice(query_tokens, 1, query_tokens.size());
    label search for (token in remaining_tokens) {
      if (Text.size(token) == 0) { continue search };

      let namespaces_for_token = Option.get(
        Map.get(inverted_index, Map.thash, token),
        Set.new<Text>(),
      );

      // --- MANUAL INTERSECTION LOGIC ---
      let intersection_result = Set.new<Text>();
      let (smaller_set, larger_set) = if (Set.size(matching_namespaces) < Set.size(namespaces_for_token)) {
        (matching_namespaces, namespaces_for_token);
      } else {
        (namespaces_for_token, matching_namespaces);
      };

      // Iterate over the smaller set for efficiency.
      for (namespace in Set.toArray(smaller_set).vals()) {
        // If the item also exists in the larger set, it's part of the intersection.
        if (Set.has(larger_set, Map.thash, namespace)) {
          Set.add(intersection_result, Map.thash, namespace);
        };
      };

      // Update our running list of matches with the new intersection.
      matching_namespaces := intersection_result;

      // Optimization: if the intersection is ever empty, no further matches are possible.
      if (Set.size(matching_namespaces) == 0) {
        break search;
      };
    };

    // Convert the final Set directly to an array.
    return Set.toArray(matching_namespaces);
  };

  /**
   * [ADMIN-ONLY] Sets the Registry canister ID.
   * This method should be called once after deployment to establish trust.
   */
  public shared ({ caller }) func set_registry_canister_id(registry_id : Principal) : async Result.Result<(), Text> {
    if (caller != _owner) { return #err("Caller is not the owner") };
    _registry_canister_id := ?registry_id;
    return #ok(());
  };

  // --- ENVIRONMENT CONFIGURATION STANDARD ---

  public type EnvDependency = {
    key : Text;
    setter : Text;
    canister_name : Text;
    required : Bool;
    current_value : ?Principal;
  };

  public type EnvConfig = {
    key : Text;
    setter : Text;
    value_type : Text;
    required : Bool;
    current_value : ?Text;
  };

  /**
   * Returns the environment requirements for this canister.
   * This enables automated configuration discovery and injection.
   */
  public query func get_env_requirements() : async {
    #v1 : {
      dependencies : [EnvDependency];
      configuration : [EnvConfig];
    };
  } {
    #v1({
      dependencies = [{
        key = "_registry_canister_id";
        setter = "set_registry_canister_id";
        canister_name = "mcp_registry";
        required = true;
        current_value = _registry_canister_id;
      }];
      configuration = [];
    });
  };

};
