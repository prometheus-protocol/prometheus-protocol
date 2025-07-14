// This file is large, but it contains all the core application logic.
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Random "mo:base/Random";
import BaseX "mo:base-x-encoder";
import Map "mo:map/Map";
import { thash; phash } "mo:map/Map";
import Sha256 "mo:sha2/Sha256";
import JWT "mo:jwt";
import Server "mo:server";
import Types "Types";
import Crypto "Crypto";
import Json "mo:json";

module {
  public func complete_authorize(context : Types.Context, session_id : Text, user_principal : Principal) : async Result.Result<Text, Text> {
    // 1. CRITICAL: Check for an active subscription for the user.
    let subscription = Map.get(context.subscriptions, phash, user_principal);
    switch (subscription) {
      case (null) {
        return #err("No active subscription found for user.");
      };
      case (?sub) {
        if (sub.expires_at < Time.now()) {
          return #err("User subscription has expired.");
        };
      };
    };

    // 2. Look up the session and handle errors.
    let session = switch (Map.get(context.authorize_sessions, thash, session_id)) {
      case (null) { return #err("Invalid or already used session ID.") };
      case (?s) s;
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
      expires_at = Time.now() + (10 * 60 * 1_000_000_000);
      code_challenge = session.code_challenge;
      code_challenge_method = session.code_challenge_method;
    };
    Map.set(context.auth_codes, thash, code, auth_code_data);
    Map.delete(context.authorize_sessions, thash, session_id);
    let state_param = switch (session.state) {
      case (?s) "&state=" # s;
      case (_) "";
    };

    let final_url = session.redirect_uri # "?code=" # code # state_param;
    return #ok(final_url);
  };

  // Main registration function
  public func register(server : Server.Server, context : Types.Context) {

    func validate_authorize_request(
      client_id_opt : ?Text,
      redirect_uri_opt : ?Text,
      response_type_opt : ?Text,
      state_opt : ?Text,
      scope_opt : ?Text,
    ) : async Result.Result<Types.ValidatedAuthRequest, Text> {
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
      let client = switch (Map.get(context.clients, thash, client_id)) {
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

    server.get(
      "/authorize",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        // 1. Parse query parameters
        let client_id_opt = req.url.queryObj.get("client_id");
        let redirect_uri_opt = req.url.queryObj.get("redirect_uri");
        let response_type_opt = req.url.queryObj.get("response_type");
        let state_opt = req.url.queryObj.get("state");
        let scope_opt = req.url.queryObj.get("scope");
        let code_challenge_opt = req.url.queryObj.get("code_challenge");
        let code_challenge_method_opt = req.url.queryObj.get("code_challenge_method");

        // 2. Validate the request
        let validation_result = await validate_authorize_request(
          client_id_opt,
          redirect_uri_opt,
          response_type_opt,
          state_opt,
          scope_opt,
        );

        switch (validation_result) {
          case (#err(error_message)) {
            return res.send({
              status_code = 400;
              headers = [];
              body = Text.encodeUtf8("Invalid Request: " # error_message);
              streaming_strategy = null;
              cache_strategy = #noCache;
            });
          };
          case (#ok(validated_req)) {
            let client = switch (Map.get(context.clients, thash, validated_req.client.client_id)) {
              case (null) { Debug.trap("Impossible: client not found") };
              case (?c) c;
            };

            if (client.status != #active) {
              return res.send({
                status_code = 400;
                body = Text.encodeUtf8("Invalid Client: Client is not active. Please pay the activation fee.");
                headers = [];
                streaming_strategy = null;
                cache_strategy = #noCache;
              });
            };

            // PKCE Validation
            let code_challenge = switch (code_challenge_opt) {
              case (null) {
                return res.send({
                  status_code = 400;
                  headers = [];
                  body = Text.encodeUtf8("Invalid Request: code_challenge is required for PKCE");
                  streaming_strategy = null;
                  cache_strategy = #noCache;
                });
              };
              case (?c) c;
            };
            let code_challenge_method = switch (code_challenge_method_opt) {
              case (null) {
                return res.send({
                  status_code = 400;
                  headers = [];
                  body = Text.encodeUtf8("Invalid Request: code_challenge_method is required for PKCE");
                  streaming_strategy = null;
                  cache_strategy = #noCache;
                });
              };
              case (?m) m;
            };

            if (code_challenge_method != "S256") {
              // We only support S256 for security.
              return res.send({
                status_code = 400;
                body = Text.encodeUtf8("Invalid Request: code_challenge_method must be 'S256'");
                headers = [];
                streaming_strategy = null;
                cache_strategy = #noCache;
              });
            };

            // 3. Create a temporary session
            let session_id_blob = await Random.blob();
            let session_id = BaseX.toHex(session_id_blob.vals(), { isUpper = false; prefix = #none });

            let session_data : Types.AuthorizeSession = {
              client_id = validated_req.client.client_id;
              redirect_uri = validated_req.redirect_uri;
              scope = validated_req.scope;
              state = validated_req.state;
              expires_at = Time.now() + (5 * 60 * 1_000_000_000); // 5 minutes
              code_challenge = code_challenge;
              code_challenge_method = code_challenge_method;
            };
            Map.set(context.authorize_sessions, thash, session_id, session_data);

            // 4. Redirect the user using the Host header for environment-aware URLs.
            let frontend_canister_id_text = Principal.toText(context.frontend_canister_id);
            let backend_canister_id_text = Principal.toText(context.self);

            let host_values = switch (req.headers.get("host")) {
              case (null) {
                Debug.trap("Host header is missing from the request");
              };
              case (?values) values;
            };

            // The 'Host' header should only ever have one value.
            // We'll trap if it's empty, otherwise we take the first element.
            if (host_values.size() == 0) {
              Debug.trap("Host header is present but empty");
            };
            let host = host_values[0];

            let protocol = switch (req.headers.get("x-forwarded-proto")) {
              case (null) "http"; // Default to http if not set
              case (?proto) proto[0]; // Take the first value
            };

            // Simply replace the backend canister ID substring with the frontend one.
            // This is the cleanest and most reliable method.
            let frontend_host = Text.replace(host, #text(backend_canister_id_text), frontend_canister_id_text);

            let login_url = protocol # "://" # frontend_host # "/login?session_id=" # session_id;

            return res.send({
              status_code = 302;
              headers = [("Location", login_url)];
              body = Blob.fromArray([]);
              streaming_strategy = null;
              cache_strategy = #noCache;
            });
          };
        };
      },
    );

    server.post(
      "/token",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        let entropy_source = await Random.blob();

        // 1. Get the form data from the request body.
        let form = switch (req.body) {
          case (null) {
            return res.json({
              status_code = 400;
              body = "{ \"error\": \"invalid_request\", \"error_description\": \"Request body is missing\" }";
              cache_strategy = #noCache;
            });
          };
          case (?b) b.form;
        };

        // Helper function to safely get the first value from a form field.
        func get_param(key : Text) : ?Text {
          switch (form.get(key)) {
            case (null) {
              // Parameter was not present at all.
              return null;
            };
            case (?values) {
              // Parameter was present. Check if it has at least one value.
              if (values.size() > 0) {
                // It has values, return the first one as an optional.
                return ?values[0];
              } else {
                // It was present but empty (e.g., &param=). Treat as not present.
                return null;
              };
            };
          };
        };

        // 2. Parse parameters using our helper.
        let grant_type_opt = get_param("grant_type");
        let code_opt = get_param("code");
        let client_id_opt = get_param("client_id");
        let client_secret_opt = get_param("client_secret");
        let code_verifier_opt = get_param("code_verifier");

        // 2. Validate the request parameters.
        if (Option.get(grant_type_opt, "") != "authorization_code") {
          return res.json({
            status_code = 400;
            body = "{ \"error\": \"unsupported_grant_type\" }";
            cache_strategy = #noCache;
          });
        };

        let code = switch (code_opt) {
          case (?c) c;
          case (_) return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_request\", \"error_description\": \"code is missing\" }";
            cache_strategy = #noCache;
          });
        };
        let client_id = switch (client_id_opt) {
          case (?c) c;
          case (_) return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_request\", \"error_description\": \"client_id is missing\" }";
            cache_strategy = #noCache;
          });
        };
        let client_secret = switch (client_secret_opt) {
          case (?s) s;
          case (_) return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_request\", \"error_description\": \"client_secret is missing\" }";
            cache_strategy = #noCache;
          });
        };
        let code_verifier = switch (code_verifier_opt) {
          case (?v) v;
          case (_) return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_request\", \"error_description\": \"code_verifier is missing\" }";
            cache_strategy = #noCache;
          });
        };

        // 2a. Validate the authorization code itself.
        let auth_code_record = switch (Map.get(context.auth_codes, thash, code)) {
          case (null) {
            return res.json({
              status_code = 400;
              body = "{ \"error\": \"invalid_grant\", \"error_description\": \"Authorization code is invalid or expired\" }";
              cache_strategy = #noCache;
            });
          };
          case (?rec) rec;
        };

        // 2b. CRITICAL: PKCE Verification
        // We must do this *before* deleting the code to prevent replay attacks.
        if (auth_code_record.code_challenge_method == "S256") {
          let code_verifier_blob = Text.encodeUtf8(code_verifier);
          let hash_blob = Sha256.fromBlob(#sha256, code_verifier_blob);

          // Base64URL encode the hash
          let calculated_challenge = BaseX.toBase64(hash_blob.vals(), #url({ includePadding = false }));

          if (calculated_challenge != auth_code_record.code_challenge) {
            // The proof is invalid. Reject the request.
            return res.json({
              status_code = 400;
              body = "{ \"error\": \"invalid_grant\", \"error_description\": \"Invalid code_verifier\" }";
              cache_strategy = #noCache;
            });
          };
        } else {
          // This should not happen if /authorize is working correctly.
          Debug.trap("Internal error: unsupported code_challenge_method found in auth code record");
        };

        // 2c. CRITICAL: Delete the code immediately after lookup to make it single-use.
        Map.delete(context.auth_codes, thash, code);

        // 2d. Check if code has expired and matches the client.
        if (auth_code_record.expires_at < Time.now()) {
          return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_grant\", \"error_description\": \"Authorization code has expired\" }";
            cache_strategy = #noCache;
          });
        };
        if (auth_code_record.client_id != client_id) {
          return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_grant\", \"error_description\": \"Client ID mismatch\" }";
            cache_strategy = #noCache;
          });
        };

        // 2e. Validate the client secret.
        let client_record = switch (Map.get(context.clients, thash, client_id)) {
          case (?c) c;
          case (_) Debug.trap("Internal error: client record not found for valid code");
        };
        let secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
        let secret_hash_hex = BaseX.toHex(secret_hash_blob.vals(), { isUpper = false; prefix = #none });

        if (secret_hash_hex != client_record.client_secret_hash) {
          return res.json({
            status_code = 401;
            body = "{ \"error\": \"invalid_client\" }";
            cache_strategy = #noCache;
          });
        };

        // 2f. CRITICAL: Check for an active subscription.
        let user_principal = auth_code_record.user_principal;
        let subscription = Map.get(context.subscriptions, phash, user_principal);

        switch (subscription) {
          case (null) {
            return res.json({
              status_code = 402;
              body = "{ \"error\": \"payment_required\", \"error_description\": \"No active subscription found.\" }";
              cache_strategy = #noCache;
            });
          };
          case (?sub) {
            if (sub.expires_at < Time.now()) {
              return res.json({
                status_code = 402;
                body = "{ \"error\": \"payment_required\", \"error_description\": \"Subscription has expired.\" }";
                cache_strategy = #noCache;
              });
            };
          };
        };

        // 3. Get the canister's signing key.
        let private_key = Crypto.get_or_create_signing_key(context, entropy_source);

        // 4. Create the JWT.
        let now_seconds = Time.now() / 1_000_000_000;
        let exp_seconds = now_seconds + 3600; // Token expires in 1 hour.

        let unsigned_token : JWT.UnsignedToken = {
          header = [
            ("alg", #string("ES256")),
            ("typ", #string("JWT")),
            ("kid", #string(Principal.toText(context.self))) // Use canister ID as Key ID
          ];
          payload = [
            ("iss", #string(Principal.toText(context.self))),
            ("sub", #string(Principal.toText(auth_code_record.user_principal))),
            ("aud", #string(client_id)),
            ("exp", #number(#int(exp_seconds))),
            ("iat", #number(#int(now_seconds))),
            ("scope", #string(auth_code_record.scope)),
          ];
        };

        // 5. Sign the JWT.
        let random_k_for_signing = await Random.blob();
        let sign_res = private_key.sign(JWT.toBlobUnsigned(unsigned_token).vals(), random_k_for_signing.vals());

        let signature = switch (sign_res) {
          case (#err(e)) {
            return res.send({
              headers = [];
              status_code = 500;
              body = Text.encodeUtf8("Failed to sign token: " # e);
              streaming_strategy = null;
              cache_strategy = #noCache;
            });
          };
          case (#ok(sig)) sig;
        };

        let signed_token : JWT.Token = {
          header = unsigned_token.header;
          payload = unsigned_token.payload;
          signature = {
            algorithm = "ES256";
            value = Blob.fromArray(signature.toBytes(#raw));
            message = JWT.toBlobUnsigned(unsigned_token);
          };
        };

        // 6. Return the token in the correct JSON format.
        let access_token = JWT.toText(signed_token);
        let response_body = "{ \"access_token\": \"" # access_token # "\", \"token_type\": \"Bearer\", \"expires_in\": 3600, \"scope\": \"" # auth_code_record.scope # "\" }";

        return res.json({
          status_code = 200;
          body = response_body;
          cache_strategy = #noCache;
        });
      },
    );

    server.post(
      "/register",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        // 1. Define the expected JSON schema for the request body.
        // This is the declarative, robust way to define our input requirements.
        let dcrSchema : Json.Schema = #object_({
          properties = [
            ("client_name", #string),
            ("redirect_uris", #array({ items = #string })),
            ("logo_uri", #string), // Optional, but must be a string if present
          ];
          required = ?["client_name", "redirect_uris"];
        });

        // 2. Parse the request body text into a JSON object.
        let json_body = switch (req.body) {
          case (?b) Json.parse(b.text());
          case (_) return res.json({
            status_code = 400;
            body = "{ \"error\": \"invalid_request\", \"error_description\": \"Request body is missing or not JSON\" }";
            cache_strategy = #noCache;
          });
        };

        let parsed = switch (json_body) {
          case (#err(e)) {
            return res.json({
              status_code = 400;
              body = "{ \"error\": \"invalid_request\", \"error_description\": \"Invalid JSON: " # debug_show (e) # "\" }";
              cache_strategy = #noCache;
            });
          };
          case (#ok(j)) j;
        };

        // 3. Validate the parsed JSON against our schema.
        switch (Json.validate(parsed, dcrSchema)) {
          case (#ok()) { /* The JSON is valid, proceed. */ };
          case (#err(e)) {
            // The JSON is invalid. Return a specific error.
            let error_description = "Invalid JSON structure: " # debug_show (e);

            return res.json({
              status_code = 400;
              body = "{ \"error\": \"invalid_request\", \"error_description\": \"" # error_description # "\" }";
              cache_strategy = #noCache;
            });
          };
        };

        // 4. Extract data using Json.get. This is now safe because validation passed.
        // We can trap on failure here, as it indicates a logic error (mismatch between schema and extraction).
        let client_name = switch (Json.getAsText(parsed, "client_name")) {
          case (#ok(t)) t;
          case (#err(_)) Debug.trap("Impossible: client_name validation failed silently");
        };
        let redirect_uris_json = switch (Json.get(parsed, "redirect_uris")) {
          case (?(#array(a))) a;
          case (_) Debug.trap("Impossible: redirect_uris validation failed silently");
        };
        let redirect_uris = Array.map(
          redirect_uris_json,
          func(j : Json.Json) : Text {
            switch (j) {
              case (#string(t)) t;
              case (_) Debug.trap("Impossible: redirect_uris item not a string");
            };
          },
        );
        let logo_uri = switch (Json.getAsText(parsed, "logo_uri")) {
          case (#ok(t)) ?t;
          case (#err(_)) null;
        };

        // 4. Generate and store new client credentials
        let client_id_blob = await Random.blob();
        let client_secret_blob = await Random.blob();
        let client_id = BaseX.toHex(client_id_blob.vals(), { isUpper = false; prefix = #none });
        let client_secret = BaseX.toHex(client_secret_blob.vals(), { isUpper = false; prefix = #none });
        let secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
        let client_secret_hash = BaseX.toHex(secret_hash_blob.vals(), { isUpper = false; prefix = #none });

        let new_client : Types.Client = {
          client_id = client_id;
          owner = Principal.fromText("aaaaa-aa"); // This will be set to the caller later
          client_secret_hash = client_secret_hash;
          client_name = client_name;
          logo_uri = Option.get(logo_uri, "");
          redirect_uris = redirect_uris;
          status = #pending_activation; // Initially pending activation
        };
        Map.set(context.clients, thash, new_client.client_id, new_client);

        // 5. Construct and return the successful response
        let response_record : Types.RegistrationResponse = {
          client_id = client_id;
          client_secret = client_secret;
          client_name = client_name;
          redirect_uris = redirect_uris;
          grant_types = ["authorization_code"];
        };

        let json_response = #object_([
          ("client_id", #string(response_record.client_id)),
          ("client_secret", #string(response_record.client_secret)),
          ("client_name", #string(response_record.client_name)),
          ("redirect_uris", #array(Array.map(response_record.redirect_uris, func(uri : Text) : { #string : Text } { #string(uri) }))),
          ("grant_types", #array(Array.map(response_record.grant_types, func(gt : Text) : { #string : Text } { #string(gt) }))),
        ]);

        return res.json({
          status_code = 201; // 201 Created
          body = Json.stringify(json_response, null);
          cache_strategy = #noCache;
        });
      },
    );

    server.get(
      "/.well-known/jwks.json",
      func(_ : Types.Request, res : Types.ResponseClass) : async Types.Response {

        Debug.print("Generating JWKS response...");
        let jwks_body = switch (Crypto.get_signing_key(context)) {
          case (null) {
            // No key exists yet, return an empty key set. This is valid.
            "{ \"keys\": [] }";
          };
          case (?private_key) {
            // We have a key, so we can generate the JWK.
            let public_key = private_key.getPublicKey();
            let jwk = public_key.toText(#jwk);

            // Wrap it in the standard "keys" array.
            "{ \"keys\": [" # jwk # "] }";
          };
        };

        Debug.print("JWKS response: " # jwks_body);

        return res.json({
          status_code = 200;
          body = jwks_body;
          cache_strategy = #noCache; // This can be cached
        });
      },
    );

    server.get(
      "/.well-known/oauth-authorization-server",
      func(req : Types.Request, res : Types.ResponseClass) : async Types.Response {
        // 1. Get the host from the request header.
        let host = switch (req.headers.get("host")) {
          case (?values) {
            if (values.size() == 0) {
              Principal.toText(context.self) # ".localhost";
            } // Fallback for safety
            else { values[0] };
          };
          case (_) Principal.toText(context.self) # ".localhost"; // Fallback for safety
        };

        // 2. Detect if we are running locally or on the mainnet to set the correct protocol.
        let scheme = if (Text.contains(host, #text(".localhost"))) "http" else "https";

        // 3. Construct the issuer URL with the correct scheme.
        let issuer = scheme # "://" # host;

        // Construct the metadata object using the mo:json library
        let metadata = #object_([
          ("issuer", #string(issuer)),
          ("authorization_endpoint", #string(issuer # "/authorize")),
          ("token_endpoint", #string(issuer # "/token")),
          ("jwks_uri", #string(issuer # "/.well-known/jwks.json")),
          ("registration_endpoint", #string(issuer # "/register")),
          ("scopes_supported", #array([#string("profile"), #string("openid")])),
          ("response_types_supported", #array([#string("code")])),
          ("grant_types_supported", #array([#string("authorization_code")])),
          ("token_endpoint_auth_methods_supported", #array([#string("client_secret_post")])),
          ("code_challenge_methods_supported", #array([#string("S256")])),
        ]);

        return res.json({
          status_code = 200;
          body = Json.stringify(metadata, null);
          // It's a well-known, static document, so we can cache it.
          cache_strategy = #noCache; // This can be cached, but we set it to noCache for simplicity
        });
      },
    );
  };
};
