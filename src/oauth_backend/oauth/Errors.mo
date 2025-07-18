import Text "mo:base/Text";
import Types "Types";
import Array "mo:base/Array";
import Json "mo:json";

module {
  // A reusable helper to send a standard error response for the /authorize endpoint.
  public func send_authorize_error(res : Types.ResponseClass, message : Text) : async Types.Response {
    return res.send({
      status_code = 400;
      headers = [];
      body = Text.encodeUtf8("Invalid Request: " # message);
      streaming_strategy = null;
      cache_strategy = #noCache;
    });
  };

  // Helper for /token errors (standard OAuth2 JSON format)
  public func send_token_error(res : Types.ResponseClass, status_code : Nat16, error : Text, description : ?Text) : async Types.Response {
    let desc_field = switch (description) {
      case (?d) [("error_description", #string(d))];
      case (_) [];
    };
    let error_obj = #object_(Array.append([("error", #string(error))], desc_field));
    return res.json({
      status_code = status_code;
      body = Json.stringify(error_obj, null);
      cache_strategy = #noCache;
    });
  };
};
