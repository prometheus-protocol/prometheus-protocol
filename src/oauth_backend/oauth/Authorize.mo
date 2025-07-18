import Types "Types";
import Validation "Validation";
import Errors "Errors";
import Random "mo:base/Random";
import BaseX "mo:base-x-encoder";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Result "mo:base/Result";

module {
  public func handle_authorize(context : Types.Context, req : Types.Request, res : Types.ResponseClass) : async Types.Response {

    // 1. Perform all validation in one step.
    let validation_result = await Validation.validate_authorize_request(context, req);

    switch (validation_result) {
      case (#err(error_message)) {
        // If validation fails, send a standardized error and stop.
        return await Errors.send_authorize_error(res, error_message);
      };
      case (#ok(validated_req)) {
        // 2. On success, create a temporary session for the login flow.
        let session_id_blob = await Random.blob();
        let session_id = BaseX.toHex(session_id_blob.vals(), { isUpper = false; prefix = #none });

        let session_data : Types.AuthorizeSession = {
          client_id = validated_req.client_id;
          redirect_uri = validated_req.redirect_uri;
          scope = validated_req.scope;
          state = validated_req.state;
          expires_at = Time.now() + (5 * 60 * 1_000_000_000); // 5 minutes
          code_challenge = validated_req.code_challenge;
          code_challenge_method = validated_req.code_challenge_method;
          audience = validated_req.audience;
          resource = validated_req.resource; // Include the resource if specified
          var status = #awaiting_login;
          var user_principal = null; // Initially no user principal
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

        let frontend_host = Text.replace(
          host,
          #text(Principal.toText(context.self)),
          Principal.toText(context.frontend_canister_id),
        );

        let login_url = protocol # "://" # frontend_host # "/login?session_id=" # session_id;

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

    // 3. Check if the `prometheus:charge` scope was requested
    let requires_payment_setup = Text.contains(session.scope, #text("prometheus:charge"));
    var next_step : Types.AuthFlowStep = #consent;

    // 4. Determine the next step based *only* on the presence of the scope.
    if (requires_payment_setup) {
      // If the charge scope is present, ALWAYS go to the setup page.
      session.status := #awaiting_payment_setup;
      next_step := #setup;
    } else {
      // If the scope is not present, go directly to consent.
      session.status := #awaiting_consent;
      next_step := #consent;
    };

    // 5. Update the session in the map
    Map.set(context.authorize_sessions, thash, session_id, session);

    // 6. Prepare and return the data for the frontend
    let client = switch (Map.get(context.clients, thash, session.client_id)) {
      case (null) return #err("Internal error: Client not found for session.");
      case (?c) c;
    };
    let consent_data : Types.ConsentData = {
      client_name = client.client_name;
      scope = session.scope;
      logo_uri = client.logo_uri;
    };

    return #ok({ next_step = next_step; consent_data = consent_data });
  };

  // This function is called by the frontend after the user successfully sets up their allowance.
  public func complete_payment_setup(context : Types.Context, session_id : Text, caller : Principal) : async Result.Result<Null, Text> {
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) return #err("Invalid or expired session ID.");
      case (?s) s;
    };

    // VALIDATE that the caller is the bound user.
    switch (session.user_principal) {
      case (null) return #err("Session not yet associated with a user.");
      case (?owner_principal) {
        if (owner_principal != caller) {
          return #err("Caller does not match session owner.");
        };
      };
    };

    // Validate state transition
    if (session.status != #awaiting_payment_setup) {
      return #err("Invalid session state. Expected #awaiting_payment_setup.");
    };

    // Transition state to the final consent step
    session.status := #awaiting_consent;
    Map.set(context.authorize_sessions, thash, session_id, session);

    return #ok(null);
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
      audience = session.audience;
      resource = session.resource; // Include the resource if specified
    };
    Map.set(context.auth_codes, thash, code, auth_code_data);
    Map.delete(context.authorize_sessions, thash, session_id);
    let state_param = "&state=" # session.state;
    let final_url = session.redirect_uri # "?code=" # code # state_param;
    return #ok(final_url);
  };
};
