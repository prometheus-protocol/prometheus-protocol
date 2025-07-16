import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Debug "mo:base/Debug";
import Map "mo:map/Map";
import Server "mo:server";
import Types "Types";
import Routes "Routes";
import Admin "Admin";

shared ({ caller = creator }) actor class AuthCanister(ledger_id : Principal) = self {

  // =================================================================================================
  // STATE - The main actor is the sole owner of all stable state.
  // =================================================================================================
  stable var signing_key_bytes : Blob = Blob.fromArray([]);
  stable var clients = Map.new<Text, Types.Client>();
  stable var resource_servers = Map.new<Text, Types.ResourceServer>();
  stable var auth_codes = Map.new<Text, Types.AuthorizationCode>();
  stable var authorize_sessions = Map.new<Text, Types.AuthorizeSession>();
  stable var frontend_canister_id : Principal = Principal.fromActor(self);
  stable var serializedEntries : Server.SerializedEntries = ([], [], [creator]);
  stable var icrc2_ledger_id : Principal = ledger_id;
  stable var registration_fee : Nat = 50 * 100_000_000; // 50 PMP tokens (with 8 decimals)
  stable var uri_to_rs_id = Map.new<Text, Text>();

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
    resource_servers = resource_servers;
    auth_codes = auth_codes;
    authorize_sessions = authorize_sessions;
    icrc2_ledger_id = icrc2_ledger_id;
    registration_fee = registration_fee;
    uri_to_rs_id = uri_to_rs_id;
  };

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

  // Register all routes, passing the server and context.
  Routes.register(server, context);

  // =================================================================================================
  // PUBLIC API - All logic is delegated to specialized modules.
  // =================================================================================================
  public shared func complete_authorize(session_id : Text, user_principal : Principal) : async Result.Result<Text, Text> {
    await Routes.complete_authorize(context, session_id, user_principal);
  };

  public shared ({ caller }) func set_frontend_canister_id(id : Principal) {
    Admin.set_frontend_canister_id(context, caller, id);
  };

  public shared ({ caller }) func add_test_client(client : Types.Client) {
    Admin.add_test_client(context, caller, client);
  };

  type RegisterResourceServerArgs = {
    name : Text;
    uris : [Text]; // The URIs for the resource server
    payout_principal : Principal;
    initial_service_principal : Principal;
  };
  public shared ({ caller }) func register_resource_server(args : RegisterResourceServerArgs) : async Types.ResourceServer {
    await Admin.register_resource_server(context, caller, args.name, args.uris, args.payout_principal, args.initial_service_principal);
  };

  type UpdateResourceServerUrisArgs = {
    resource_server_id : Text;
    new_uris : [Text];
  };
  public shared ({ caller }) func update_resource_server_uris(args : UpdateResourceServerUrisArgs) : async Result.Result<Text, Text> {
    await Admin.update_resource_server_uris(context, caller, args.resource_server_id, args.new_uris);
  };

  type ChargeUserArgs = {
    user_to_charge : Principal;
    amount : Nat; // Amount in PMP tokens
  };
  public shared ({ caller }) func charge_user(args : ChargeUserArgs) : async Result.Result<Null, Text> {
    Debug.print("Charge user called by: " # Principal.toText(caller));
    await Admin.charge_user(context, caller, args.user_to_charge, args.amount);
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
