import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import ECDSA "mo:ecdsa";
import Types "Types";

module Crypto {
  // Note: All functions now take the context as an argument.
  public func get_signing_key(context : Types.Context) : ?ECDSA.PrivateKey {
    if (context.signing_key_bytes.size() == 0) { return null };
    let key_res = ECDSA.privateKeyFromBytes(context.signing_key_bytes.vals(), #raw({ curve = ECDSA.prime256v1Curve() }));
    return switch (key_res) {
      case (#ok(key)) ?key;
      case (#err(e)) Debug.trap("FATAL: Failed to deserialize stable signing key: " # e);
    };
  };

  public func get_or_create_signing_key(context : Types.Context, entropy : Blob) : ECDSA.PrivateKey {
    switch (get_signing_key(context)) {
      case (?key) key;
      case (null) {
        Debug.print("No signing key found. Generating a new one...");
        let curve = ECDSA.prime256v1Curve();
        let key_res = ECDSA.generatePrivateKey(entropy.vals(), curve);
        let new_key = switch (key_res) {
          case (#err(e)) {
            Debug.trap("Failed to generate new private key: " # e);
          };
          case (#ok(k)) k;
        };
        context.signing_key_bytes := Blob.fromArray(new_key.toBytes(#raw));
        return new_key;
      };
    };
  };
};
