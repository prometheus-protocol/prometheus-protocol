import Text "mo:base/Text";
import Result "mo:base/Result";
import Types "Types";
import Time "mo:base/Time";
import Option "mo:base/Option";
import Array "mo:base/Array";
import BaseX "mo:base-x-encoder";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Utils "Utils";
import Sha256 "mo:sha2/Sha256";
import Debug "mo:base/Debug";

module {

  public func validate_authorize_request(
    context : Types.Context,
    req : Types.Request,
  ) : Result.Result<Types.ValidatedAuthorizeRequest, Text> {

    // --- 1. Unwrap all required parameters using the switch/return pattern ---
    let response_type = switch (req.url.queryObj.get("response_type")) {
      case (?v) v;
      case (null) return #err("response_type is required");
    };
    let client_id = switch (req.url.queryObj.get("client_id")) {
      case (?v) v;
      case (null) return #err("client_id is required");
    };
    let redirect_uri = switch (req.url.queryObj.get("redirect_uri")) {
      case (?v) v;
      case (null) return #err("redirect_uri is required");
    };
    let code_challenge = switch (req.url.queryObj.get("code_challenge")) {
      case (?v) v;
      case (null) return #err("code_challenge is required for PKCE");
    };
    let code_challenge_method = switch (req.url.queryObj.get("code_challenge_method")) {
      case (?v) v;
      case (null) return #err("code_challenge_method is required for PKCE");
    };
    let resource_uri = switch (req.url.queryObj.get("resource")) {
      case (?v) v;
      case (null) return #err("resource parameter is required");
    };
    // The scope parameter is optional, so Option.get with a default is correct here.
    let scope_string = Option.get(req.url.queryObj.get("scope"), "");

    // The state parameter is optional.
    let state = req.url.queryObj.get("state");
    Debug.print("State parameter: " # debug_show (state));

    // --- 2. Validate Parameter Values ---
    if (response_type != "code") {
      return #err("unsupported response_type: must be 'code'");
    };
    if (code_challenge_method != "S256") {
      return #err("code_challenge_method must be 'S256'");
    };

    // --- 3. Validate the Client and Redirect URI ---
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) return #err("invalid client_id: client not found");
      case (?c) c;
    };
    if (client.status != #active) {
      return #err("Invalid Client: Client is not active.");
    };

    // --- 4. CRITICAL: Validate redirect_uri ---
    func isRedirectUri(uri : Text) : Bool {
      return Utils.normalize_uri(uri) == Utils.normalize_uri(redirect_uri);
    };

    if (Option.isNull(Array.find<Text>(client.redirect_uris, isRedirectUri))) {
      return #err("invalid redirect_uri: URI not registered for this client");
    };

    // --- 4. Validate the Resource Server ---
    let normalized_uri = Utils.normalize_uri(resource_uri);
    let rs_id = switch (Map.get(context.uri_to_rs_id, thash, normalized_uri)) {
      case (null) return #err("The specified 'resource' URI is not registered.");
      case (?id) id;
    };
    let resource_server = switch (Map.get(context.resource_servers, thash, rs_id)) {
      case (null) return #err("Internal error: Resource server ID found but data is missing.");
      case (?rs) rs;
    };

    // --- 5. Validate Scopes against the Resource Server ---
    // Only perform scope validation if a resource server is targeted.
    let requested_scopes = Text.split(scope_string, #char ' ');
    let supported_scopes_map = Map.fromIter<Text, Text>(resource_server.scopes.vals(), thash);

    label checkScopes for (scope in requested_scopes) {
      // These are our globally recognized, protocol-level scopes.
      // We also silently ignore `profile` for compatibility with generic OIDC clients.
      if (scope == "openid" or scope == "prometheus:charge" or scope == "profile") {
        continue checkScopes;
      };

      // For all other scopes, they MUST be registered by the resource server.
      if (Option.isNull(Map.get(supported_scopes_map, thash, scope))) {
        return #err("invalid_scope: The scope '" # scope # "' is not supported by this resource server.");
      };
    };

    // --- 6. Additional Security/Logic Checks ---
    if (Text.contains(scope_string, #text("prometheus:charge")) and resource_server.accepted_payment_canisters.size() == 0) {
      return #err("invalid_request: The target resource server does not support payments.");
    };

    // --- 7. If all checks pass, return the structured, validated data ---
    return #ok({
      params = {
        client_id = client_id;
        redirect_uri = redirect_uri;
        scope = scope_string;
        state = state;
        code_challenge = code_challenge;
        code_challenge_method = code_challenge_method;
        resource = normalized_uri;
      };
      resource_server = resource_server;
    });
  };

  public func validate_token_request(
    context : Types.Context,
    form : Types.Form,
  ) : Result.Result<Types.ValidatedTokenRequest, (Nat, Text, Text)> {

    // Helper to get a required parameter from the form.
    func get_required(key : Text) : Result.Result<Text, (Nat, Text, Text)> {
      switch (form.get(key)) {
        case (?values) {
          if (values.size() > 0) { #ok(values[0]) } else {
            #err((400, "invalid_request", key # " is missing"));
          };
        };
        case (_) #err((400, "invalid_request", key # " is missing"));
      };
    };

    // 1. Check for all required parameters.
    let grant_type = switch (get_required("grant_type")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };
    let code = switch (get_required("code")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };
    let client_id = switch (get_required("client_id")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };
    let code_verifier = switch (get_required("code_verifier")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };
    let redirect_uri = switch (get_required("redirect_uri")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };

    if (grant_type != "authorization_code") {
      return #err((400, "unsupported_grant_type", ""));
    };

    // 2. Validate the authorization code itself.
    let auth_code_record = switch (Map.get(context.auth_codes, thash, code)) {
      case (null) return #err((400, "invalid_grant", "Authorization code is invalid or expired"));
      case (?rec) rec;
    };

    // TODO: VSCode does not submit resource in the token request, so we don't validate it here.
    // // 3. The `resource` parameter is now REQUIRED in the token request form.
    // let resource_from_form = switch (form.get("resource")) {
    //   case (?values) {
    //     if (values.size() == 0) return #err((400, "invalid_request", "resource parameter is missing"));
    //     values[0];
    //   };
    //   case (_) return #err((400, "invalid_request", "resource parameter is missing"));
    // };

    // // The `resource` from the form MUST match the one stored with the authorization code.
    // // Compare the resource from the form with the one stored with the code
    // if (Utils.normalize_uri(auth_code_record.resource) != Utils.normalize_uri(resource_from_form)) {
    //   Debug.print("Validating resource: " # Utils.normalize_uri(auth_code_record.resource) # " against " # Utils.normalize_uri(resource_from_form));
    //   return #err((400, "invalid_grant", "resource parameter mismatch"));
    // };

    // 3. Validate client and secret.
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) return #err((400, "invalid_client", "Client not found"));
      case (?c) c;
    };

    // 4. Validate code integrity and expiration.
    if (auth_code_record.client_id != client_id) {
      return #err((400, "invalid_grant", "Client ID mismatch"));
    };
    if (auth_code_record.expires_at < Time.now()) {
      return #err((400, "invalid_grant", "Authorization code has expired"));
    };

    // 5. CRITICAL FIX: Validate that the redirect_uri from this request matches the one from the /authorize request.
    if (auth_code_record.redirect_uri != redirect_uri) {
      return #err((400, "invalid_grant", "redirect_uri mismatch"));
    };

    // 6. CRITICAL: PKCE Verification.
    if (auth_code_record.code_challenge_method == "S256") {
      let hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(code_verifier));
      let calculated_challenge = BaseX.toBase64(hash_blob.vals(), #url({ includePadding = false }));
      if (calculated_challenge != auth_code_record.code_challenge) {
        return #err((400, "invalid_grant", "Invalid code_verifier"));
      };
    } else {
      return #err((500, "server_error", "Unsupported code_challenge_method"));
    };

    // 7. All checks passed.
    return #ok({ auth_code_record = auth_code_record; client = client });
  };

  public func validate_refresh_token_request(
    context : Types.Context,
    form : Types.Form,
  ) : Result.Result<Types.RefreshToken, (Nat, Text, Text)> {
    // Helper to get a required parameter from the form.
    func get_required(key : Text) : Result.Result<Text, (Nat, Text, Text)> {
      switch (form.get(key)) {
        case (?values) {
          if (values.size() > 0) { #ok(values[0]) } else {
            #err((400, "invalid_request", key # " is missing"));
          };
        };
        case (_) #err((400, "invalid_request", key # " is missing"));
      };
    };

    // 1. Get required parameters for this grant type
    let refresh_token_string = switch (get_required("refresh_token")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };
    let client_id = switch (get_required("client_id")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };

    // 2. Validate the client
    if (Option.isNull(Map.get(context.clients, thash, client_id))) {
      return #err((400, "invalid_client", "Client not found"));
    };

    // 3. Validate the refresh token itself
    let refresh_token_record = switch (Map.get(context.refresh_tokens, thash, refresh_token_string)) {
      case (null) return #err((400, "invalid_grant", "Refresh token not found or revoked"));
      case (?rec) rec;
    };

    // 4. Check integrity and expiration
    if (refresh_token_record.client_id != client_id) {
      return #err((400, "invalid_grant", "Client ID mismatch"));
    };
    if (refresh_token_record.expires_at < Time.now()) {
      return #err((400, "invalid_grant", "Refresh token has expired"));
    };

    // All checks passed, return the valid record
    return #ok(refresh_token_record);
  };
};
