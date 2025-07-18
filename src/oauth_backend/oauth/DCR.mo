import Principal "mo:base/Principal";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Random "mo:base/Random";
import Text "mo:base/Text";
import BaseX "mo:base-x-encoder";
import Map "mo:map/Map";
import { thash } "mo:map/Map";
import Sha256 "mo:sha2/Sha256";
import Types "Types";
import Json "mo:json";

module {
  public func handle_request(context : Types.Context, req : Types.Request, res : Types.ResponseClass) : async Types.Response {
    // 1. Define the expected JSON schema for the request body.
    let dcrSchema : Json.Schema = #object_({
      properties = [
        ("client_name", #string),
        ("redirect_uris", #array({ items = #string })),
        ("logo_uri", #string),
      ];
      required = ?["client_name", "redirect_uris"];
    });

    // 2. Parse and validate the request body.
    let json_body = switch (req.body) {
      case (?b) Json.parse(b.text());
      case (_) return res.json({
        status_code = 400;
        body = "{ \"error\": \"invalid_request\" }";
        cache_strategy = #noCache;
      });
    };
    let parsed = switch (json_body) {
      case (#err(_)) {
        return res.json({
          status_code = 400;
          body = "{ \"error\": \"invalid_request\" }";
          cache_strategy = #noCache;
        });
      };
      case (#ok(j)) j;
    };
    switch (Json.validate(parsed, dcrSchema)) {
      case (#ok()) { /* The JSON is valid, proceed. */ };
      case (#err(_)) {
        return res.json({
          status_code = 400;
          body = "{ \"error\": \"invalid_request\" }";
          cache_strategy = #noCache;
        });
      };
    };

    // 3. Extract data from the validated JSON.
    let client_name = switch (Json.getAsText(parsed, "client_name")) {
      case (#ok(t)) t;
      case (_) Debug.trap("Impossible");
    };
    let redirect_uris_json = switch (Json.get(parsed, "redirect_uris")) {
      case (?(#array(a))) a;
      case (_) Debug.trap("Impossible");
    };
    let redirect_uris = Array.map(redirect_uris_json, func(j : Json.Json) : Text { switch (j) { case (#string(t)) t; case (_) Debug.trap("Impossible") } });
    if (redirect_uris.size() == 0) {
      return res.json({
        status_code = 400;
        body = "{ \"error\": \"invalid_redirect_uri\", \"error_description\": \"at least one redirect_uri must be provided\" }";
        cache_strategy = #noCache;
      });
    };
    let logo_uri = switch (Json.getAsText(parsed, "logo_uri")) {
      case (#ok(t)) ?t;
      case (_) null;
    };

    // 4. Generate and store new client credentials.
    let client_id_blob = await Random.blob();
    let client_secret_blob = await Random.blob();
    let client_id = BaseX.toHex(client_id_blob.vals(), { isUpper = false; prefix = #none });
    let client_secret = BaseX.toHex(client_secret_blob.vals(), { isUpper = false; prefix = #none });
    let secret_hash_blob = Sha256.fromBlob(#sha256, Text.encodeUtf8(client_secret));
    let client_secret_hash = BaseX.toHex(secret_hash_blob.vals(), { isUpper = false; prefix = #none });

    let new_client : Types.Client = {
      client_id = client_id;
      owner = Principal.fromText("aaaaa-aa"); // Placeholder owner
      client_secret_hash = client_secret_hash;
      client_name = client_name;
      logo_uri = Option.get(logo_uri, "");
      redirect_uris = redirect_uris;
      status = #active; // Or #pending_activation if you have a fee model
    };
    Map.set(context.clients, thash, new_client.client_id, new_client);

    // 5. Construct and return the successful response.
    let json_response = #object_([
      ("client_id", #string(client_id)),
      ("client_secret", #string(client_secret)),
      ("client_name", #string(client_name)),
      ("redirect_uris", #array(Array.map(redirect_uris, func(uri : Text) : Json.Json { #string(uri) }))),
      ("grant_types", #array([#string("authorization_code")])),
    ]);

    return res.json({
      status_code = 201; // 201 Created
      body = Json.stringify(json_response, null);
      cache_strategy = #noCache;
    });
  };
};
