import Types "Types";
import Validation "Validation";
import Errors "Errors";
import Random "mo:base/Random";
import BaseX "mo:base-x-encoder";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { phash; thash } "mo:map/Map";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Result "mo:base/Result";
import Scope "Scope";
import Utils "../http-parser/Utils";

module {
  public func handle_authorize(context : Types.Context, req : Types.Request, res : Types.ResponseClass) : async Types.Response {

    // 1. Perform all validation in one step.
    let validation_result = Validation.validate_authorize_request(context, req);

    switch (validation_result) {
      case (#err(error_message)) {
        // If validation fails, send a standardized error and stop.
        return Errors.send_authorize_error(res, error_message);
      };
      case (#ok(validated)) {
        let session_id_blob = await Random.blob();
        let session_id = BaseX.toHex(session_id_blob.vals(), { isUpper = false; prefix = #none });

        // 2. CRITICAL: Create the session with ALL required data from the start.
        let session_data : Types.AuthorizeSession = {
          // Standard OAuth params
          client_id = validated.params.client_id;
          redirect_uri = validated.params.redirect_uri;
          scope = validated.params.scope;
          state = validated.params.state;
          expires_at = Time.now() + (5 * 60 * 1_000_000_000); // 5 minutes
          code_challenge = validated.params.code_challenge;
          code_challenge_method = validated.params.code_challenge_method;
          resource = validated.params.resource;
          var status = #awaiting_login;
          var user_principal = null;

          // Pre-fetched Resource Server data
          resource_server_id = validated.resource_server.resource_server_id;
          resource_server_name = validated.resource_server.name;
          resource_server_logo = validated.resource_server.logo_uri;
          // Assuming the first service principal is the spender for now.
          // This logic might need to be more sophisticated later.
          spender_principal = validated.resource_server.service_principals[0];
          accepted_payment_canisters = validated.resource_server.accepted_payment_canisters;
        };
        Map.set(context.authorize_sessions, thash, session_id, session_data);

        // 3. Construct the redirect URL to the frontend canister.
        let host = switch (req.headers.get("host")) {
          case (?values) {
            if (values.size() == 0) Debug.trap("Host header is present but empty");
            values[0];
          };
          case (_) Debug.trap("Host header is missing from the request");
        };

        let protocol = switch (req.headers.get("x-forwarded-proto")) {
          case (?proto_values) proto_values[0];
          case (_) "http";
        };

        let frontend_host = switch (validated.resource_server.frontend_host) {
          case (null) {
            protocol # "://" # Text.replace(
              host,
              #text(Principal.toText(context.self)),
              Principal.toText(context.frontend_canister_id),
            );
          };
          case (?custom_host) custom_host;
        };

        let login_url = frontend_host # "/login?session_id=" # session_id;

        // 4. Redirect the user to the login page.
        return res.send({
          status_code = 302;
          headers = [("Location", login_url)];
          body = Blob.fromArray([]);
          streaming_strategy = null;
          cache_strategy = #noCache;
        });
      };
    };
  };

  public func confirm_login(context : Types.Context, session_id : Text, caller : Principal) : async Result.Result<Types.LoginConfirmation, Text> {
    // 1. Get the session
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) return #err("Invalid or expired session ID.");
      case (?s) s;
    };

    // 2. Validate the session is in the correct state
    if (session.status != #awaiting_login) {
      return #err("Invalid session state.");
    };
    if (session.user_principal != null) {
      return #err("Session already confirmed by a user.");
    };

    // BIND the session to the caller's principal.
    session.user_principal := ?caller;

    // --- THE CORE CHANGE ---
    // The flow is now streamlined. After login, the user ALWAYS proceeds to the consent screen.
    // The responsibility of checking allowances is moved out of the authorization flow and
    // onto the resource server at the time of the charge attempt.

    // 3. Transition the session state directly to awaiting consent.
    session.status := #awaiting_consent;
    Map.set(context.authorize_sessions, thash, session_id, session);

    // 4. Prepare the data for the consent screen.
    let scope_details = Scope.build_scope_details(context, session);
    let consent_data : Types.ConsentData = {
      client_name = session.resource_server_name;
      logo_uri = session.resource_server_logo;
      scopes = scope_details;
    };

    // 5. Return the confirmation, always directing the frontend to the #consent step.
    return #ok({
      next_step = #consent; // Always go to consent now.
      consent_data = consent_data;
      // We still pass this so the consent screen can show which tokens are accepted if needed.
      accepted_payment_canisters = session.accepted_payment_canisters;
    });
  };

  public func complete_authorize(context : Types.Context, session_id : Text, caller : Principal) : async Result.Result<Text, Text> {
    // 1. Look up the session and handle errors.
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) { return #err("Invalid or already used session ID.") };
      case (?s) s;
    };

    // 2. VALIDATE that the caller is the bound user.
    let user_principal = switch (session.user_principal) {
      case (null) return #err("Session not yet associated with a user.");
      case (?owner_principal) {
        if (owner_principal != caller) {
          return #err("Caller does not match session owner.");
        };
        owner_principal; // Return the principal for use below
      };
    };

    if (session.status != #awaiting_consent) {
      return #err("Invalid session state.");
    };

    // 3. Check for session expiration.
    if (session.expires_at < Time.now()) {
      Map.delete(context.authorize_sessions, thash, session_id);
      return #err("Login session has expired.");
    };

    // Get the user's existing set of grants, or create a new empty one if this is their first time.
    let grants_for_user = switch (Map.get(context.user_grants, phash, user_principal)) {
      case (null) Map.new<Text, Null>();
      case (?existing_set) existing_set;
    };

    // Add the new resource server ID to the user's set of grants.
    Map.set(grants_for_user, thash, session.resource_server_id, null);

    // Save the updated set back to the main map.
    Map.set(context.user_grants, phash, user_principal, grants_for_user);

    // 4. Create the one-time authorization code
    let code_blob = await Random.blob();
    let code = BaseX.toHex(code_blob.vals(), { isUpper = false; prefix = #none });
    let auth_code_data : Types.AuthorizationCode = {
      code = code;
      user_principal = user_principal;
      client_id = session.client_id;
      redirect_uri = session.redirect_uri;
      scope = session.scope;
      expires_at = Time.now() + (60 * 1_000_000_000);
      code_challenge = session.code_challenge;
      code_challenge_method = session.code_challenge_method;
      resource = session.resource; // Include the resource if specified
    };
    Map.set(context.auth_codes, thash, code, auth_code_data);
    Map.delete(context.authorize_sessions, thash, session_id);
    let state_param = switch (session.state) {
      case (?exists) "&state=" # Utils.encodeURIComponent(exists);
      case (null) "";
    };
    let final_url = session.redirect_uri # "?code=" # code # state_param;
    Debug.print("Final redirect URL: " # final_url);
    return #ok(final_url);
  };

  public func deny_consent(context : Types.Context, session_id : Text, caller : Principal) : async Result.Result<Text, Text> {
    // 1. Look up the session and handle errors.
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) { return #err("Invalid or already used session ID.") };
      case (?s) s;
    };

    // 2. VALIDATE that the caller is the bound user.
    switch (session.user_principal) {
      case (null) return #err("Session not yet associated with a user.");
      case (?owner_principal) {
        if (owner_principal != caller) {
          return #err("Caller does not match session owner.");
        };
      };
    };

    // 3. Get the necessary data before deleting the session.
    let redirect_uri = session.redirect_uri;
    let state = switch (session.state) {
      case (?exists) "&state=" # exists;
      case (null) "";
    };

    // 4. CRITICAL: Clean up the session immediately.
    Map.delete(context.authorize_sessions, thash, session_id);

    // 5. Construct the redirect URL according to OAuth 2.1 spec for access denial.
    let final_url = redirect_uri # "?error=access_denied" # state;

    return #ok(final_url);
  };
};
