import Types "Types";
import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Map "mo:map/Map";

module {
  public func init(self : Principal, creator : Principal) : Types.Context {
    {
      // Initialize the context with the creator and ledger ID.
      self = self;
      creator = creator;
      var frontend_canister_id = Principal.fromText("aaaaa-aa"); // Default frontend canister ID
      var signing_key_bytes = Blob.fromArray([]); // Empty signing key initially
      clients = Map.new<Text, Types.Client>();
      resource_servers = Map.new<Text, Types.ResourceServer>();
      auth_codes = Map.new<Text, Types.AuthorizationCode>();
      authorize_sessions = Map.new<Text, Types.AuthorizeSession>();
      uri_to_rs_id = Map.new<Text, Text>();
    };
  };
};
