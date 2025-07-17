import Text "mo:base/Text";
import Result "mo:base/Result";
import Types "../Types";
import Time "mo:base/Time";
import Option "mo:base/Option";
import Array "mo:base/Array";
import BaseX "mo:base-x-encoder";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Utils "../Utils";
import Sha256 "mo:sha2/Sha256";

module {

  // This function now handles ALL validation for an incoming /authorize request.
  public func validate_authorize_request(
    context : Types.Context,
    req : Types.Request,
  ) : async Result.Result<Types.ValidatedAuthorizeRequest, Text> {

    // --- 1. Parse all required parameters from the query string ---
    let q = req.url.queryObj;
    let response_type = switch (q.get("response_type")) {
      case (?v) v;
      case (_) return #err("response_type is required");
    };
    let client_id = switch (q.get("client_id")) {
      case (?v) v;
      case (_) return #err("client_id is required");
    };
    let redirect_uri = switch (q.get("redirect_uri")) {
      case (?v) v;
      case (_) return #err("redirect_uri is required");
    };
    let code_challenge = switch (q.get("code_challenge")) {
      case (?v) v;
      case (_) return #err("code_challenge is required for PKCE");
    };
    let code_challenge_method = switch (q.get("code_challenge_method")) {
      case (?v) v;
      case (_) return #err("code_challenge_method is required for PKCE");
    };

    // For security, we require the state parameter to prevent CSRF attacks.
    let state = switch (q.get("state")) {
      case (?v) v;
      case (_) return #err("state is required");
    };

    // Optional parameters
    let scope_opt = q.get("scope");
    let resource_opt = q.get("resource");

    // --- 2. Validate parameter values ---
    if (response_type != "code") {
      return #err("unsupported response_type: must be 'code'");
    };
    if (code_challenge_method != "S256") {
      return #err("code_challenge_method must be 'S256'");
    };

    // --- 3. Validate the Client ---
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) { return #err("invalid client_id: client not found") };
      case (?c) c;
    };

    if (client.status != #active) {
      return #err("Invalid Client: Client is not active. Please pay the activation fee.");
    };

    // --- 4. CRITICAL: Validate redirect_uri ---
    func isRedirectUri(uri : Text) : Bool {
      return uri == redirect_uri;
    };

    if (Option.isNull(Array.find<Text>(client.redirect_uris, isRedirectUri))) {
      return #err("invalid redirect_uri: URI not registered for this client");
    };

    // --- 5. Validate the Resource and determine the Audience ---
    let audience = switch (resource_opt) {
      case (null) {
        // Fallback behavior: If no resource is specified, the audience is the client itself.
        client_id;
      };
      case (?resource_uri) {
        // Resource-oriented behavior: Validate the provided resource URI.
        let normalized_uri = Utils.normalize_uri(resource_uri);
        if (Map.get(context.uri_to_rs_id, thash, normalized_uri) == null) {
          // If the URI is not in our reverse map, it's not a registered resource.
          return #err("The specified 'resource' URI is not registered with this provider.");
        };
        // The URI is valid. The audience for the JWT MUST be the URI itself.
        normalized_uri;
      };
    };

    // --- 6. If all checks pass, return the validated data in a structured way ---
    return #ok({
      client_id = client_id;
      redirect_uri = redirect_uri;
      scope = Option.get(scope_opt, "");
      state = state;
      code_challenge = code_challenge;
      code_challenge_method = code_challenge_method;
      audience = audience;
      resource = resource_opt;
    });
  };

  public func validate_token_request(
    context : Types.Context,
    form : Types.Form,
  ) : async Result.Result<Types.ValidatedTokenRequest, (Nat, Text, Text)> {

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
    let client_secret = switch (get_required("client_secret")) {
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

    // 3. Validate the resource parameter if provided.
    // This is optional, but if provided, it must match the one stored with the code
    let resource_from_form = switch (form.get("resource")) {
      case (?values) {
        if (values.size() > 0) { ?values[0] } else { null };
      };
      case (_) null;
    };

    // Compare the resource from the form with the one stored with the code
    if (auth_code_record.resource != resource_from_form) {
      return #err((400, "invalid_grant", "resource parameter mismatch"));
    };

    // 3. Validate client and secret.
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) return #err((400, "invalid_client", "Client not found"));
      case (?c) c;
    };
    let secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
    let secret_hash_hex = BaseX.toHex(secret_hash_blob.vals(), { isUpper = false; prefix = #none });
    if (secret_hash_hex != client.client_secret_hash) {
      return #err((401, "invalid_client", "Invalid client secret"));
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
  ) : async Result.Result<Types.RefreshToken, (Nat, Text, Text)> {
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
    let client_secret = switch (get_required("client_secret")) {
      case (#ok(v)) v;
      case (#err(e)) return #err(e);
    };

    // 2. Validate the client secret
    let client = switch (Map.get(context.clients, thash, client_id)) {
      case (null) return #err((400, "invalid_client", "Client not found"));
      case (?c) c;
    };
    let secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
    let secret_hash_hex = BaseX.toHex(secret_hash_blob.vals(), { isUpper = false; prefix = #none });
    if (secret_hash_hex != client.client_secret_hash) {
      return #err((401, "invalid_client", "Invalid client secret"));
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
