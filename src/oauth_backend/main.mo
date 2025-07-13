import Principal "mo:base/Principal";
import Time "mo:base/Time";
import HttpParser "mo:http-parser";
import BaseX "mo:base-x-encoder";
import Map "mo:map/Map";
import { thash } "mo:map/Map";

import Text "mo:base/Text";
import Random "mo:base/Random";

import Blob "mo:base/Blob";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";

actor {
  // =================================================================================================
  // TYPES - The "Nouns" of our system
  // =================================================================================================

  // Represents a registered application (a resource server).
  public type Client = {
    client_id : Text;
    owner : Principal; // The Principal that can manage this client.
    client_secret_hash : Text; // We NEVER store the raw secret.
    client_name : Text;
    logo_uri : Text;
    redirect_uris : [Text]; // List of allowed callback URLs. CRITICAL for security.
  };

  // Represents a temporary code used to get a real token.
  public type AuthorizationCode = {
    code : Text; // The random string itself.
    user_principal : Principal;
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    expires_at : Time.Time;
  };

  // Represents a user's active subscription.
  public type Subscription = {
    user_principal : Principal;
    tier : Text; // e.g., "Pro", "Free"
    expires_at : Time.Time;
  };

  // Represents the temporary state during the II login flow.
  type AuthorizeSession = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : ?Text; // The 'state' parameter from the original request.
    expires_at : Time.Time;
  };

  // A type to hold the validated and cleaned-up request parameters.
  type ValidatedAuthRequest = {
    client : Client;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
  };

  // =================================================================================================
  // STATE - The Canister's Memory
  // =================================================================================================

  // Maps a client_id (Text) to its Client record.
  stable var clients = Map.new<Text, Client>();

  // Maps an authorization code string (Text) to its data.
  stable var auth_codes = Map.new<Text, AuthorizationCode>();

  // Maps a user's Principal to their subscription status.
  stable var subscriptions = Map.new<Principal, Subscription>();

  // Maps a temporary session ID (Text) to the authorization request details.
  stable var authorize_sessions = Map.new<Text, AuthorizeSession>();

  // =================================================================================================
  // PRIVATE HELPER FUNCTIONS
  // =================================================================================================

  func validate_authorize_request(
    client_id_opt : ?Text,
    redirect_uri_opt : ?Text,
    response_type_opt : ?Text,
    state_opt : ?Text,
    scope_opt : ?Text,
  ) : async Result.Result<ValidatedAuthRequest, Text> {
    // 1. Check for required parameters
    let response_type = switch (response_type_opt) {
      case (?rt) rt;
      case (_) return #err("response_type is required");
    };
    let client_id = switch (client_id_opt) {
      case (?id) id;
      case (_) return #err("client_id is required");
    };
    let redirect_uri = switch (redirect_uri_opt) {
      case (?uri) uri;
      case (_) return #err("redirect_uri is required");
    };

    // 2. Validate response_type
    if (response_type != "code") {
      return #err("unsupported response_type: must be 'code'");
    };

    // 3. Validate client_id
    let client = switch (Map.get(clients, thash, client_id)) {
      case (null) { return #err("invalid client_id: client not found") };
      case (?c) c;
    };

    // 4. CRITICAL: Validate redirect_uri
    func isRedirectUri(uri : Text) : Bool {
      return uri == redirect_uri;
    };

    if (Option.isNull(Array.find<Text>(client.redirect_uris, isRedirectUri))) {
      return #err("invalid redirect_uri: URI not registered for this client");
    };

    // 5. If all checks pass, return the validated data.
    let scope = Option.get(scope_opt, "");
    return #ok({
      client = client;
      redirect_uri = redirect_uri;
      scope = scope;
      state = state_opt;
    });
  };

  // This is the single, correct implementation of handle_authorize
  func handle_authorize(req : HttpParser.ParsedHttpRequest) : async HttpParser.HttpResponse {
    // 1. Parse query parameters
    let client_id_opt = req.url.queryObj.get("client_id");
    let redirect_uri_opt = req.url.queryObj.get("redirect_uri");
    let response_type_opt = req.url.queryObj.get("response_type");
    let state_opt = req.url.queryObj.get("state");
    let scope_opt = req.url.queryObj.get("scope");

    // 2. Validate the request using our helper function
    let validation_result = await validate_authorize_request(
      client_id_opt,
      redirect_uri_opt,
      response_type_opt,
      state_opt,
      scope_opt,
    );

    switch (validation_result) {
      case (#err(error_message)) {
        // If validation fails, return a 400 Bad Request error.
        return {
          status_code = 400;
          headers = [];
          body = Text.encodeUtf8("Invalid Request: " # error_message);
        };
      };
      case (#ok(validated_req)) {
        // 3. If valid, create a temporary session.
        let session_id_blob = await Random.blob();
        let session_id = BaseX.toHex(session_id_blob.vals(), { isUpper = false; prefix = #none });

        let session_data : AuthorizeSession = {
          client_id = validated_req.client.client_id;
          redirect_uri = validated_req.redirect_uri;
          scope = validated_req.scope;
          state = validated_req.state;
          expires_at = Time.now() + (5 * 60 * 1_000_000_000); // 5 minutes
        };
        Map.set(authorize_sessions, thash, session_id, session_data);

        // 4. Redirect the user to our own login page.
        let canister_id = "uxrrr-q7777-77774-qaaaq-cai"; // Replace this
        let login_url = "http://" # canister_id # ".localhost:4943/login?session_id=" # session_id;

        return {
          status_code = 302;
          headers = [("Location", login_url)];
          body = Blob.fromArray([]);
        };
      };
    };
  };

  // =================================================================================================
  // PUBLIC API - Canister Endpoints
  // =================================================================================================

  // The main HTTP entry point
  public shared func http_request_update(rawReq : HttpParser.HttpRequest) : async HttpParser.HttpResponse {
    let req = HttpParser.parse(rawReq);
    let path = req.url.path.original;

    switch (path) {
      case ("/authorize") { return await handle_authorize(req) };
      case (_) {
        return {
          status_code = 404;
          headers = [];
          body = Text.encodeUtf8("Not Found");
        };
      };
    };
  };
  // In main.mo

  public shared func complete_authorize(session_id : Text, user_principal : Principal) : async Text {
    // 1. Look up the session and handle errors.
    let session = switch (Map.get(authorize_sessions, thash, session_id)) {
      case (null) { Debug.trap("Invalid or already used session ID") };
      case (?s) s;
    };

    // 2. Check for session expiration.
    if (session.expires_at < Time.now()) {
      // Clean up the expired session before trapping.
      Map.delete(authorize_sessions, thash, session_id);
      Debug.trap("Session has expired");
    };

    // 3. Generate a new, secure authorization code.
    let code_blob = await Random.blob();
    let code = BaseX.toHex(code_blob.vals(), { isUpper = false; prefix = #none });

    // 4. Create the AuthorizationCode record with a 10-minute expiry.
    let auth_code_data : AuthorizationCode = {
      code = code;
      user_principal = user_principal;
      client_id = session.client_id;
      redirect_uri = session.redirect_uri;
      scope = session.scope;
      expires_at = Time.now() + (10 * 60 * 1_000_000_000); // 10 minutes
    };

    // 5. Store the new code.
    Map.set(auth_codes, thash, code, auth_code_data);

    // 6. CRITICAL: Clean up the used session. A session must be single-use.
    Map.delete(authorize_sessions, thash, session_id);

    // 7. Construct the final redirect URL, including the optional state parameter.
    let state_param = switch (session.state) {
      case (?s) "&state=" # s; // Use '&' since 'code' is the first param.
      case (_) "";
    };

    let final_url = session.redirect_uri # "?code=" # code # state_param;

    // 8. Return the URL for the frontend to perform the redirect.
    return final_url;
  };

  // Temporary function for testing.
  public shared func add_test_client(client : Client) {
    // TODO: Add security check: assert(caller == controller);
    Map.set(clients, thash, client.client_id, client);
  };

  public query (message) func greet() : async Text {
    return "Hello, " # Principal.toText(message.caller) # "!";
  };

  public query func get_subs() : async [Subscription] {
    return Iter.toArray(Map.vals(subscriptions));
  };
};
