import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Blob "mo:base/Blob";
import Result "mo:base/Result";
import Random "mo:base/Random";
import JWT_Lib "mo:jwt";
import Types "Types";
import Crypto "Crypto";

module {
  public func create_and_sign(
    context : Types.Context,
    auth_code_record : Types.AuthorizationCode,
    issuer : Text,
  ) : async Result.Result<Text, Text> {
    let private_key = switch (Crypto.get_signing_key(context)) {
      case (?key) key;
      case (null) return #err("No signing key found");
    };

    let now_seconds = Time.now() / 1_000_000_000;
    let exp_seconds = now_seconds + 3600; // Token expires in 1 hour.

    let unsigned_token : JWT_Lib.UnsignedToken = {
      header = [("alg", #string("ES256")), ("typ", #string("JWT")), ("kid", #string(Principal.toText(context.self)))];
      payload = [
        ("iss", #string(issuer)),
        ("sub", #string(Principal.toText(auth_code_record.user_principal))),
        ("aud", #string(auth_code_record.resource)),
        ("azp", #string(auth_code_record.client_id)),
        ("exp", #number(#int(exp_seconds))),
        ("iat", #number(#int(now_seconds))),
        ("scope", #string(auth_code_record.scope)),
      ];
    };

    let random_k = await Random.blob();
    let sign_res = private_key.sign(JWT_Lib.toBlobUnsigned(unsigned_token).vals(), random_k.vals());

    let signature = switch (sign_res) {
      case (#err(e)) return #err("Failed to sign token: " # e);
      case (#ok(sig)) sig;
    };

    let signed_token : JWT_Lib.Token = {
      unsigned_token with
      signature = {
        algorithm = "ES256";
        value = Blob.fromArray(signature.toBytes(#raw));
        message = JWT_Lib.toBlobUnsigned(unsigned_token);
      };
    };

    return #ok(JWT_Lib.toText(signed_token));
  };
};
