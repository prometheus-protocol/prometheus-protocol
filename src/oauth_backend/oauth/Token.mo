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
  ) : async Types.Response {
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
    // 1. Get form data from the request body.
    let form = switch (req.body) {
      case (?b) b.form;
      case (_) return await Errors.send_token_error(res, 400, "invalid_request", ?"Request body is missing");
    };

    // 2. Determine the grant type and route logic accordingly.
    let grant_type = switch (form.get("grant_type")) {
      case (?v) if (v.size() > 0) ?v[0] else null;
      case (_) null;
    };

    switch (grant_type) {
      case (?"authorization_code") {
        // --- Handle Authorization Code Grant ---
        let validation_result = await Validation.validate_token_request(context, form);
        let validated_req = switch (validation_result) {
          case (#err((status, error, desc))) return await Errors.send_token_error(res, Nat16.fromNat(status), error, ?desc);
          case (#ok(data)) data;
        };

        Map.delete(context.auth_codes, thash, validated_req.auth_code_record.code);

        let issuer = Utils.get_issuer(context, req);
        let token_result = await JWT.create_and_sign(context, validated_req.auth_code_record, issuer);

        let access_token = switch (token_result) {
          case (#err(msg)) {
            Debug.print("Error creating access token: " # msg);
            return await Errors.send_token_error(res, 500, "server_error", ?msg);
          };
          case (#ok(token)) token;
        };

        // Create and store a new refresh token
        let refresh_token_blob = await Random.blob();
        let refresh_token_string = BaseX.toHex(refresh_token_blob.vals(), { isUpper = false; prefix = #none });
        let refresh_token_data : Types.RefreshToken = {
          token = refresh_token_string;
          user_principal = validated_req.auth_code_record.user_principal;
          client_id = validated_req.client.client_id;
          scope = validated_req.auth_code_record.scope;
          audience = validated_req.auth_code_record.audience;
          expires_at = Time.now() + (90 * 24 * 60 * 60 * 1_000_000_000); // 90-day expiry
        };
        Map.set(context.refresh_tokens, thash, refresh_token_string, refresh_token_data);

        return await issue_token_response(res, access_token, validated_req.auth_code_record.scope, ?refresh_token_string);
      };

      case (?"refresh_token") {
        // --- Handle Refresh Token Grant ---
        let validation_result = await Validation.validate_refresh_token_request(context, form);
        let old_refresh_token = switch (validation_result) {
          case (#err((status, error, desc))) return await Errors.send_token_error(res, Nat16.fromNat(status), error, ?desc);
          case (#ok(data)) data;
        };

        // REFRESH TOKEN ROTATION: Invalidate the old token immediately.
        Map.delete(context.refresh_tokens, thash, old_refresh_token.token);

        // Create a new access token from the refresh token's data.
        let issuer = Utils.get_issuer(context, req);
        let auth_data_for_jwt : Types.AuthorizationCode = {
          user_principal = old_refresh_token.user_principal;
          scope = old_refresh_token.scope;
          audience = old_refresh_token.audience;
          code = "";
          redirect_uri = "";
          client_id = "";
          expires_at = 0;
          code_challenge = "";
          code_challenge_method = "";
          resource = null;
        };
        let token_result = await JWT.create_and_sign(context, auth_data_for_jwt, issuer);
        let access_token = switch (token_result) {
          case (#err(msg)) return await Errors.send_token_error(res, 500, "server_error", ?msg);
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

        return await issue_token_response(res, access_token, old_refresh_token.scope, ?new_refresh_token_string);
      };

      case (_) {
        return await Errors.send_token_error(res, 400, "unsupported_grant_type", ?"grant_type is missing or invalid");
      };
    };
  };
};
