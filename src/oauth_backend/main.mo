import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Map "mo:map/Map";
import Server "mo:server";
import Types "Types";
import Routes "Routes";
import Admin "Admin";

shared ({ caller = creator }) actor class () = self {

  // =================================================================================================
  // STATE - The main actor is the sole owner of all stable state.
  // =================================================================================================
  stable var signing_key_bytes : Blob = Blob.fromArray([]);
  stable var clients = Map.new<Text, Types.Client>();
  stable var auth_codes = Map.new<Text, Types.AuthorizationCode>();
  stable var subscriptions = Map.new<Principal, Types.Subscription>();
  stable var authorize_sessions = Map.new<Text, Types.AuthorizeSession>();
  stable var frontend_canister_id : Principal = Principal.fromActor(self);
  stable var serializedEntries : Server.SerializedEntries = ([], [], [creator]);

  // =================================================================================================
  // CONTEXT & INITIALIZATION
  // =================================================================================================

  // The context object that bundles state for logic modules.
  stable var context : Types.Context = {
    self = Principal.fromActor(self);
    creator = creator;
    var frontend_canister_id = frontend_canister_id;
    var signing_key_bytes = signing_key_bytes;
    clients = clients;
    auth_codes = auth_codes;
    subscriptions = subscriptions;
    authorize_sessions = authorize_sessions;
  };

  // The server instance.
  var server = Server.Server({ serializedEntries = serializedEntries });

  // Register all routes, passing the server and context.
  Routes.register(server, context);

  // =================================================================================================
  // PUBLIC API - Delegated to logic modules.
  // =================================================================================================
  public shared func complete_authorize(session_id : Text, user_principal : Principal) : async Text {
    await Routes.complete_authorize(context, session_id, user_principal);
  };

  public shared ({ caller }) func set_frontend_canister_id(id : Principal) {
    Admin.set_frontend_canister_id(context, caller, id);
  };

  public shared ({ caller }) func add_test_client(client : Types.Client) {
    Admin.add_test_client(context, caller, client);
  };

  // =================================================================================================
  // HTTP & SYSTEM HOOKS
  // =================================================================================================
  public query func http_request(req : Server.HttpRequest) : async Server.HttpResponse {
    server.http_request(req);
  };

  public func http_request_update(req : Server.HttpRequest) : async Server.HttpResponse {
    await server.http_request_update(req);
  };

  system func preupgrade() {
    // Save the server's state. The other stable vars are saved automatically.
    serializedEntries := server.entries();
  };

  system func postupgrade() {
    ignore server.cache.pruneAll();
    Routes.register(server, context); // Re-register routes on the new server instance.
  };
};
