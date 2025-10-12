import Types "Types";
import Validation "Validation";
import Errors "Errors";
import JWT "JWT";
import Json "mo:json";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Utils "Utils";
import Random "mo:base/Random";
import BaseX "mo:base-x-encoder";
import Time "mo:base/Time";
import Array "mo:base/Array";
import Nat16 "mo:base/Nat16";
import Debug "mo:base/Debug";

module {
  // A new helper to build the final JSON response for any successful token grant.
  func issue_token_response(
    res : Types.ResponseClass,
    access_token : Text,
    scope : Text,
    refresh_token : ?Text,
  ) : Types.Response {
    let refresh_field = switch (refresh_token) {
      case (?rt) [("refresh_token", #string(rt))];
      case (_) [];
    };
    let response_obj = #object_(
      Array.append(
        [
          ("access_token", #string(access_token)),
          ("token_type", #string("Bearer")),
          ("expires_in", #number(#int(3600))), // Access token expiry is 1 hour
          ("scope", #string(scope)),
        ],
        refresh_field,
      )
    );

    return res.json({
      status_code = 200;
      body = Json.stringify(response_obj, null);
      cache_strategy = #noCache;
    });
  };

  public func handle_token(context : Types.Context, req : Types.Request, res : Types.ResponseClass) : async Types.Response {
    Debug.print("--- Handling token request ---");

    // Opportunistically cleanup stale pending refresh operations on each token request
    cleanup_stale_pending_refreshes(context);

    // 1. Get form data from the request body.
    let form = switch (req.body) {
      case (?b) b.form;
      case (_) return Errors.send_token_error(res, 400, "invalid_request", ?"Request body is missing");
    };

    // 2. Determine the grant type and route logic accordingly.
    let grant_type = switch (form.get("grant_type")) {
      case (?v) if (v.size() > 0) ?v[0] else null;
      case (_) null;
    };

    switch (grant_type) {
      case (?"authorization_code") {
        Debug.print("Grant type is 'authorization_code'. Proceeding with validation...");
        // --- Handle Authorization Code Grant ---
        let validation_result = Validation.validate_token_request(context, form);
        let validated_req = switch (validation_result) {
          case (#err((status, error, desc))) {
            // --- NEW LOGGING: See why validation failed ---
            Debug.print("!!! Token validation failed. Status: " # debug_show (status) # ", Error: " # error # ", Desc: " # debug_show (desc));
            return Errors.send_token_error(res, Nat16.fromNat(status), error, ?desc);
          };
          case (#ok(data)) {
            // --- NEW LOGGING: See the successful validation data ---
            Debug.print("Token validation successful. Validated data: " # debug_show (data));
            data;
          };
        };

        Map.delete(context.auth_codes, thash, validated_req.auth_code_record.code);

        let issuer = Utils.get_issuer(context, req);
        // --- NEW LOGGING: See the data going into the JWT ---
        Debug.print("Creating JWT with auth record: " # debug_show (validated_req.auth_code_record));
        let token_result = await JWT.create_and_sign(context, validated_req.auth_code_record, issuer);

        let access_token = switch (token_result) {
          case (#err(msg)) {
            Debug.print("!!! Error creating access token: " # msg);
            return Errors.send_token_error(res, 500, "server_error", ?msg);
          };
          case (#ok(token)) {
            Debug.print("JWT and access token created successfully.");
            token;
          };
        };

        // Create and store a new refresh token
        let refresh_token_blob = await Random.blob();
        let refresh_token_string = BaseX.toHex(refresh_token_blob.vals(), { isUpper = false; prefix = #none });
        let refresh_token_data : Types.RefreshToken = {
          token = refresh_token_string;
          user_principal = validated_req.auth_code_record.user_principal;
          client_id = validated_req.client.client_id;
          scope = validated_req.auth_code_record.scope;
          audience = validated_req.auth_code_record.resource;
          expires_at = Time.now() + (90 * 24 * 60 * 60 * 1_000_000_000); // 90-day expiry
        };
        Map.set(context.refresh_tokens, thash, refresh_token_string, refresh_token_data);

        Debug.print("TOKEN: Refresh token string: " # refresh_token_string);

        Debug.print("Issuing final token response...");
        return issue_token_response(res, access_token, validated_req.auth_code_record.scope, ?refresh_token_string);
      };
      case (?"refresh_token") {
        // --- Handle Refresh Token Grant ---

        // Get the refresh token string first to check for pending operations
        let refresh_token_string = switch (form.get("refresh_token")) {
          case (?values) {
            if (values.size() > 0) values[0] else {
              return Errors.send_token_error(res, 400, "invalid_request", ?"refresh_token is missing");
            };
          };
          case (_) return Errors.send_token_error(res, 400, "invalid_request", ?"refresh_token is missing");
        };

        Debug.print("TOKEN (refresh): Refresh token string: " # refresh_token_string);

        // RACE CONDITION PREVENTION: Poll for up to 5 seconds if another request is processing
        let max_poll_attempts = 10; // 10 attempts = ~5 seconds max wait with IC block processing
        var poll_attempt = 0;

        label polling_loop loop {
          let existing_pending = Map.get(context.pending_refresh_operations, thash, refresh_token_string);

          switch (existing_pending) {
            case (?pending) {
              // Clean up stale pending operations (older than 10 seconds)
              let current_time = Time.now();
              let stale_threshold = current_time - (10 * 1_000_000_000);
              let age_nanoseconds = current_time - pending.created_at;
              let age_seconds = age_nanoseconds / 1_000_000_000;
              Debug.print("TOKEN (refresh): Found pending operation, age: " # debug_show (age_seconds) # " seconds (current: " # debug_show (current_time) # ", created: " # debug_show (pending.created_at) # ")");

              if (pending.created_at < stale_threshold) {
                Debug.print("TOKEN (refresh): Found stale pending refresh operation, cleaning up");
                Map.delete(context.pending_refresh_operations, thash, refresh_token_string);
                break polling_loop; // Continue with normal flow
              } else if (pending.new_access_token != "" and pending.new_refresh_token != "") {
                // Tokens are ready! Return them
                Debug.print("TOKEN (refresh): Returning cached tokens from completed pending refresh operation");
                return issue_token_response(res, pending.new_access_token, pending.scope, ?pending.new_refresh_token);
              } else {
                // Placeholder exists - another request is processing
                poll_attempt += 1;
                if (poll_attempt >= max_poll_attempts) {
                  Debug.print("TOKEN (refresh): Max polling attempts reached, proceeding anyway");
                  break polling_loop;
                };
                Debug.print("TOKEN (refresh): Waiting for in-progress refresh (attempt " # debug_show (poll_attempt) # ")");
                // Yield control to allow other messages to process
                // This async operation ensures the IC runtime can process the first request
                // that's currently generating tokens
                await async {};
              };
            };
            case (null) {
              Debug.print("TOKEN (refresh): No pending refresh found, proceeding with new refresh");
              break polling_loop;
            };
          };
        };

        // Validate the refresh token request
        let validation_result = Validation.validate_refresh_token_request(context, form);
        let old_refresh_token = switch (validation_result) {
          case (#err((status, error, desc))) return Errors.send_token_error(res, Nat16.fromNat(status), error, ?desc);
          case (#ok(data)) data;
        };

        // CRITICAL: Set placeholder IMMEDIATELY after successful validation, BEFORE any await
        let placeholder_pending : Types.PendingRefresh = {
          new_refresh_token = "";
          new_access_token = "";
          scope = old_refresh_token.scope;
          created_at = Time.now();
        };
        Map.set(context.pending_refresh_operations, thash, old_refresh_token.token, placeholder_pending);
        Debug.print("TOKEN (refresh): Set placeholder to lock this refresh operation");

        // Delete the old refresh token to prevent it from being used again
        Map.delete(context.refresh_tokens, thash, old_refresh_token.token);
        Debug.print("TOKEN (refresh): Deleted old refresh token");

        // Now do the expensive async operations
        let issuer = Utils.get_issuer(context, req);
        let auth_data_for_jwt : Types.AuthorizationCode = {
          user_principal = old_refresh_token.user_principal;
          scope = old_refresh_token.scope;
          code = "";
          redirect_uri = "";
          client_id = old_refresh_token.client_id;
          expires_at = 0;
          code_challenge = "";
          code_challenge_method = "";
          resource = old_refresh_token.audience;
        };

        let token_result = await JWT.create_and_sign(context, auth_data_for_jwt, issuer);
        let access_token = switch (token_result) {
          case (#err(msg)) {
            // Clean up the placeholder on error
            Map.delete(context.pending_refresh_operations, thash, old_refresh_token.token);
            Debug.print("TOKEN (refresh): Error creating access token, cleaned up placeholder");
            return Errors.send_token_error(res, 500, "server_error", ?msg);
          };
          case (#ok(token)) token;
        };

        // Create and store a *new* refresh token.
        let new_refresh_token_blob = await Random.blob();
        let new_refresh_token_string = BaseX.toHex(new_refresh_token_blob.vals(), { isUpper = false; prefix = #none });
        let new_refresh_token_data : Types.RefreshToken = {
          token = new_refresh_token_string;
          user_principal = old_refresh_token.user_principal;
          client_id = old_refresh_token.client_id;
          scope = old_refresh_token.scope;
          audience = old_refresh_token.audience;
          expires_at = old_refresh_token.expires_at; // Keep the original expiry date
        };
        Map.set(context.refresh_tokens, thash, new_refresh_token_string, new_refresh_token_data);
        Debug.print("TOKEN (refresh): Created and stored new refresh token");

        // Update the pending refresh operation with the actual token values
        // This allows concurrent requests that checked after we set the placeholder to get the real tokens
        // NOTE: Keep the original created_at timestamp from the placeholder, don't reset it
        let final_pending_refresh : Types.PendingRefresh = {
          new_refresh_token = new_refresh_token_string;
          new_access_token = access_token;
          scope = old_refresh_token.scope;
          created_at = placeholder_pending.created_at; // Use original timestamp, not Time.now()
        };
        Map.set(context.pending_refresh_operations, thash, old_refresh_token.token, final_pending_refresh);
        Debug.print("TOKEN (refresh): Updated pending operation with final tokens");

        // Clean up the pending operation after a grace period
        // Note: Stale operations are cleaned up by the check at the beginning of this function

        return issue_token_response(res, access_token, old_refresh_token.scope, ?new_refresh_token_string);
      };

      case (_) {
        return Errors.send_token_error(res, 400, "unsupported_grant_type", ?"grant_type is missing or invalid");
      };
    };
  };

  /**
   * Cleanup stale pending refresh operations.
   * This should be called periodically or opportunistically to prevent memory leaks.
   * Operations older than 10 seconds are considered stale.
   */
  public func cleanup_stale_pending_refreshes(context : Types.Context) {
    let stale_threshold = Time.now() - (10 * 1_000_000_000); // 10 seconds
    let entries = Map.entries(context.pending_refresh_operations);
    var cleaned_count = 0;

    for ((token, pending) in entries) {
      if (pending.created_at < stale_threshold) {
        Map.delete(context.pending_refresh_operations, thash, token);
        cleaned_count += 1;
      };
    };

    if (cleaned_count > 0) {
      Debug.print("Cleaned up " # debug_show (cleaned_count) # " stale pending refresh operations");
    };
  };
};
