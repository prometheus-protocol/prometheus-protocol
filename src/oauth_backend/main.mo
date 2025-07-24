import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Random "mo:base/Random";
import Server "server";
import Routes "Routes";
import Types "oauth/Types";
import Admin "oauth/Admin";
import State "oauth/State";
import Authorize "oauth/Authorize";
import Crypto "oauth/Crypto";
import Grants "oauth/Grants";

shared ({ caller = creator }) actor class AuthCanister() = self {

  // =================================================================================================
  // CONTEXT & INITIALIZATION
  // =================================================================================================

  // The context object that bundles state for logic modules.
  stable var context : Types.Context = State.init(Principal.fromActor(self), creator);
  stable var serializedEntries : Server.SerializedEntries = ([], [], [creator]);

  // The server instance.
  var server = Server.Server({ serializedEntries = serializedEntries });

  // 3. Enable CORS for all endpoints
  // This should be done before registering routes if you want it to apply to all of them.
  // It's safe to call this on every canister upgrade.
  server.enableCors(
    "*", // Allow any origin. For production, you might restrict this to your frontend's domain.
    "GET, POST, OPTIONS", // Allowed methods
    "Content-Type, Authorization" // Allowed headers
  );

  // Register OAuth routes, passing the server and context.
  Routes.register(server, context);

  // =================================================================================================
  // PUBLIC API - All logic is delegated to specialized modules.
  // =================================================================================================

  // Must be called before any other functions
  public shared ({ caller }) func set_frontend_canister_id(id : Principal) {
    Admin.set_frontend_canister_id(context, caller, id);
  };

  public shared query ({ caller }) func get_session_info(session_id : Text) : async Result.Result<Types.SessionInfo, Text> {
    Admin.get_session_info(context, session_id, caller);
  };

  public shared ({ caller }) func confirm_login(session_id : Text) : async Result.Result<Types.LoginConfirmation, Text> {
    await Authorize.confirm_login(context, session_id, caller);
  };

  public shared ({ caller }) func complete_payment_setup(session_id : Text) : async Result.Result<Null, Text> {
    await Authorize.complete_payment_setup(context, session_id, caller);
  };

  public shared ({ caller }) func complete_authorize(session_id : Text) : async Result.Result<Text, Text> {
    await Authorize.complete_authorize(context, session_id, caller);
  };

  public shared ({ caller }) func deny_consent(session_id : Text) : async Result.Result<Text, Text> {
    await Authorize.deny_consent(context, session_id, caller);
  };

  // =================================================================================================
  // Resource Server Management
  // =================================================================================================
  public shared ({ caller }) func register_resource_server(args : Types.RegisterResourceServerArgs) : async Result.Result<Types.ResourceServer, Text> {
    let entropy = await Random.blob();
    ignore Crypto.get_or_create_signing_key(context, entropy);
    await Admin.register_resource_server(context, caller, args);
  };

  public shared ({ caller }) func update_resource_server(args : Types.UpdateResourceServerArgs) : async Result.Result<Text, Text> {
    await Admin.update_resource_server(context, caller, args);
  };

  public shared ({ caller }) func list_my_resource_servers() : async Result.Result<[Types.ResourceServer], Text> {
    await Admin.list_my_resource_servers(context, caller);
  };

  public shared ({ caller }) func get_my_resource_server_details(id : Text) : async Result.Result<Types.ResourceServer, Text> {
    await Admin.get_my_resource_server_details(context, id, caller);
  };

  public shared ({ caller }) func delete_resource_server(id : Text) : async Result.Result<Text, Text> {
    await Admin.delete_resource_server(context, caller, id);
  };

  // ===================================================================
  // USER GRANT MANAGEMENT
  // ===================================================================
  public shared query ({ caller }) func get_my_grants() : async [Text] {
    Grants.get_my_grants(context, caller);
  };

  public shared ({ caller }) func revoke_grant(resource_server_id : Text) : async Result.Result<Text, Text> {
    await Grants.revoke_grant(context, caller, resource_server_id);
  };

  public shared query func get_public_resource_server(id : Text) : async Result.Result<Types.PublicResourceServer, Text> {
    Admin.get_public_resource_server_details(context, id);
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
  };
};
