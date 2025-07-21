import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Types "Types";
import Crypto "Crypto";
import Json "mo:json";
import Utils "Utils";

module {
  public func handle_jwks(context : Types.Context, _ : Types.Request, res : Types.ResponseClass) : async Types.Response {
    let jwks_body = switch (Crypto.get_signing_key(context)) {
      case (null) { "{ \"keys\": [] }" };
      case (?private_key) {
        let public_key = private_key.getPublicKey();
        let jwk_string = public_key.toText(#jwk);
        let jwk_inner_content = switch (Text.stripStart(jwk_string, #char '{')) {
          case (?content) content;
          case (null) "}"; // Should be impossible, but provide a safe fallback
        };

        // Define the fields to be injected into the JWK
        let kid_field = "\"kid\":\"" # Principal.toText(context.self) # "\",";
        let alg_field = "\"alg\":\"ES256\",";

        // Prepend the new fields to the existing JWK content
        let modified_jwk = "{" # kid_field # alg_field # jwk_inner_content;
        "{ \"keys\": [" # modified_jwk # "] }";
      };
    };
    return res.json({
      status_code = 200;
      body = jwks_body;
      cache_strategy = #noCache; // TODO: Cache for 1 hour
    });
  };

  public func handle_metadata(context : Types.Context, req : Types.Request, res : Types.ResponseClass) : async Types.Response {
    let issuer = Utils.get_issuer(context, req);

    let metadata = #object_([
      ("issuer", #string(issuer)),
      ("authorization_endpoint", #string(issuer # "/authorize")),
      ("token_endpoint", #string(issuer # "/token")),
      ("jwks_uri", #string(issuer # "/.well-known/jwks.json")),
      ("registration_endpoint", #string(issuer # "/register")),
      ("scopes_supported", #array([#string("openid"), #string("prometheus:charge")])),
      ("response_types_supported", #array([#string("code")])),
      ("grant_types_supported", #array([#string("authorization_code"), #string("refresh_token")])),
      ("token_endpoint_auth_methods_supported", #array([#string("client_secret_post")])),
      ("code_challenge_methods_supported", #array([#string("S256")])),
    ]);

    return res.json({
      status_code = 200;
      body = Json.stringify(metadata, null);
      cache_strategy = #noCache; // TODO: Cache for 1 hour
    });
  };
};
